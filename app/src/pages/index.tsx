import React, { useEffect, useState, useRef } from 'react'

import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'

import dayjs from 'dayjs'

import Header from '@/components/header'
import Rating from '@/components/rating'
import SparkLine from '@/components/sparkline'

import { connectToDatabase } from '@/utils/db'

import { Politician } from '@/types'

type HomePageProps = {
	topPoliticians: Politician[]
	lastUpdatedDate: string
}

const HomePage: React.FunctionComponent<HomePageProps> = ({ topPoliticians, lastUpdatedDate }) => {
	const [search, setSearch] = useState('')
	const [searchResults, setSearchResults] = useState([])
	const fetchingTimeout = useRef(null)

	useEffect(() => {
		if (search == '') return
		if (fetchingTimeout.current != null) {
			clearTimeout(fetchingTimeout.current)
			fetchingTimeout.current = null
		}

		let canceled = false

		fetchingTimeout.current = setTimeout(() => {
			fetch('/api/politicians?search=' + search).then(async (res) => {
				if (canceled) return // prevent race
				const data = await res.json()
				setSearchResults(data.results)
			})
			fetchingTimeout.current = null
		}, 100)

		return () => (canceled = true)
	}, [search])

	const displayedResults: Politician[] = search != '' ? searchResults : topPoliticians

	return (
		<div className="flex flex-col items-center bg-gray-200 min-h-screen">
			<Head>
				<title>Firebrand - Power Ratings for U.S. Politicians</title>
			</Head>
			<Header
				headerChildren="Firebrand"
				tagLineChildren={
					<span>
						Power Ratings for US Politicians
						<br />
						Last Updated: {dayjs(lastUpdatedDate).format('M/D/YY')}{' '}
						<span className="font-serif">·</span>{' '}
						<a
							className="text-flag-blue"
							href="https://github.com/kajchang/firebrand"
							target="_blank"
							rel="noopener referer noreferrer"
						>
							Source
						</a>
					</span>
				}
				tagLineProps={{ className: 'text-flag-red' }}
			/>
			<input
				className="rounded-lg text-2xl font-big-noodle w-5/6 px-5 py-3 my-5"
				placeholder="Search..."
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			<div className="text-xl md:text-2xl font-big-noodle w-5/6 mb-5">
				<ul>
					{displayedResults.map((politician, idx) => {
						const excluded = politician.rating.low_confidence || politician.retired

						return (
							<li
								key={idx}
								className={`${idx == 0 ? 'rounded-t-lg' : ''} ${
									idx == displayedResults.length - 1 ? 'rounded-b-lg' : ''
								} ${!politician.rating.low_confidence ? 'bg-gray-100' : 'bg-red-300'}`}
							>
								<Link key={idx} href={`/politician/${politician._id}`}>
									<a>
										<div
											className={`flex flex-row items-center rounded-lg ${
												!politician.rating.low_confidence ? 'hover:bg-gray-300' : 'hover:bg-red-400'
											} cursor-pointer p-3`}
											title={politician.name}
										>
											{!excluded && politician.previous_ranking != politician.ranking ? (
												politician.previous_ranking ? (
													politician.ranking < politician.previous_ranking ? (
														<span
															className="text-green-500 font-sans text-lg mr-1"
															title={`+${politician.previous_ranking - politician.ranking}`}
														>
															▲
														</span>
													) : (
														<span
															className="text-red-500 align-middle font-sans text-lg mr-1"
															title={(politician.previous_ranking - politician.ranking).toString()}
														>
															▼
														</span>
													)
												) : (
													<span className="text-blue-500 align-middle font-sans text-sm mr-1">
														●
													</span>
												)
											) : (
												<div className="mx-2" />
											)}
											{!excluded
												? politician.ranking
												: politician.rating.low_confidence
												? '???'
												: '——'}
											.
											<SparkLine className="mx-2" ratingHistory={politician.rating_history} />
											<Rating rating={politician.rating.mu} size="lg" />
											<div
												title={politician.party.name}
												className="w-3 h-3 mx-2"
												style={{ backgroundColor: politician.party.color }}
											/>
											{politician.name}
										</div>
									</a>
								</Link>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

export const getStaticProps: GetStaticProps = async () => {
	const db = await connectToDatabase(process.env.MONGODB_URI)

	const politiciansCol = await db.collection('politicians')
	const metadataCol = await db.collection('metadata')

	const topPoliticians = await politiciansCol
		.aggregate([
			{ $sort: { ranking: 1 } },
			{ $limit: 100 },
			{ $project: { rating_history: { contest_id: 0 } } },
		])
		.toArray()
	const lastUpdatedDate = (
		(await metadataCol.findOne({ name: 'transfer_date' })).value as Date
	).toISOString()

	return {
		props: {
			topPoliticians,
			lastUpdatedDate,
		},
	}
}

export default HomePage
