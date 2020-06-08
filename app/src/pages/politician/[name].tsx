import React from 'react';

import Head from 'next/head';
import Error from 'next/error';
import Link from 'next/link';

import Header from '@/components/header';
import Rating from '@/components/rating';

import { connectToDatabase } from '@/utils/db';
import { partyToColor } from '@/utils/helpers';
import { useRouter } from 'next/router';

import { Contest, Politician } from '@/types';
import { NextPageContext } from 'next';

type ContestListItemProps = {
  contest: Contest
  ratingDelta: number
};

const ContestListItem:React.FunctionComponent<ContestListItemProps> = ({ contest, ratingDelta }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <li className='flex flex-col rounded-lg text-xl md:text-2xl p-3'>
      <div className='flex flex-row items-center'>
        <span className={ (ratingDelta > 0 ? 'text-green-500' : (ratingDelta == 0 ? 'text-gray-500' : 'text-red-500')) + ' mr-2' }>
          { ratingDelta > 0 ? '+' : '' }{ Math.round(ratingDelta) }
        </span>
        <div onClick={ () => setOpen(!open) } className='flex flex-row items-center cursor-pointer'>
          <span className={ `text-sm text-rotatable ${ open ? 'text-rotated-down' : '' } mr-1` }>▶</span> { contest.name }
        </div>
      </div>
      {
        open ? (
          <div className='text-sm md:text-lg font-sans'>
            <table className='table-fixed p-3'>
              <thead className='text-center'>
                <tr>
                  <th colSpan={ 2 } className='border w-2/3 p-2'>Candidate</th>
                  <th className='border w-1/3 px-4 py-2'>Votes</th>
                </tr>
              </thead>
              <tbody>
              {
                contest.candidates.slice(0, 5).map((candidate, idx) => (
                  <tr key={ idx }>
                    <td className='border px-2 py-2' style={ { background: partyToColor(candidate.party) } }/>
                    <td className='border px-4 py-2'>
                      { candidate.name }
                      { candidate.won ? <span className='text-green-500 ml-1'>✓</span> : null }
                    </td>
                    <td className='border px-4 py-2'>{ candidate.votes != null ? candidate.votes.toLocaleString() : '—' }</td>
                  </tr>
                ))
              }
              </tbody>
            </table>
            {
              contest.source ? (
                <a
                  href={ contest.source } target='_blank' rel='noopener noreferrer'
                  className='text-blue-500 hover:text-blue-700 font-sans'
                >
                  Source
                </a>
              ) : null
            }
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

  const router = useRouter();
  const { name } = router.query;

  const excluded = politician.rating.low_confidence || politician.retired;

  return (
    <div className='flex flex-col items-center bg-gray-200 min-h-screen'>
      <Head>
        <title>{ name }</title>
      </Head>
      <Header
        headerChildren={ name as string }
        tagLineChildren={ <div className='flex flex-col items-center'>
          { politician.party }
          <Rating rating={ politician.rating.mu }/>
        </div> }
        tagLineProps={ { style: { color: partyToColor(politician.party) } } }
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
      <div className='font-big-noodle w-5/6 mb-5'>
        <ul>
          {
            Object.entries(politician.full_contests
              .sort((a, b) =>
                politician.rating_history.findIndex(contest => contest.contest_id == a._id) -
                politician.rating_history.findIndex(contest => contest.contest_id == b._id)
              )
              .reduce((acc: object, cur): object => {
                if (!Object.keys(acc).includes(String(cur.year))) {
                  acc[String(cur.year)] = [];
                }
                acc[String(cur.year)].push(cur);
                return acc;
              }, {}))
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([year, contests]: [string, Contest[]], idx) => (
                <div key={ idx }>
                  <h3 className='text-4xl ml-2'>{ year }</h3>
                  <div className='rounded-lg bg-gray-100'>
                    {
                      contests.reverse().map((contest, idx) => (
                        <ContestListItem
                          key={ idx } contest={ contest }
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
      { $match: { 'name': query.name } },
      {
        $lookup: {
          'from': 'contests',
          localField: 'rating_history.contest_id',
          foreignField: '_id',
          'as': 'full_contests'
        }
      },
      { $project: { '_id': 0, 'name': 0, 'full_contests': { 'date': 0 } } }
    ])
    .toArray())[0];

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

  politician.rating_history.forEach(entry => {
    if (entry.contest_id != null) {
      entry.contest_id = entry.contest_id.toString();
    }
  });
  politician.full_contests.forEach(contest => {
    contest._id = contest._id.toString();
  });

  return {
    props: {
      politician: politician
    }
  };
}

export default PoliticianPage;
