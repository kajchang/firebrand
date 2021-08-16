import { NextApiRequest, NextApiResponse } from 'next';

import { connectToDatabase } from '@/utils/db';


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (typeof req.query.search == 'undefined') {
    res.status(400).json({ error: 'Must provide a "search" parameter' });
  }

  const db = await connectToDatabase(process.env.MONGODB_URI);

  const collection = await db.collection('politicians');

  const search = (req.query.search as string).replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

  const results = await collection
    .aggregate([
      { $sort: { 'ranking': 1 } },
      { $match: {
        $or: [
          { 'searchable_name': { $regex: new RegExp(search, 'gi') } },
          { 'name': { $regex: new RegExp(search, 'gi') } }
        ]
      } },
      { $limit: 100 },
      { $project: { 'rating_history': { 'contest_id': 0 } } }
    ])
    .toArray();

  res.status(200).json({ results });
}

export default handler
