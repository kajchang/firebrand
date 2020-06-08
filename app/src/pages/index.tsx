import React from 'react';

import Head from 'next/head';
import Link from 'next/link';

import Header from '@/components/header';
import Rating from '@/components/rating';
import SparkLine from '@/components/sparkline';

import { connectToDatabase } from '@/utils/db';
import { partyToColor } from '@/utils/helpers';

import { Politician } from '@/types';

type HomePageProps = {
  topPoliticians: Politician[]
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
      <div className='rounded-lg bg-yellow-500 text-center text-xl md:text-2xl font-big-noodle w-5/6 p-3 my-5'>
        Warning: Most data are automatically collected and may be inaccurate
      </div>
      <input
        className='rounded-lg text-2xl font-big-noodle w-5/6 px-5 py-3'
        placeholder='Search...' value={ search }
        onChange={ e => setSearch(e.target.value) }
      />
      <div className='text-xl md:text-2xl font-big-noodle w-5/6 my-5'>
        <ul>
          {
            displayedResults.map((politician, idx) => {
              const excluded = politician.rating.low_confidence || politician.retired;

              return (
                <li className={ `${ idx == 0 ? 'rounded-t-lg' : '' } ${ idx == displayedResults.length - 1 ? 'rounded-b-lg' : '' } ${ !excluded ? 'bg-gray-100' : 'bg-red-300' }` }>
                  <Link key={ idx } href={ `/politician/${ politician.name }` }>
                    <a>
                      <div className={ `flex flex-row items-center rounded-lg ${ !excluded ? 'hover:bg-gray-300' : 'hover:bg-red-400' } cursor-pointer p-3` }>
                        { !excluded ? politician.ranking : (
                          politician.rating.low_confidence ? '???' : '——'
                        ) }.
                        <SparkLine className='mx-2' contests={ politician.rating_history }/>
                        <Rating rating={ politician.rating.mu }/>
                        <div className='w-3 h-3 mx-2' style={
                          { backgroundColor: partyToColor(politician.party) }
                        }/>
                        { politician.name }
                      </div>
                    </a>
                  </Link>
                </li>
              );
            })
          }
        </ul>
      </div>
      <div className='flex flex-row justify-around text-md md:text-lg text-center font-big-noodle w-full mb-5'>
        <span>* Ratings are technically calculated using Trueskill, not ELO</span>
        <span>** Ratings are purely for entertainment purposes</span>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const db = await connectToDatabase(process.env.MONGODB_URI);

  const collection = await db.collection('politicians');
  const topPoliticians = await collection
    .aggregate([
      { $sort: { 'ranking': 1 } },
      { $limit: 100 },
      { $project: { '_id': 0, 'rating_history': { 'contest_id': 0 } } }
    ])
    .toArray();

  return {
    props: {
      topPoliticians
    }
  };
}

export default HomePage;
