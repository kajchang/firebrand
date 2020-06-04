import { NextApiRequest, NextApiResponse } from 'next';

import { connectToDatabase } from '@/utils/db';


export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (typeof req.query.search == 'undefined') {
    res.status(400).json({ error: 'Must provide a "search" parameter' });
  }

  const db = await connectToDatabase(process.env.MONGODB_URI);

  const collection = await db.collection('politicians');

  const results = await collection
    .aggregate([
      { $sort: { 'ranking': 1 } },
      { $match: { 'name': { $regex: new RegExp(req.query.search as string, 'gi') } } },
      { $limit: 100 },
      { $project: { 'name': 1, 'rating': 1, 'ranking': 1, 'ranked': 1, 'latestContest': { $arrayElemAt : ['$contests', -1] } } },
      {
        $lookup: {
          'from': 'contests',
          localField: 'latestContest._id',
          foreignField: '_id',
          'as': 'latestContest'
        }
      },
      { $project: { 'name': 1, 'rating': 1, 'ranking': 1, 'ranked': 1, 'latestContest': { $arrayElemAt : ['$latestContest', 0] } } },
      { $project: { '_id': 0, 'latestContest': { '_id': 0, 'date': 0 } } }
    ])
    .toArray();

  res.status(200).json({ results });
}
