import React from 'react';

import Head from 'next/head';
import Link from 'next/link';

import Header from '@/components/header';
import Rating from '@/components/rating';

import { connectToDatabase } from '@/utils/db';
import { partyToColor } from '@/utils/helpers';

import { Politician, Contest } from '@/types';
import SparkLine from "@/components/sparkline";

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
      <div className='rounded-lg bg-yellow-500 text-center text-xl md:text-2xl font-big-noodle w-5/6 p-3 my-5'>
        Warning: Most data are automatically collected and may be inaccurate
      </div>
      <input
        className='rounded-lg text-2xl font-big-noodle w-5/6 px-5 py-3'
        placeholder='Search...' value={ search }
        onChange={ e => setSearch(e.target.value) }
      />
      <div className='font-big-noodle w-5/6 my-5'>
        <ul>
          {
            displayedResults.map((politician, idx) => (
              <li className={ `${ idx == 0 ? 'rounded-t-lg' : '' } ${ idx == displayedResults.length - 1 ? 'rounded-b-lg' : '' } bg-${ politician.ranked ? 'gray-100' : 'red-300' }` }>
                <Link key={ idx } href={ `/politician/${ politician.name }` }>
                  <a>
                    <div className={ `flex flex-row items-center rounded-lg hover:bg-${ politician.ranked ? 'gray-300' : 'red-400' } cursor-pointer text-2xl p-3` }>
                      { politician.ranked ? politician.ranking : '???' }.
                      <SparkLine className='mx-2' contests={ politician.contests }/>
                      <Rating rating={ politician.rating.mu }/>
                      <div className='w-3 h-3 mx-2' style={
                        { backgroundColor: partyToColor(politician.party) }
                      }/>
                      { politician.name }
                    </div>
                  </a>
                </Link>
              </li>
            ))
          }
        </ul>
      </div>
      <div className='flex flex-row justify-around font-big-noodle w-3/4 mb-5'>
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
      { $project: { '_id': 0, 'contests': { '_id': 0 } } }
    ])
    .toArray();

  return {
    props: {
      topPoliticians
    }
  };
}

export default HomePage;
