import React, { useMemo } from 'react';

import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from 'victory';
import Rating, { TIERS } from '@/components/rating';

import moment from 'moment';

import { Contest, RatedContest } from '@/types';
import { VictoryLabelProps } from 'victory-core';

const RatingChartLabel: React.FunctionComponent<VictoryLabelProps> = ({ x, y, text }) => {
  return (
    <g transform={`translate(${x - 60}, ${y - 15})`}>
      <foreignObject width={ 100 } height={ 25 }>
        <Rating rating={ parseInt(text as string) } size='sm'/>
      </foreignObject>
    </g>
  );
}

type RatingChartProps = {
  contests: Contest[]
  ratingHistory: RatedContest[]
};

const RatingChart: React.FunctionComponent<RatingChartProps> = ({ contests, ratingHistory }) => {
  const startDate = useMemo(() => moment(contests[0].date).subtract(1, 'year'), [contests]);
  const endDate = useMemo(() => moment(contests[contests.length - 1].date), [contests]);
  const initalRating = ratingHistory[0].rating;

  return (
    <div>
      <VictoryChart theme={ VictoryTheme.grayscale } height={ 300 } width={ 600 } padding={ { left: 80, right: 10, top: 50, bottom: 50 } }>
        <VictoryArea
          interpolation='monotoneX'
          style={ { data: { fill: 'lightgray' } } }
          data={
            [{
              x: startDate.toDate(),
              y: initalRating.mu + 2 * initalRating.sigma,
              y0: initalRating.mu - 2 * initalRating.sigma
            }].concat(
              contests.map(contest => {
                const rating = ratingHistory[contests.indexOf(contest) + 1].rating;
                return {
                  x: moment(contest.date).toDate(),
                  y: rating.mu + 2 * rating.sigma,
                  y0: rating.mu - 2 * rating.sigma
                };
              })
            )
          }
        />
        <VictoryLine
          interpolation='monotoneX'
          data={
            [{
              x: startDate.toDate(),
              y: initalRating.mu
            }].concat(
              contests.map(contest => ({
                x: moment(contest.date).toDate(),
                y: ratingHistory[contests.indexOf(contest) + 1].rating.mu
              }))
            )
          }
        />
        <VictoryAxis
          scale='time'
          domain={ [startDate.toDate(), endDate.toDate()] }
          tickCount={ Math.min(7, endDate.year() - startDate.year()) }
          tickFormat={ (ts: number): number => moment(ts).year() }
        />
        <VictoryAxis
          dependentAxis
          tickValues={ Object.values(TIERS).slice(1) }
          domain={ [0, 3000] }
          tickLabelComponent={ <RatingChartLabel/> }
        />
        {
          Object.values(TIERS)
            .slice(1)
            .map((minTierRating, idx) => (
              <VictoryLine
                key={ idx }
                style={ { data: { strokeDasharray: '5,5' } } }
                data={
                  [
                    { x: startDate, y: minTierRating },
                    { x: endDate, y: minTierRating }
                  ]
                }
              />
            ))
        }
      </VictoryChart>
    </div>
  );
}

export default RatingChart;
