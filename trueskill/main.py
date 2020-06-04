from pymongo import MongoClient

import re
import itertools
from datetime import datetime

import os
import json

import trueskill

# Access MongoDB
client = MongoClient('mongodb://localhost:27017/firebrand')
db = client.get_database()

contests = db['contests']
politicians = db['politicians']

# Setup rating settings

STARTING_RATING = 1500
MAX_SIGMA = 250
trueskill.setup(STARTING_RATING, STARTING_RATING / 3, STARTING_RATING / 3 / 2, STARTING_RATING / 3 / 100)

# Load Metadata

METADATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'metadata')
with open(os.path.join(METADATA_PATH, '2016_primary_schedule.json')) as _2016_primary_schedule_file:
    _2016_PRIMARY_SCHEDULE = json.load(_2016_primary_schedule_file)
with open(os.path.join(METADATA_PATH, '2020_primary_schedule.json')) as _2020_primary_schedule_file:
    _2020_PRIMARY_SCHEDULE = json.load(_2020_primary_schedule_file)
with open(os.path.join(METADATA_PATH, '2020_primary_dropout_dates.json')) as _2020_primary_dropout_dates_file:
    _2020_PRIMARY_DROPOUT_DATES = json.load(_2020_primary_dropout_dates_file)

start_year = min(*contests.distinct('year'))


def get_order_of_contest(contest):
    normalized_contest_name = contest['name'].lower()

    is_special = 'special' in normalized_contest_name

    modifier = 3 if is_special else 0
    max_normal_order = 3 + 3

    # Have contests that haven't occurred yet appear first
    if contest['year'] == datetime.now().year and \
            all(candidate['votes'] is None and not candidate['won'] for candidate in contest['candidates']):
        return 0
    elif 'primary' in normalized_contest_name or 'caucus' in normalized_contest_name:
        if contest['year'] == 2016 and \
                any(candidate['name'] in ['Hillary Clinton', 'Donald Trump'] for candidate in contest['candidates']):
            contest_parts = contest['name'].split()
            party = contest_parts[-2]
            territory = ' '.join(contest_parts[:-2])
            primary_schedule = _2016_PRIMARY_SCHEDULE[party]
        elif contest['year'] == 2020 and 'presidential' in normalized_contest_name and\
                ('democratic' in normalized_contest_name or 'republican' in normalized_contest_name):
            contest_parts = contest['name'].split()
            territory = ' '.join(contest_parts[:-3])
            primary_schedule = _2020_PRIMARY_SCHEDULE
        else:
            return 3 + modifier

        return len(primary_schedule) + max_normal_order - primary_schedule.index(territory)
    elif 'runoff' in normalized_contest_name:
        return 2 + modifier
    elif normalized_contest_name.endswith('round'):
        # might have to update in the future
        number_words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']
        return len(number_words) + max_normal_order - number_words.index(normalized_contest_name.split()[-2].lower())
    else:
        return 1 + modifier


def rating_to_dict(rating: trueskill.Rating):
    return {
        'mu': rating.mu,
        'sigma': rating.sigma
    }


def rating_from_dict(dictt):
    return trueskill.Rating(dictt['mu'], dictt['sigma'])


# Splits candidates from races where candidates run on a ticket
def split_candidate_name(candidate_name):
    return re.split(r'/|&|(?: and )', candidate_name)


"""
TODO:
better results_input s
    - maybe cutoff candidates at some point because a lot of third party candidates are ranked 3rd and getting a lot of points b/c there are a lot of candidates in the race
experiment with rank decay
split like-named politicians
add metadata for 2016 presidential primary
get 2008 / 2012 presidential primary data?
"""


