from pymongo import MongoClient

import re
import unicodedata

import itertools
from datetime import datetime, date, timedelta
from collections import OrderedDict

import os
import json

import trueskill

import colorama

# Access MongoDB
client = MongoClient('mongodb://localhost:27017/firebrand')
db = client.get_database()

contests_col = db['contests']
politicians_col = db['politicians']
metadata_col = db['metadata']

last_transfer_date = metadata_col.find_one({ 'name': 'transfer_date' })['value']

# Setup rating settings

FOUNDING_YEAR = 1776
CURRENT_YEAR = datetime.now().year
YEARS_UNTIL_EXCLUDED = 6
RANKING_DELTA_TIME = timedelta(weeks=52 * 2)

STARTING_RATING = 1500
MAX_SIGMA = STARTING_RATING / 3 / 2
trueskill.setup(STARTING_RATING, STARTING_RATING / 3, STARTING_RATING / 3 / 2, STARTING_RATING / 3 / 100, backend='mpmath')

# Load Presidential Primary Metadata

METADATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'metadata')
PRESIDENTIAL_PRIMARY_METADATA = {}
for year in range(1992, CURRENT_YEAR + 1, 4):
    PRESIDENTIAL_PRIMARY_METADATA[year] = {}
    with open(os.path.join(METADATA_PATH, '{0}_primary_dropout_dates.json'.format(year))) as primary_schedule_file:
        PRESIDENTIAL_PRIMARY_METADATA[year]['DROPOUT_DATES'] = json.load(primary_schedule_file, object_pairs_hook=OrderedDict)

# Setup colorama
colorama.init()

def rating_to_dict(rating: trueskill.Rating):
    return {
        'mu': rating.mu,
        'sigma': rating.sigma
    }

def rating_from_dict(dictt: dict):
    return trueskill.Rating(dictt['mu'], dictt['sigma'])

def make_searchable(name: str):
    name = re.sub(r' [A-Z]\.', '', name)
    name = unicodedata.normalize('NFD', name).encode('ascii', 'ignore').decode('utf-8')
    return name

