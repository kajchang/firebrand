import os

import csv

mit_election_lab_data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'mit-election-lab')


def read_row(headers, row):
    return dict(zip(headers, row))


with open(os.path.join(mit_election_lab_data_path, '1976-2016-president.csv')) as presidential_returns_file:
    presidential_returns_reader = csv.reader(presidential_returns_file)
    presidential_return_headers = next(presidential_returns_reader)
    presidential_returns_dataset = [read_row(presidential_return_headers, row) for row in presidential_returns_reader]

with open(os.path.join(mit_election_lab_data_path, '1976-2018-senate.csv'), errors='replace') as senate_returns_file:
    senate_returns_reader = csv.reader(senate_returns_file)
    senate_return_headers = next(senate_returns_reader)
    senate_returns_dataset = [read_row(senate_return_headers, row) for row in senate_returns_reader]

with open(os.path.join(mit_election_lab_data_path, '1976-2018-house2.csv'), errors='replace') as house_returns_file:
    house_returns_reader = csv.reader(house_returns_file)
    house_return_headers = next(house_returns_reader)
    house_returns_dataset = [read_row(house_return_headers, row) for row in house_returns_reader]

contests = {}
contest_datasets = [presidential_returns_dataset, senate_returns_dataset, house_returns_dataset]

for contest_dataset in contest_datasets:
    for row in contest_dataset:
        party = row['party'].capitalize()
        if party not in ['Democrat', 'Republican']:
            continue

        year = int(row['year'])
        state = row['state']
        office = row['office'] + (' ' + row['district'] if contest_dataset is house_returns_dataset else '')
        if contests.get(year) is None:
            contests[year] = {}
        if contests[year].get(state) is None:
            contests[year][state] = {}
        if contests[year][state].get(office) is None:
            contests[year][state][office] = {}

        contests[year][state][office]['total_votes'] = int(row['totalvotes'])

        candidate = row['candidate']
        if contest_dataset is presidential_returns_dataset:
            candidate = ' '.join(reversed(candidate.split(', ')))
        elif contest_dataset is house_returns_dataset or contest_dataset is senate_returns_dataset:
            candidate = candidate.replace('__', ' ')

        contests[year][state][office][party] = {
            'candidate': row['candidate'],
            'votes': int(row['candidatevotes'])
        }
