import React from 'react';

type RatingProps = {
  rating: number
  iconSize?: number
  textClassName?: string
};

export const TIERS = {
  'Bronze': 0,
  'Silver': 1000,
  'Gold': 1500,
  'Platinum': 2000,
  'Master': 2250,
  'Grandmaster': 2500
};

const Rating: React.FunctionComponent<RatingProps> = ({ rating, iconSize = 45, textClassName = 'text-3xl' }) => {
  const tier = Object.keys(TIERS).reverse().find(tier => TIERS[tier] <= rating);

  return (
    <div className='flex flex-row items-center'>
      <img src={ `/badges/rank-${ tier }Tier.png` } alt='tier' height={ iconSize } width={ iconSize }/>
      <i className={ `${ textClassName } text-${ tier }` }>{ Math.round(rating) }</i>
    </div>
  );
}

export default Rating;
