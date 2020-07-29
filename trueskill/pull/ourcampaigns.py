from pymongo import MongoClient

from datetime import datetime
import re

import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--reset', action='store_true')
args = parser.parse_args()

client = MongoClient('mongodb://localhost:27017', unicode_decode_error_handler='ignore')

ourcampaigns_db = client['ourcampaigns']
firebrand_db = client['firebrand']

metadata_col = firebrand_db['metadata']
contests_col = firebrand_db['contests']

race_col = ourcampaigns_db['Race']
party_col = ourcampaigns_db['Party']
container_col = ourcampaigns_db['Container']
candidate_col = ourcampaigns_db['Candidate']
race_members_col = ourcampaigns_db['RaceMember']

contests_to_insert = []

if args.reset:
    contests_col.delete_many({})
    metadata_col.delete_one({ 'name': 'transfer_date' })

is_first_run = False
transfer_date_metadata = metadata_col.find_one({ 'name': 'transfer_date' })
if transfer_date_metadata is not None:
    latest_transfer_date = transfer_date_metadata['value']
else:
    is_first_run = True
    latest_transfer_date = datetime.min
latest_pull_date = max(race_col.distinct('LastModified', { 'LastModified': { '$type': 'date' } }))

excluded_races = [19115]
us_root = 1
container_queue = [us_root, 188, 67720]
valid_containers = list(container_queue)
while len(container_queue) > 0:
    container = container_queue.pop()
    for child_container in container_col.find({'ParentLink': container}, projection={'ContainerID': True}):
        if child_container['ContainerID'] in excluded_races:
            continue
        valid_containers.append(child_container['ContainerID'])
        container_queue.append(child_container['ContainerID'])

valid_offices = [585, 835, 699, 743, 739, 368, 345, 411, 437, 809, 678, 757, 121, 643, 818, 50, 223, 334, 282]
valid_race_types = ['General Election', 'General Election - Requires Run-Off', 'Caucus', 'Primary Election', 'Primary Election Run-Off', 'Run-Off', 'Special Election', 'Special Election Primary', 'Running Mate']

excluded_race_ids = [32102, 379074, 513619, 905093]

for race in race_col.find({
        'Title': { '$not': { '$regex': re.compile(r'selection|convention|chair|primaries|delegate|endorsement|preference|national|popular|nomination|committee', re.IGNORECASE) } },
        '$or': [
            { 'ParentRace': 0 },
            { '$and': [ { 'OfficeLink': 585 }, { 'Type': { '$in': ['Caucus', 'Primary Election'] } } ] },
        ],
        'LastModified': { '$type': 'date', '$gt': latest_transfer_date },
        'Type': { '$in': valid_race_types },
        'OfficeLink': { '$in': valid_offices },
        'PollEnd': { '$type': 'date' },
        'Silly': '',
        'Description': { '$not': { '$regex': re.compile(r'non-binding', re.IGNORECASE) } },
        'ParentContainer': { '$in': valid_containers },
        'RaceID': { '$nin': excluded_race_ids }
    }, projection={'Title': True, 'RaceID': True, 'PollEnd': True, 'DataSources': True}):
    contest = {
        '_id': race['RaceID'],
        'name': race['Title'],
        'date': race['PollEnd'],
        'candidates': [],
        'source': race['DataSources'],
        'upcoming': race['PollEnd'] > latest_pull_date
    }
    for race_member in race_members_col.find({
        'RaceLink': race['RaceID'],
        'WriteIn': '',
        '$and': [
            { '$or': [
                { 'DropoutDate': '0000-00-00' },
                { 'DropoutDate': { '$gt': race['PollEnd'] } }
            ] }
        ]
    }, projection={'CandidateLink': True, 'PartyLink': True, 'Won': True, 'Incumbent': True, 'FinalVoteTotal': True}):
        party = party_col.find_one({'PartyID': race_member['PartyLink']}, projection={'Name': True, 'Color': True})
        if party is None:
            continue
        candidate = candidate_col.find_one({'CandidateID': race_member['CandidateLink']}, projection={'FirstName': True, 'LastName': True})
        if candidate is None:
            continue
        if type(candidate['FirstName']) is not str or type(candidate['LastName']) is not str:
            continue
        if candidate['FirstName'].startswith('"'):
            match = re.search(r'""(.+)"""', candidate['FirstName'])
            if match is not None:
                candidate['FirstName'] = match.group(1)
        if candidate['LastName'].startswith('"'):
            candidate['LastName'] = candidate['LastName'][1:-1]
        contest['candidates'].append({
            '_id': race_member['CandidateLink'],
            'name': (candidate['FirstName'] + ' ' + candidate['LastName']).strip(),
            'party': { 'name': party['Name'], 'color': party['Color'] },
            'incumbent': race_member['Incumbent'] == 'Y',
            'won': race_member['Won'] == 'Y',
            'votes': race_member['FinalVoteTotal']
        })
    if is_first_run:
        contests_to_insert.append(contest)
        if len(contests_to_insert) == 1000:
            contests_col.insert_many(contests_to_insert)
            contests_to_insert = []
    else:
        contests_col.replace_one({ '_id': contest['_id'] }, contest, upsert=True)

if is_first_run:
    contests_col.insert_many(contests_to_insert)
metadata_col.update_one({ 'name': 'transfer_date' }, {
    '$set': { 'value': latest_pull_date }
}, upsert=True)
