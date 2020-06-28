import React from 'react';

import Head from 'next/head';
import Link from 'next/link';

import Header from '@/components/header';
import Rating from '@/components/rating';
import SparkLine from '@/components/sparkline';

import { connectToDatabase } from '@/utils/db';

import { Politician } from '@/types';

type HomePageProps = {
  topPoliticians: Politician[]
};

const HomePage: React.FunctionComponent<HomePageProps> = ({ topPoliticians }) => {
  const [search, setSearch] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const fetchingTimeout = React.useRef(null);

  React.useEffect(() => {
    if (search == '') return;
    if (fetchingTimeout.current != null) {
      clearTimeout(fetchingTimeout.current);
      fetchingTimeout.current = null;
    }

    let canceled = false;

    fetchingTimeout.current = setTimeout(() => {
      fetch('/api/politicians?search=' + search)
        .then(async res => {
          if (canceled) return; // prevent race
          const data = await res.json();
          setSearchResults(data.results);
        });
      fetchingTimeout.current = null;
    }, 100);
  
    return () => (canceled = true);
  }, [search]);

  const displayedResults: Politician[] = search != '' ? searchResults : topPoliticians;

  return (
    <div className='flex flex-col items-center bg-gray-200 min-h-screen'>
      <Head>
        <title>Firebrand - Power Ratings for U.S. Politicians</title>
      </Head>
      <Header headerChildren='Firebrand' tagLineChildren='Power Ratings for US Politicians' tagLineProps={ { className: 'text-flag-red' } }/>
      <input
        className='rounded-lg text-2xl font-big-noodle w-5/6 px-5 py-3 my-5'
        placeholder='Search...' value={ search }
        onChange={ e => setSearch(e.target.value) }
      />
      <div className='text-xl md:text-2xl font-big-noodle w-5/6 mb-5'>
        <ul>
          {
            displayedResults.map((politician, idx) => {
              const excluded = politician.rating.low_confidence || politician.retired;

              return (
                <li
                  key={ idx }
                  className={ `${ idx == 0 ? 'rounded-t-lg' : '' } ${ idx == displayedResults.length - 1 ? 'rounded-b-lg' : '' } ${ !politician.rating.low_confidence ? 'bg-gray-100' : 'bg-red-300' }` }
                >
                  <Link key={ idx } href={ `/politician/${ politician._id }` }>
                    <a>
                      <div
                        className={ `flex flex-row items-center rounded-lg ${ !politician.rating.low_confidence ? 'hover:bg-gray-300' : 'hover:bg-red-400' } cursor-pointer p-3` }
                        title={ `${ politician.name } - ${ politician.party.name }` }
                      >
                        { !excluded ? politician.ranking : (
                          politician.rating.low_confidence ? '???' : '——'
                        ) }.
                        <SparkLine className='mx-2' ratingHistory={ politician.rating_history }/>
                        <Rating rating={ politician.rating.mu } size='lg'/>
                        <div className='w-3 h-3 mx-2' style={
                          { backgroundColor: politician.party.color }
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
      { $project: { 'rating_history': { 'contest_id': 0 } } }
    ])
    .toArray();

  return {
    props: {
      topPoliticians
    }
  };
}

export default HomePage;
