import csv

import json


def read_row(headers, row):
    return dict(zip(headers, row))


with open('raw/1976-2016-president.csv') as presidential_returns_file:
    presidential_returns_reader = csv.reader(presidential_returns_file)
    presidential_return_headers = next(presidential_returns_reader)
    presidential_returns_dataset = [read_row(presidential_return_headers, row) for row in presidential_returns_reader]

with open('raw/1976-2018-senate.csv', errors='replace') as senate_returns_file:
    senate_returns_reader = csv.reader(senate_returns_file)
    senate_return_headers = next(senate_returns_reader)
    senate_returns_dataset = [read_row(senate_return_headers, row) for row in senate_returns_reader]

with open('raw/1976-2018-house2.csv', errors='replace') as house_returns_file:
    house_returns_reader = csv.reader(house_returns_file)
    house_return_headers = next(house_returns_reader)
    house_returns_dataset = [read_row(house_return_headers, row) for row in house_returns_reader]

contests = []
# presidential_returns_dataset
contest_datasets = [senate_returns_dataset, house_returns_dataset]

current_contest = {'name': '', 'year': '', 'candidates': []}


def add_contest(contest):
    winner = contest['candidates'][0]
    for candidate in contest['candidates'][1:]:
        if candidate['votes'] > winner['votes']:
            winner = candidate
    winner['won'] = True

    contests.append(contest)


for contest_dataset in contest_datasets:
    for row in contest_dataset:
        party = row['party'].capitalize()
        year = int(row['year'])
        state = row['state']
        office = state + ' ' + row['office'] + (' ' + row['district'] if contest_dataset is house_returns_dataset else '')

        if office != current_contest['name']:
            if current_contest['name'] != '':
                add_contest(current_contest)
            current_contest = {'name': office, 'year': year, 'candidates': []}

        candidate = row['candidate']
        if contest_dataset is presidential_returns_dataset:
            candidate = ' '.join(reversed(candidate.split(', ')))
        elif contest_dataset is house_returns_dataset or contest_dataset is senate_returns_dataset:
            candidate = candidate.replace('__', ' ')

        current_contest['candidates'].append({
            'name': candidate,
            'party': party,
            'won': False,
            'votes': int(row['candidatevotes'])
        })

add_contest(current_contest)

with open('federal_elections_all.json', 'w') as federal_elections_data_file:
    json.dump(contests, federal_elections_data_file)
