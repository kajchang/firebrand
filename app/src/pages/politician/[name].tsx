import React from 'react';

import Head from 'next/head';
import Error from 'next/error';
import Link from 'next/link';
import { useRouter } from 'next/router';

import Header from '@/components/header';
import Rating from '@/components/rating';

import { connectToDatabase } from '@/utils/db';
import { partyToColor } from '@/utils/helpers';

import { Contest, Politician } from '@/types';
import { NextPageContext } from 'next';

type PoliticianWithDetailedContests = Politician & { fullContests: Contest[] };

type PoliticianPageProps = {
  err: { statusCode: number }
  politician: PoliticianWithDetailedContests
};

const PoliticianPage: React.FunctionComponent<PoliticianPageProps> = ({ err, politician }) => {
  const router = useRouter();
  const { name } = router.query;

  if (err) {
    return <Error statusCode={ err.statusCode }/>
  }

  let party = politician
    .fullContests[politician.fullContests.length - 1]
    .candidates.find(candidate => candidate.name.includes(name as string)).party;
  if (party == null) {
    party = 'None';
  } else {
    party = party.split(/\s+/).join(' ');
  }

  function styleRatingDelta(ratingDelta) {
    return (
      <span className={ 'text-' + (ratingDelta > 0 ? 'green' : 'red') + '-500 mr-2' }>
        { ratingDelta > 0 ? '+' : '' }{ Math.round(ratingDelta) }
      </span>
    );
  }

  return (
    <div className='flex flex-col items-center bg-gray-200 min-h-screen'>
      <Head>
        <title>{ name }</title>
      </Head>
      <Header
        headerChildren={ name as string }
        tagLineChildren={ <div className='flex flex-col'>
          { party }
          <Rating rating={ politician.rating.mu }/>
        </div> }
        tagLineProps={ { style: { color: partyToColor(party) } } }
        topRowChildren={ <Link href='/'><a className='text-white font-bold ml-3'>← Back</a></Link> }
      />
      <div className='font-big-noodle w-5/6 my-5'>
        <ul>
          {
            Object.entries(politician.fullContests
              .sort((a, b) => politician.contests.findIndex(contest => contest._id == a._id) - politician.contests.findIndex(contest => contest._id == b._id))
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
                        <li key={ idx } className='flex flex-row items-center rounded-lg text-2xl p-3'>
                          { styleRatingDelta(
                            politician.contests[politician.fullContests.indexOf(contest) + 1].rating.mu -
                            politician.contests[politician.fullContests.indexOf(contest)].rating.mu
                          ) }
                          { contest.name }
                        </li>
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
      { $project: { 'name': 0, '_id': 0 } },
      {
        $lookup: {
          'from': 'contests',
          localField: 'contests._id',
          foreignField: '_id',
          'as': 'fullContests'
        }
      }
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

  politician.contests.forEach(contest => {
    if (contest._id != null) {
      contest._id = contest._id.toString();
    }
  });
  politician.fullContests.forEach(contest => {
    contest._id = contest._id.toString();
  });

  return {
    props: {
      politician: politician
    }
  };
}

export default PoliticianPage;
