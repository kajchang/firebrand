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
      { $match: {
        'name': { $regex: new RegExp((req.query.search as string).replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&'), 'gi') }
      } },
      { $limit: 100 },
      { $project: { '_id': 0, 'contests': { '_id': 0 } } }
    ])
    .toArray();

  res.status(200).json({ results });
}
