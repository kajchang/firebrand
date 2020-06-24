import React, { useMemo } from 'react';

import { RatedContest } from '@/types';

type SparkLineProps = {
  className: string
  ratingHistory: RatedContest[]
};

const SparkLine: React.FunctionComponent<SparkLineProps> = ({ className, ratingHistory }) => {
  const chartWidth = 25;
  const chartHeight = 20;

  const peakRating = useMemo(
    () => ratingHistory.reduce((max, historyInstance) => historyInstance.rating.mu > max ? historyInstance.rating.mu : max, 0),
    [ratingHistory]
  );
  const minimumRating = useMemo(
    () => ratingHistory.reduce((min, historyInstance) => historyInstance.rating.mu < min ? historyInstance.rating.mu : min, Infinity),
    [ratingHistory]
  );

  const floorRating = minimumRating * 0.8;

  const barWidth = chartWidth / ratingHistory.length;

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
        ratingHistory.map((contest, idx) => (
          <g
            key={ idx } transform={ `translate(${ idx * barWidth }, 0)` }
            className={ colorFromDelta(idx != 0 ? contest.rating.mu - ratingHistory[idx - 1].rating.mu : 0) }
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
