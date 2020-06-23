import React, { useMemo } from 'react';

import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from 'victory';
import Head from 'next/head';
import Error from 'next/error';
import Link from 'next/link';

import Header from '@/components/header';
import Rating, { TIERS } from '@/components/rating';

import { connectToDatabase } from '@/utils/db';
import { isWebUri } from 'valid-url';
import moment from 'moment';

import { Contest, Politician } from '@/types';
import { NextPageContext } from 'next';
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

type ContestListItemProps = {
  politician: Politician
  contest: Contest
  ratingDelta: number
};

const ContestListItem: React.FunctionComponent<ContestListItemProps> = ({ politician, contest, ratingDelta }) => {
  const [open, setOpen] = React.useState(false);

  const candidates = contest.candidates.sort((a, b) => b.votes - a.votes);

  return (
    <li className='flex flex-col rounded-lg text-xl md:text-2xl p-3'>
      <div className='flex flex-row items-center'>
        <span className={ (ratingDelta > 0 ? 'text-green-500' : (ratingDelta == 0 ? 'text-gray-500' : 'text-red-500')) + ' mr-2' }>
          { ratingDelta > 0 ? '+' : '' }{ Math.round(ratingDelta) }
        </span>
        <div onClick={ () => setOpen(!open) } className='flex flex-row items-center cursor-pointer select-none'>
          <span className={ `text-rotatable ${ open ? 'text-rotated-down' : '' } mr-1` }>
            ▸
          </span> { contest.name }
        </div>
      </div>
      {
        open ? (
          <div className='text-sm md:text-lg'>
            <table className='table-fixed p-3'>
              <thead className='font-sans'>
                <tr className='border-b-2 border-black'>
                  <th colSpan={ 2 } className='font-normal w-2/3 px-8 py-2'>Candidate</th>
                  <th className='font-normal w-1/3 px-4 py-2'>Votes</th>
                </tr>
              </thead>
              <tbody className='font-serif'>
              {
                candidates
                  .slice(0, Math.max(5, candidates.findIndex(candidate => candidate.name.includes(politician.name)) + 1))
                  .map((candidate, idx) => (
                    <tr key={ idx } className='border-t'>
                      <td className='px-2 py-2' style={ { background: candidate.party.color } }/>
                      <td className='px-4 py-2'>
                        { candidate.name }
                        { candidate.won ? <span className='text-green-500 ml-1'>✓</span> : null }
                      </td>
                      <td className='px-4 py-2'>{ candidate.votes > 1 ? candidate.votes.toLocaleString() : '—' }</td>
                    </tr>
                  ))
              }
              </tbody>
            </table>
            <span className='font-sans text-sm'>
              { contest.source ? (
                <>
                  Primary Source:{ ' ' }
                  {
                    isWebUri(contest.source) ? (
                      <a
                        href={ contest.source } target='_blank' rel='noopener noreferrer'
                        className='text-link'
                      >
                        { (new URL(contest.source)).hostname }
                      </a>
                    ) : <span dangerouslySetInnerHTML={ { __html: contest.source } }/>
                  }
                  <br/>Secondary{ ' ' }
                </>
              ) : null }
              Source:{ ' ' }
              <a
                href={ `https://www.ourcampaigns.com/RaceDetail.html?RaceID=${ contest._id }` } target='_blank' rel='noopener noreferrer'
                className='text-link'
              >
                ourcampaigns.com
              </a>
            </span>
          </div>
        ) : null
      }
    </li>
  );
}

type PoliticianWithDetailedContests = Politician & { full_contests: Contest[] };

type PoliticianPageProps = {
  err: { statusCode: number }
  politician: PoliticianWithDetailedContests
};

