import os

import requests
from bs4 import BeautifulSoup

data_path = os.path.dirname(__file__)


def download_tufts_election_data():
    tufts_data_path = os.path.join(data_path, 'tufts')
    if not os.path.exists(tufts_data_path):
        os.mkdir(tufts_data_path)
    root = 'https://dl.tufts.edu'
    search_result_page = BeautifulSoup(
        requests.get(root + '/catalog?f%5Bnames_sim%5D%5B%5D=American+Antiquarian+Society&f%5Bobject_type_sim%5D%5B%5D=Generic+Objects&per_page=50&q=&search_field=all_fields').text, 'html.parser')

    for search_result in search_result_page.find_all('div', {'class': 'search-result-wrapper'}):
        document_page = BeautifulSoup(requests.get(root + search_result.find('a')['href']).text, 'html.parser')
        file_name = document_page.find('div', {'class': 'main-header'}).find('h2').text.strip()
        file_download_link = document_page.find('tr', {'class': 'file_set'}).find('a')
        file_suffix = file_download_link.text.split('.')[-1]
        file_download_url = root + file_download_link['href']
        with open(os.path.join(tufts_data_path, file_name + '.' + file_suffix), 'wb') as downloaded_file:
            downloaded_file.write(requests.get(file_download_url).content)
            downloaded_file.flush()
        print('Downloaded ' + file_download_url + ' to ' + file_name + '.' + file_suffix)


def main():
    download_tufts_election_data()


main()
