import React from 'react';

const Home: React.FunctionComponent = () => {
  return (
    <div className='flex flex-row items-center text-white bg-gray-700'>
        <img src='/badges/rank-BronzeTier.png' alt='Bronze' height={ 64 } width={ 64 }/>
        <span className='rating text-2xl'>1400</span>
    </div>
  );
}

export default Home;
