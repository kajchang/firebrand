import React from 'react';

const SparkLine = ({ className, contests }) => {
  const chartWidth = 25;
  const chartHeight = 20;

  const peakRating = contests.reduce((acc, cur) => cur.rating.mu > acc ? cur.rating.mu : acc, 0);
  const minimumRating = contests.reduce((acc, cur) => cur.rating.mu < acc ? cur.rating.mu : acc, Infinity);

  const floorRating = minimumRating * 0.8;

  const barWidth = chartWidth / contests.length;

  return (
    <svg
      version='1.1' width={ chartWidth } height={ chartHeight }
      viewBox={ `0 0 ${ chartWidth } ${ chartHeight }` } className={ className }
    >
      {
        contests.map((contest, idx) => (
          <g
            key={ idx } transform={ `translate(${ idx * barWidth }, 0)` }
            color={
              (idx == 0 || (contest.rating.mu - contests[idx - 1].rating.mu) == 0) ? 'gray' :
                ((contest.rating.mu - contests[idx - 1].rating.mu) > 0 ? 'green' : 'red')
            }
          >
            <rect
              fill='currentColor'
              stroke='none'
              height={ (contest.rating.mu - floorRating) / (peakRating - floorRating) * chartHeight }
              y={ chartHeight - (contest.rating.mu - floorRating) / (peakRating - floorRating) * chartHeight }
              width={ barWidth }
            />
          </g>
        ))
      }
    </svg>
  );
}

export default SparkLine;