def main():
    ratings = {}

    def safe_get_politician(name, party):
        if ratings.get(name) is None:
            ratings[name] = {
                'name': name,
                'contests': [{'_id': None, 'rating': rating_to_dict(trueskill.Rating())}],
                'party': party
            }
        politician = ratings[name]
        if party != 'Unknown':
            politician['party'] = party
        return politician

    for year in range(start_year, datetime.now().year + 1):
        contests_in_year = list(contests.find({'year': year, 'hidden': None}))
        for contest in sorted(contests_in_year, key=get_order_of_contest, reverse=True):
            if len(contest['candidates']) == 0:
                continue

            if contest['year'] == 2020 and 'presidential' in contest['name'] and\
                    ('Democratic' in contest['name'] or 'Republican' in contest['name']):
                contest_date = contest['date'].isoformat()
                party = contest['name'].split()[-3]
                dropout_dates = _2020_PRIMARY_DROPOUT_DATES[party]

                contest['candidates'] = list(
                    filter(lambda candidate: dropout_dates.get(candidate['name'], '9') > contest_date, contest['candidates'])
                )

            tickets = []

            current_ratings_input = []
            results_input = []

            votes_recorded = contest['candidates'][0]['votes'] is not None
            if votes_recorded:
                contest['candidates'] = list(
                    filter(lambda candidate: candidate['votes'] is not None, contest['candidates'])
                )

                total_votes = sum(candidate['votes'] for candidate in contest['candidates'])

                vote_ranks = sorted(list(set(
                    candidate['votes'] for candidate in filter(
                        lambda candidate: not candidate['won'] and candidate['votes'] / total_votes > 0.01, contest['candidates'])
                )), reverse=True)

            num_winners = list(candidate['won'] for candidate in contest['candidates']).count(True)

            if num_winners > 0:
                tickets.append(tuple())
                current_ratings_input.append(tuple())
                results_input.append(0)

            for (idx, candidate) in enumerate(contest['candidates']):
                if any(term in candidate['name'].lower() for term in ['scatter', 'uncommitted']) or \
                        candidate['name'].lower() in ['', 'n/a', 'other', 'libertarian', 'nobody', 'no', 'blank',
                                                      'null', 'void', 'miscellaneous', '--']:
                    continue

                ticket = tuple(safe_get_politician(name.strip(), candidate['party']) for name in split_candidate_name(candidate['name']))

                current_rating_input = tuple(
                    rating_from_dict(candidate['contests'][-1]['rating']) for candidate in ticket
                )

                if candidate['won']:
                    tickets[0] = tuple(itertools.chain(tickets[0], ticket))
                    current_ratings_input[0] = tuple(itertools.chain(current_ratings_input[0], current_rating_input))
                else:
                    tickets.append(ticket)
                    current_ratings_input.append(current_rating_input)
                    # Rank based on votes if votes data is available
                    # Otherwise, count all losers as a tie
                    results_input.append(
                        (
                            (vote_ranks.index(candidate['votes']) + (1 if num_winners > 0 else 0)) if (candidate['votes'] / total_votes > 0.01) else
                            1 + len(vote_ranks)
                        )
                        if votes_recorded else 1
                    )

            if len(current_ratings_input) < 2 or (
                    not votes_recorded and not any(candidate['won'] for candidate in contest['candidates'])):
                for ticket in tickets:
                    for candidate in ticket:
                        candidate['contests'].append({
                            '_id': contest['_id'],
                            'rating': candidate['contests'][-1]['rating']
                        })
                continue

            try:
                outputs = trueskill.rate(current_ratings_input, results_input)
            except ValueError as e:
                print(contest)
                print(tickets, current_ratings_input, results_input)
                raise e

            for (ticket, output) in zip(tickets, outputs):
                for (candidate, rating) in zip(ticket, output):
                    candidate['contests'].append({
                        '_id': contest['_id'],
                        'rating': rating_to_dict(rating)
                    })

    ranking = 1
    excluded_ranking = len(ratings)
    for (idx, candidate) in enumerate(
            sorted(ratings.values(), key=lambda candidate: candidate['contests'][-1]['rating']['mu'], reverse=True)):
        # Pre-calculate derived fields
        candidate['rating'] = candidate['contests'][-1]['rating']
        if candidate['rating']['sigma'] < MAX_SIGMA:
            candidate['ranking'] = ranking
            candidate['ranked'] = True
            ranking += 1
        else:
            # Hide low confidence politicians from rankings
            candidate['ranking'] = excluded_ranking
            candidate['ranked'] = False
            excluded_ranking += 1

    return ratings


if __name__ == '__main__':
    ratings = main()
    politicians.delete_many({})
    politicians.insert_many(ratings.values())
