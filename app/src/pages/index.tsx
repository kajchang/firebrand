import React from 'react';

import Head from 'next/head';
import Link from 'next/link';

import Header from '@/components/header';
import Rating from '@/components/rating';

import { connectToDatabase } from '@/utils/db';
import { partyToColor } from '@/utils/helpers';

import { Politician, Contest } from '@/types';

type PoliticianWithLatestContest = Politician & { latestContest: Contest };

type HomePageProps = {
  topPoliticians: PoliticianWithLatestContest[]
};

const HomePage: React.FunctionComponent<HomePageProps> = ({ topPoliticians }) => {
  const [search, setSearch] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const fetchingTimeout = React.useRef(null);

  React.useEffect(() => {
    if (fetchingTimeout.current != null) {
      clearTimeout(fetchingTimeout.current);
      fetchingTimeout.current = null;
    }
    fetchingTimeout.current = setTimeout(() => {
      console.log('fetching...');
      fetch('/api/politicians?search=' + search)
        .then(res => res.json())
        .then(data => setSearchResults(data.results));
      fetchingTimeout.current = null;
    }, 100);
  }, [search]);

  const displayedResults = search ? searchResults : topPoliticians;

  return (
    <div className='flex flex-col items-center bg-gray-200 min-h-screen'>
      <Head>
        <title>Firebrand - ELO Ratings for U.S. Politicians</title>
      </Head>
      <Header headerChildren='Firebrand' tagLineChildren='ELO* Ratings for US Politicians' tagLineProps={ { className: 'text-flag-red' } }/>
      <h3 className='text-3xl text-center font-big-star w-3/4 py-1 my-2' style={ { borderBottom: 'black solid 5px' } }>Top Rated Politicians</h3>
      <div className='rounded-lg bg-yellow-500 text-center text-2xl font-big-noodle w-5/6 p-3'>
        Warning: The input data and algorithm still have a lot of inconsistencies that need to be resolved.
      </div>
      <div className='flex flex-row justify-around font-big-noodle w-3/4 my-1'>
        <span>* Ratings are technically calculated using Trueskill, not ELO</span>
        <span>** Ratings are purely for entertainment purposes</span>
      </div>
      <input
        className='rounded-lg text-2xl font-big-noodle w-5/6 px-5 py-3'
        placeholder='Search...' value={ search }
        onChange={ e => setSearch(e.target.value) }
      />
      <div className='rounded-lg bg-gray-100 font-big-noodle w-5/6 my-5'>
        <ul>
          {
            displayedResults.map((politician, idx) => (
              <Link key={ idx } href={ `/politician/${ politician.name }` }>
                <a>
                  <li className='flex flex-row items-center rounded-lg hover:bg-gray-300 cursor-pointer text-2xl p-3'>
                    { politician.ranking }.
                    <Rating rating={ politician.rating.mu }/>
                    <div className='w-3 h-3 mx-2' style={
                      { backgroundColor: partyToColor(politician.latestContest.candidates.find(candidate => candidate.name.includes(politician.name)).party) }
                    }/>
                    { politician.name }
                  </li>
                </a>
              </Link>
            ))
          }
        </ul>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const db = await connectToDatabase(process.env.MONGODB_URI);

  const collection = await db.collection('politicians');
  const topPoliticians = await collection
    .aggregate([
      { $sort: { 'rating.mu': -1 } },
      { $project: { 'name': 1, 'rating': 1, 'ranking': 1, 'latestContest': { $arrayElemAt : ['$contests', -1] } } },
      {
        $lookup: {
          'from': 'contests',
          localField: 'latestContest._id',
          foreignField: '_id',
          'as': 'latestContest'
        }
      },
      { $project: { 'name': 1, 'rating': 1, 'ranking': 1, 'latestContest': { $arrayElemAt : ['$latestContest', 0] } } },
      { $project: { '_id': 0, 'latestContest': { '_id': 0 } } },
      { $limit: 100 }
    ])
    .toArray();

  return {
    props: {
      topPoliticians
    }
  };
}

export default HomePage;
