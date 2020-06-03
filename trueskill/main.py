from datetime import datetime

from pymongo import MongoClient

import trueskill

import re

client = MongoClient('mongodb://localhost:27017/firebrand')
db = client.get_database()

contests = db['contests']
politicians = db['politicians']

STARTING_RATING = 1500
trueskill.setup(STARTING_RATING, STARTING_RATING / 3, STARTING_RATING / 3 / 2, STARTING_RATING / 3 / 100)

_2016_PRIMARY_SCHEDULE = {
    'Democratic': ['Iowa', 'New Hampshire', 'Nevada', 'South Carolina', 'Alabama', 'Arkansas', 'Colorado', 'Georgia', 'Massachusetts', 'Minnesota', 'Oklahoma', 'Tennessee', 'Texas', 'Vermont', 'Virginia', 'American Samoa', 'Democrats Abroad', 'Kansas', 'Louisiana', 'Nebraska', 'Maine', 'Michigan', 'Mississippi', 'CNMI', 'Florida', 'Illinois', 'Missouri', 'North Carolina', 'Ohio', 'Arizona', 'Idaho', 'Utah', 'Alaska', 'Hawaii', 'Washington', 'Wisconsin', 'Wyoming', 'New York', 'Connecticut', 'Delaware', 'Maryland', 'Pennsylvania', 'Rhode Island', 'Indiana', 'Guam', 'Nebraska', 'West Virginia', 'Kentucky', 'Oregon', 'Washington', 'U.S. Virgin Islands', 'Puerto Rico', 'California', 'Montana', 'New Jersey', 'New Mexico', 'North Dakota', 'South Dakota', 'Washington, D.C.'],
    'Republican': ['Iowa', 'New Hampshire', 'South Carolina', 'Nevada', 'Alabama', 'Alaska', 'Arkansas', 'Colorado', 'Georgia', 'Massachusetts', 'Minnesota', 'Oklahoma', 'Tennessee', 'Texas', 'Vermont', 'Virginia', 'Wyoming', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Puerto Rico', 'Hawaii', 'Idaho', 'Michigan', 'Mississippi', 'U.S. Virgin Islands', 'Washington, D.C.', 'Wyoming', 'Guam', 'Florida', 'Illinois', 'Missouri', 'North Carolina', 'Ohio', 'CNMI', 'Arizona', 'Utah', 'American Samoa', 'Wisconsin', 'New York', 'Connecticut', 'Delaware', 'Maryland', 'Pennsylvania', 'Rhode Island', 'Indiana', 'Nebraska', 'West Virginia', 'Oregon', 'Washington', 'California', 'Montana', 'New Jersey', 'New Mexico', 'South Dakota']
}

start_year = min(*contests.distinct('year'))


def get_order_of_contest(contest):
    normalized_contest_name = contest['name'].lower()

    # Have contests that haven't occurred yet appear first
    if contest['year'] == datetime.now().year and\
        all(candidate['votes'] is None and not candidate['won'] for candidate in contest['candidates']):
        return 0
    elif 'primary' in normalized_contest_name or 'caucus' in normalized_contest_name:
        # Use the primary schedule for 2016
        if contest['year'] == 2016 and\
           any(candidate['name'] == 'Hillary Clinton' or candidate['name'] == 'Donald Trump' for candidate in contest['candidates']):
            contest_parts = contest['name'].split()
            party = contest_parts[-2]
            territory = ' '.join(contest_parts[:-2])
            return len(_2016_PRIMARY_SCHEDULE[party]) + 3 - _2016_PRIMARY_SCHEDULE[party].index(territory)
        return 3
    elif 'runoff' in normalized_contest_name:
        return 2
    elif normalized_contest_name.endswith('round'):
        # might have to update in the future
        number_words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']
        return len(number_words) + 3 - number_words.index(normalized_contest_name.split()[-2].lower())
    else:
        return 1


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
make sure party is never null
scrape more elections, especially missing presidential elections
"""


def main():
    ratings = {}

    def safe_get_candidate(name):
        if ratings.get(name) is None:
            ratings[name] = {
                'name': name,
                'contests': [{'_id': None, 'rating': rating_to_dict(trueskill.Rating())}]
            }
        return ratings[name]

    for year in range(start_year, datetime.now().year + 1):
        contests_in_year = list(contests.find({'year': year}))
        for contest in sorted(contests_in_year, key=get_order_of_contest, reverse=True):
            if len(contest['candidates']) == 0:
                continue

            tickets = []

            current_ratings_input = []
            results_input = []

            votes_recorded = contest['candidates'][0]['votes'] is not None
            if votes_recorded:
                contest['candidates'] = list(
                    filter(lambda candidate: candidate['votes'] is not None, contest['candidates'])
                )

                vote_ranks = sorted(list(set(
                    candidate['votes'] for candidate in filter(
                        lambda candidate: not candidate['won'], contest['candidates'])
                )), reverse=True)

            for (idx, candidate) in enumerate(contest['candidates']):
                if any(term in candidate['name'].lower() for term in ['scatter', 'uncommitted']) or \
                   candidate['name'].lower() in ['', 'n/a', 'other', 'libertarian', 'nobody', 'no', 'blank', 'null', 'void', 'miscellaneous', '--']:
                    continue

                ticket = tuple(safe_get_candidate(name.strip()) for name in split_candidate_name(candidate['name']))

                current_ratings_input.append(tuple(
                    rating_from_dict(candidate['contests'][-1]['rating']) for candidate in ticket
                ))

                # Rank based on votes if votes data is available
                # Otherwise, count all winners as a tie and all losers as another tie
                results_input.append(0 if candidate['won'] else
                                     ((vote_ranks.index(candidate['votes']) + len(contest['candidates']) - len(vote_ranks))
                                      if votes_recorded else 1))

                tickets.append(ticket)

            if len(current_ratings_input) < 2 or not any(candidate['won'] for candidate in contest['candidates']):
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

    for (idx, candidate) in enumerate(sorted(ratings.values(), key=lambda candidate: candidate['contests'][-1]['rating']['mu'], reverse=True)):
        # Pre-calculate derived fields
        candidate['ranking'] = idx + 1
        candidate['rating'] = candidate['contests'][-1]['rating']

    return ratings


if __name__ == '__main__':
    ratings = main()
    politicians.delete_many({})
    politicians.insert_many(ratings.values())
