from pymongo import MongoClient

import itertools
from datetime import datetime
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

# Setup rating settings

CURRENT_YEAR = datetime.now().year
YEARS_UNTIL_EXCLUDED = 12

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


def rating_from_dict(dictt):
    return trueskill.Rating(dictt['mu'], dictt['sigma'])

def main():
    politicians = OrderedDict()

    last_contest_year = None
    for contest in contests_col.find({}).sort([('date', 1)]):
        if contest['date'].year != last_contest_year:
            print(colorama.Fore.GREEN + 'Processing contests from ' + str(contest['date'].year) + colorama.Fore.RESET)
            last_contest_year = contest['date'].year

        participants = []
        current_ratings_input = []
        results_input = []

        is_presidential_primary = 'US President' in contest['name'] and ('Primary' in contest['name'] or 'Caucus' in contest['name'])
        has_winner = len(list(filter(lambda candidate: candidate['won'], contest['candidates']))) > 0
        is_one_shot = all(candidate['votes'] == 1 or candidate['votes'] == 0 for candidate in contest['candidates'])

        winners_seen = 0
        total_votes = sum(candidate['votes'] for candidate in contest['candidates'])

        for (idx, candidate) in enumerate(sorted(contest['candidates'], key=lambda candidate: candidate['votes'], reverse=True)):
            if (
                not is_one_shot and
                total_votes > 0 and
                len(contest['candidates']) > 2 and
                (candidate['votes'] / total_votes) < 0.01
            ):
                break
            if (
                is_presidential_primary and
                PRESIDENTIAL_PRIMARY_METADATA.get(contest['date'].year) is not None and
                PRESIDENTIAL_PRIMARY_METADATA[contest['date'].year]['DROPOUT_DATES'].get(candidate['party']['name']) is not None and
                PRESIDENTIAL_PRIMARY_METADATA[contest['date'].year]['DROPOUT_DATES'][candidate['party']['name']].get(candidate['name'], '9') < contest['date'].isoformat()
            ):
                continue
            if (
                candidate['party'] == 'Write-In' or
                candidate['name'].startswith('No ') or
                candidate['name'] in ['Uncommitted']
            ):
                continue
            if politicians.get(candidate['_id']) is None:
                politicians[candidate['_id']] = {
                    'name': candidate['name'],
                    'party': candidate['party'],
                    'rating_history': [{'contest_id': None, 'rating': rating_to_dict(trueskill.Rating())}]
                }
            
            politician = politicians[candidate['_id']]
            politician['party'] = candidate['party']
            politician['last_ran_in'] = contest['date'].year

            participants.append(politician)
            current_ratings_input.append((rating_from_dict(politician['rating_history'][-1]['rating']),))
            results_input.append((0 if candidate['won'] else idx + (1 - winners_seen if has_winner else 0),))
            if candidate['won']:
                winners_seen += 1
        
        if len(participants) < 2:
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

    ranking = 1
    excluded_ranking = len(politicians)
    for (idx, politician) in enumerate(
            sorted(politicians.values(), key=lambda politician: politician['rating_history'][-1]['rating']['mu'], reverse=True)
    ):
        # Pre-calculate derived fields
        politician['rating'] = politician['rating_history'][-1]['rating']
        politician['rating']['low_confidence'] = False
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
    politicians_col.insert_many(map(lambda item: dict({'_id': item[0]}, **item[1]), politicians.items()))
