import React from 'react';

import { connectToDatabase } from '@/utils/db';

import { Politician } from '@/types';

type HomePageProps = {
  topPoliticians: Politician[]
};

const HomePage: React.FunctionComponent<HomePageProps> = ({ topPoliticians }) => {
  console.log(topPoliticians);

  return (
    <div className='flex flex-col items-center bg-gray-200 min-h-screen'>
      <div className='text-center bg-white w-full py-5' style={ { borderTop: 'rgb(191,13,62) solid 45px', borderBottom: 'rgb(10,49,97) solid 45px' } }>
        <div className='flex flex-row items-center justify-center'>
          <span className='text-2xl text-flag-blue'>★</span>
          <h1 className='text-6xl text-bold text-yellow-400 font-big-star uppercase leading-none px-5'>
            Firebrand
          </h1>
          <span className='text-2xl text-flag-blue'>★</span>
        </div>
        <h3 className='text-xl text-flag-red font-big-star'>ELO* Ratings for U.S. Politicians</h3>
      </div>
      <h3 className='text-3xl text-center font-big-star w-3/4 py-1 my-2' style={ { borderBottom: 'black solid 5px' } }>Top Rated Politicians</h3>
      <div className='flex flex-row justify-around font-big-noodle w-3/4 my-1'>
        <span>* Ratings are technically calculated using Trueskill, not ELO</span>
        <span>** Ratings are purely for entertainment purposes</span>
      </div>
      <div className='rounded-lg bg-gray-100 font-big-noodle w-5/6 my-5'>
        <ul>
          {
            topPoliticians.map((politician, idx) => (
              <li key={ idx } className='flex flex-row items-center rounded-lg hover:bg-gray-300 cursor-pointer text-2xl p-3'>
                { idx + 1 }.
                <img src='/badges/rank-GrandmasterTier.png' height={ 50 } width={ 50 } className='mx-1'/>
                <i className='text-outlined text-white text-3xl mr-3'>{ Math.round(politician.contests[0].rating.mu) }</i>{ politician.name }
              </li>
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
    .find({}).limit(100)
    .sort({ 'contests.rating.mu': -1 })
    .project({ 'contests': { $slice: -1 }, 'contests._id': 0, '_id': 0 })
    .toArray();

  return {
    props: {
      topPoliticians
    }
  };
}

export default HomePage;