const PoliticianPage: React.FunctionComponent<PoliticianPageProps> = ({ err, politician }) => {
  if (err) {
    return <Error statusCode={ err.statusCode }/>
  }

  const sortedFullContests = useMemo(() => politician.full_contests.sort((a, b) =>
    politician.rating_history.findIndex(contest => contest.contest_id == a._id) -
    politician.rating_history.findIndex(contest => contest.contest_id == b._id)
  ), [politician]);
  const startDate = useMemo(() => moment(sortedFullContests[0].date).subtract(1, 'year'), [sortedFullContests]);
  const endDate = useMemo(() => moment(sortedFullContests[sortedFullContests.length - 1].date), [sortedFullContests]);
  const initalRating = useMemo(() => politician.rating_history[0].rating, [politician]);

  const excluded = useMemo(() => politician.rating.low_confidence || politician.retired, [politician]);

  return (
    <div className='flex flex-col items-center bg-gray-200 min-h-screen'>
      <Head>
        <title>{ politician.name }</title>
      </Head>
      <Header
        headerChildren={ politician.name }
        tagLineChildren={ <div className='flex flex-col items-center'>
          { politician.party.name }
          <Rating rating={ politician.rating.mu } size='lg'/>
        </div> }
        tagLineProps={ { style: { color: politician.party.color } } }
        topRowChildren={ <Link href='/'><a className='text-white font-bold ml-3'>← Back</a></Link> }
      />
      {
        excluded ? (
            <div className='rounded-lg bg-red-300 text-center text-xl md:text-2xl font-big-noodle w-5/6 p-3 my-3'>
              This politician is unranked because{' '}
              { politician.rating.low_confidence ? (
                'this rating has a low confidence'
              ) : (`they have not run since ${ politician.last_ran_in }`) }
            </div>
        ) : null
      }
      {
        sortedFullContests.length > 1 ? (
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
                    sortedFullContests.map(contest => {
                      const rating = politician.rating_history[politician.full_contests.indexOf(contest) + 1].rating;
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
                    sortedFullContests.map(contest => ({
                      x: moment(contest.date).toDate(),
                      y: politician.rating_history[politician.full_contests.indexOf(contest) + 1].rating.mu
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
        ) : null
      }
      <div className='font-big-noodle w-5/6 mb-5'>
        <ul>
          {
            Object.entries(sortedFullContests
              // group contests by year
              .reduce((acc: object, cur): object => {
                const constest_year = new Date(cur.date).getFullYear();
                if (!Object.keys(acc).includes(String(constest_year))) {
                  acc[String(constest_year)] = [];
                }
                acc[String(constest_year)].push(cur);
                return acc;
              }, {})
            )
              // sort groups by year
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([year, contests]: [string, Contest[]], idx) => (
                <div key={ idx }>
                  <h3 className='text-4xl ml-2'>{ year }</h3>
                  <div className='rounded-lg bg-gray-100'>
                    {
                      contests.reverse().map((contest, idx) => (
                        <ContestListItem
                          key={ idx } politician={ politician } contest={ contest }
                          ratingDelta={
                            politician.rating_history[politician.full_contests.indexOf(contest) + 1].rating.mu -
                            politician.rating_history[politician.full_contests.indexOf(contest)].rating.mu
                          }
                        />
                      ))
                    }
                  </div>
                </div>
              ))
          }
        </ul>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const { query } = context;

  const db = await connectToDatabase(process.env.MONGODB_URI);

  const collection = await db.collection('politicians');
  const politician = (await collection
    .aggregate([
      { $match: { '_id': parseInt(query.id as string) } },
      {
        $lookup: {
          'from': 'contests',
          localField: 'rating_history.contest_id',
          foreignField: '_id',
          'as': 'full_contests'
        }
      },
      { $project: { '_id': 0 } }
    ])
    .toArray()
  )[0];

  if (typeof politician == 'undefined') {
    context.res.statusCode = 404;
    return {
      props: {
        err: {
          statusCode: 404
        }
      }
    }
  }

  politician.full_contests.forEach(contest => {
    contest.date = contest.date.toISOString();
  });

  return {
    props: {
      politician: politician
    }
  };
}

export default PoliticianPage;
