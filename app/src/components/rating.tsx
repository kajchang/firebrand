import React from 'react';

type RatingProps = {
  rating: number
};

const TIERS = {
  'Bronze': 1000,
  'Silver': 1500,
  'Gold': 2000,
  'Platinum': 2250,
  'Master': 2500,
  'Grandmaster': Infinity
};

const Rating: React.FunctionComponent<RatingProps> = ({ rating }) => {
  const tier = Object.keys(TIERS).find(tier => TIERS[tier] >= rating);

  return (
    <div className='flex flex-row items-center'>
      <img src={ `/badges/rank-${ tier }Tier.png` } alt='tier' height={ 45 } width={ 45 } className='mr-1'/>
      <i className={ `text-3xl ml-1 text-${ tier }` }>{ Math.round(rating) }</i>
    </div>
  );
}

export default Rating;
