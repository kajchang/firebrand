// https://vercel.com/guides/deploying-a-mongodb-powered-api-with-node-and-vercel

import url from 'url'
import { MongoClient } from 'mongodb'

let cachedDb = null

export async function connectToDatabase(uri) {
	if (cachedDb) {
		return cachedDb
	}

	const client = await MongoClient.connect(uri, { useNewUrlParser: true })

	const db = await client.db('firebrand')

	cachedDb = db
	return db
}
