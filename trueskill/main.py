from datetime import datetime

from pymongo import MongoClient

import trueskill

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

    if 'primary' in normalized_contest_name or 'caucus' in normalized_contest_name:
        if contest['year'] == 2016 and\
           any(candidate['name'] == 'Hillary Clinton' or candidate['name'] == 'Donald Trump' for candidate in contest['candidates']):
            contest_parts = contest['name'].split()
            party = contest_parts[-2]
            territory = ' '.join(contest_parts[:-2])
            return len(_2016_PRIMARY_SCHEDULE[party]) + 2 - _2016_PRIMARY_SCHEDULE[party].index(territory)
        return 2
    elif 'runoff' in normalized_contest_name:
        return 1
    else:
        return 0


def rating_to_dict(rating: trueskill.Rating):
    return {
        'mu': rating.mu,
        'sigma': rating.sigma
    }


def rating_from_dict(dictt):
    return trueskill.Rating(dictt['mu'], dictt['sigma'])


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
                contest['candidates'] = sorted(
                    filter(lambda candidate: candidate['votes'] is not None, contest['candidates']),
                    key=lambda candidate: candidate['votes'], reverse=True
                )

            for (idx, candidate) in enumerate(contest['candidates']):
                if any(term in candidate['name'].lower() for term in ['n/a', 'scatter', 'other', 'uncommitted']) or \
                   candidate['name'].lower() in ['', 'libertarian', 'nobody', 'no', 'blank', 'null', 'void']:
                    continue

                if '/' in candidate['name']:
                    ticket = tuple(safe_get_candidate(name.strip()) for name in candidate['name'].split('/'))
                else:
                    ticket = (safe_get_candidate(candidate['name']),)

                current_ratings_input.append(tuple(
                    rating_from_dict(candidate['contests'][-1]['rating']) for candidate in ticket
                ))
                results_input.append(idx if votes_recorded else (0 if candidate['won'] else 1))

                tickets.append(ticket)

            if len(current_ratings_input) < 2:
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

    for candidate in ratings:
        ratings[candidate]['rating'] = ratings[candidate]['contests'][-1]['rating']

    return ratings


if __name__ == '__main__':
    ratings = main()
    politicians.delete_many({})
    politicians.insert_many(ratings.values())