def main():
    politicians = OrderedDict()
    
    previous_rankings = {}
    previous_rankings_calculated = False

    year_being_processed = None
    for contest in contests_col.find({}).sort([('date', 1)]):
        if contest['date'].year != year_being_processed:
            print(colorama.Fore.GREEN + 'Processing contests from ' + str(contest['date'].year) + colorama.Fore.RESET)
            year_being_processed = contest['date'].year

        participants = []
        current_ratings_input = []
        results_input = []

        is_presidential_primary = 'US President' in contest['name'] and contest['type'] in ['Caucus', 'Primary Election']
        is_one_shot = all(candidate['votes'] == 1 or candidate['votes'] == 0 for candidate in contest['candidates'])
        is_ultimate_election = contest['type'] in ['General Election', 'Run-Off', 'Special Election', 'Running Mate']

        num_winners = len(list(filter(lambda candidate: candidate['won'], contest['candidates'])))
        has_winner = num_winners > 0

        total_votes = sum(candidate['votes'] for candidate in contest['candidates'])
        next_result_score = 1 if has_winner and is_ultimate_election else 0

        is_upcoming = contest['upcoming']

        for candidate in sorted(contest['candidates'], key=lambda candidate: candidate['votes'], reverse=True):
            if (
                is_presidential_primary and
                PRESIDENTIAL_PRIMARY_METADATA.get(contest['date'].year) is not None and
                PRESIDENTIAL_PRIMARY_METADATA[contest['date'].year]['DROPOUT_DATES'].get(candidate['party']['name']) is not None
            ):
                [entry_date, dropout_date] = PRESIDENTIAL_PRIMARY_METADATA[contest['date'].year]['DROPOUT_DATES'][candidate['party']['name']].get(candidate['name'], [None, None])
                if (date.fromisoformat(entry_date) if entry_date is not None else date.min) > contest['date'].date():
                    continue
                if (date.fromisoformat(dropout_date) if dropout_date is not None else date.max) <= contest['date'].date():
                    continue
            if (
                candidate['party'] == 'Write-In' or
                candidate['name'].startswith('No ') or
                candidate['name'].endswith('Primary Winner') or
                (candidate['name'].startswith('Runoff') and candidate['name'].endswith('Winner')) or
                'Scattering' in candidate['name'] or
                candidate['name'] in ['Uncommitted', 'Others', 'Write-In', 'Abstaining', 'Reject']
            ):
                continue
            if politicians.get(candidate['_id']) is None:
                politicians[candidate['_id']] = {
                    '_id': candidate['_id'],
                    'name': candidate['name'],
                    'searchable_name': make_searchable(candidate['name']),
                    'party': candidate['party'],
                    'rating_history': [{'contest_id': None, 'rating': rating_to_dict(trueskill.Rating())}]
                }
            
            politician = politicians[candidate['_id']]
            if not is_upcoming:
                politician['party'] = candidate['party']
                politician['last_ran_in'] = contest['date'].year

            participants.append(politician)
            current_ratings_input.append((rating_from_dict(politician['rating_history'][-1]['rating']),))
            results_input.append((0 if candidate['won'] and is_ultimate_election else next_result_score,))

            are_candidate_votes_negligible = not is_one_shot and total_votes > 0 and len(contest['candidates']) > 2 and (candidate['votes'] / total_votes) < 0.01
            if (not candidate['won'] or not is_ultimate_election) and not are_candidate_votes_negligible:
                next_result_score += 1

        if len(participants) < 2 or is_upcoming:
            for participant in participants:
                participant['rating_history'].append(
                    {'contest_id': contest['_id'], 'rating': participant['rating_history'][-1]['rating']}
                )
            continue

        outputs = trueskill.rate(current_ratings_input, results_input)
        for (participant, output) in zip(participants, outputs):
            participant['rating_history'].append(
                {'contest_id': contest['_id'], 'rating': rating_to_dict(output[0])}
            )

        if not previous_rankings_calculated and last_transfer_date - contest['date'] < RANKING_DELTA_TIME:
            previous_rankings_calculated = True
            for (idx, politician) in enumerate(sorted(filter(
                lambda politician: not (politician['rating_history'][-1]['rating']['sigma'] > MAX_SIGMA or politician['last_ran_in'] < CURRENT_YEAR - YEARS_UNTIL_EXCLUDED),
                politicians.values()
            ), key=lambda politician: politician['rating_history'][-1]['rating']['mu'], reverse=True)):
                previous_rankings[politician['_id']] = idx + 1

    ranking = 1
    excluded_ranking = len(politicians)
    for politician in sorted(politicians.values(), key=lambda politician: politician['rating_history'][-1]['rating']['mu'], reverse=True):
        # Pre-calculate derived fields
        politician['rating'] = politician['rating_history'][-1]['rating']
        politician['rating']['low_confidence'] = False
        politician['previous_ranking'] = previous_rankings.get(politician['_id'])
        politician['retired'] = False
        if politician['rating']['sigma'] > MAX_SIGMA:
            # Hide low confidence politicians from rankings
            politician['ranking'] = excluded_ranking
            politician['rating']['low_confidence'] = True
            excluded_ranking += 1
        elif politician['last_ran_in'] < CURRENT_YEAR - YEARS_UNTIL_EXCLUDED:
            # Hide politicians that have not run in YEARS_UNTIL_EXCLUDED years
            politician['ranking'] = excluded_ranking
            politician['retired'] = True
            excluded_ranking += 1
        else:
            # Hide low confidence politicians from rankings
            politician['ranking'] = ranking
            ranking += 1

    print(colorama.Fore.GREEN + 'Rated ' + str(len(politicians)) + ' Politicians' + colorama.Fore.RESET)
    return politicians


if __name__ == '__main__':
    politicians = main()
    politicians_col.delete_many({})
    politicians_col.insert_many(politicians.values())
