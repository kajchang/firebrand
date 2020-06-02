import React from 'react';

type RatingProps = {
  rating: number
};

const Rating: React.FunctionComponent<RatingProps> = ({ rating }) => {
  return (
    <div className='flex flex-row items-center mx-1'>
      <img src='/badges/rank-GrandmasterTier.png' alt='rank' height={ 50 } width={ 50 } className='mr-1'/>
      <i className='text-outlined text-white text-3xl ml-1'>{ Math.round(rating) }</i>
    </div>
  );
}

export default Rating;
