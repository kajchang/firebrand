import React from 'react';

const Home: React.FunctionComponent = () => {
  return (
    <div className='bg-gray-200 min-h-screen'>
      <div className='text-center bg-white py-5' style={ { borderTop: 'rgb(191,13,62) solid 45px', borderBottom: 'rgb(10,49,97) solid 45px' } }>
        <div className='flex flex-row items-center justify-center'>
          <span className='text-2xl text-flag-blue'>★</span>
          <h1 className='text-6xl text-bold text-yellow-400 font-big-star uppercase leading-none px-5'>
            Firebrand
          </h1>
          <span className='text-2xl text-flag-blue'>★</span>
        </div>
        <h3 className='text-xl text-flag-red font-big-star'>ELO Ratings for U.S. Politicians</h3>
      </div>
      <h3 className='text-3xl text-center font-big-star py-3'>Top Politicians</h3>
      <div className='rounded-lg bg-gray-100 w-5/6 mx-auto'>
        <ul>
          <li className='flex flex-row items-center rounded-lg hover:bg-gray-300 cursor-pointer text-2xl p-3'>
            <img src='/badges/rank-GrandmasterTier.png' height={ 50 } width={ 50 }/>
            <span className='text-outlined text-white text-3xl font-big-noodle mr-5'>3700</span>Bernie Sanders
          </li>
          <li className='flex flex-row items-center rounded-lg hover:bg-gray-300 cursor-pointer text-2xl p-3'>
            <img src='/badges/rank-GrandmasterTier.png' height={ 50 } width={ 50 }/>
            <span className='text-outlined text-white text-3xl font-big-noodle mr-5'>3655</span>Barack Obama
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Home;
