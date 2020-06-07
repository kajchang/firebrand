import React from 'react';

import { RatedContest } from '@/types';

type SparkLineProps = {
  className: string;
  contests: RatedContest[];
};

const SparkLine: React.FunctionComponent<SparkLineProps> = ({ className, contests }) => {
  const chartWidth = 25;
  const chartHeight = 20;

  const peakRating = contests.reduce((acc, cur) => cur.rating.mu > acc ? cur.rating.mu : acc, 0);
  const minimumRating = contests.reduce((acc, cur) => cur.rating.mu < acc ? cur.rating.mu : acc, Infinity);

  const maxDelta = Math.max(
    ...contests.slice(1).map((contest, idx) => contest.rating.mu - contests[idx].rating.mu)
  );

  const floorRating = minimumRating * 0.8;

  const barWidth = chartWidth / contests.length;

  function colorFromDelta(delta: number): string {
    if (delta == 0) {
      return 'text-gray-500';
    } else if (delta > 0) {
      return 'text-green-600';
    } else {
      return 'text-red-600';
    }
  }

  return (
    <svg
      version='1.1' width={ chartWidth } height={ chartHeight }
      viewBox={ `0 0 ${ chartWidth } ${ chartHeight }` } className={ className }
    >
      {
        contests.map((contest, idx) => (
          <g
            key={ idx } transform={ `translate(${ idx * barWidth }, 0)` }
            className={ colorFromDelta(idx != 0 ? contest.rating.mu - contests[idx - 1].rating.mu : 0) }
          >
            <rect
              stroke='none'
              height={ (contest.rating.mu - floorRating) / (peakRating - floorRating) * chartHeight }
              y={ chartHeight - (contest.rating.mu - floorRating) / (peakRating - floorRating) * chartHeight }
              width={ barWidth }
              className='fill-current'
            />
          </g>
        ))
      }
    </svg>
  );
}

export default SparkLine;
