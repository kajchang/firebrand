import React, { useMemo } from 'react'

import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Error from 'next/error'
import Link from 'next/link'

import Header from '@/components/header'
import Rating from '@/components/rating'
import RatingChart from '@/components/ratingchart'

import { connectToDatabase } from '@/utils/db'
import { isWebUri } from 'valid-url'
import dayjs from 'dayjs'

import { Contest, Politician } from '@/types'

type ContestListItemProps = {
	politician: Politician
	contest: Contest
	ratingDelta: number
}

const ContestListItem: React.FunctionComponent<ContestListItemProps> = ({
	politician,
	contest,
	ratingDelta,
}) => {
	const [open, setOpen] = React.useState(false)

	const candidates = useMemo(
		() =>
			contest.candidates.sort((a, b) => {
				if (contest.upcoming) {
					if (a._id == politician._id) {
						return -1
					} else if (b._id == politician._id) {
						return 1
					} else {
						return contest.candidates.indexOf(a) - contest.candidates.indexOf(b)
					}
				} else {
					return b.votes - a.votes
				}
			}),
		[contest, politician._id]
	)

	return (
		<li
			className="flex flex-col rounded-lg text-xl md:text-2xl p-3"
			title={`${contest.name} - ${dayjs(contest.date).format('MMMM Do YYYY')}`}
		>
			<div className="flex flex-row items-center">
				<span
					className={
						(ratingDelta > 0
							? 'text-green-500'
							: ratingDelta == 0
							? 'text-gray-500'
							: 'text-red-500') + ' mr-2'
					}
				>
					{ratingDelta > 0 ? '+' : ''}
					{Math.round(ratingDelta)}
				</span>
				<div
					onClick={() => setOpen(!open)}
					className="flex flex-row items-center cursor-pointer select-none"
				>
					<span className={`text-rotatable ${open ? 'text-rotated-down' : ''} mr-1`}>▸</span>{' '}
					{contest.name}
				</div>
			</div>
			{open ? (
				<div className="text-sm md:text-lg">
					<table className="table-fixed p-3">
						<thead className="font-sans">
							<tr className="border-b-2 border-black">
								<th colSpan={2} className="font-normal px-8 py-2">
									Candidate
								</th>
								<th className="font-normal px-4 py-2">Votes</th>
							</tr>
						</thead>
						<tbody className="font-serif">
							{candidates
								.slice(
									0,
									Math.max(
										5,
										candidates.findIndex((candidate) => candidate.name.includes(politician.name)) +
											1
									)
								)
								.map((candidate, idx) => (
									<tr
										key={idx}
										className={`border-t ${candidate.name == politician.name ? 'bg-gray-300' : ''}`}
									>
										<td className="w-4" style={{ background: candidate.party.color }} />
										<td className="px-4 py-2">
											{candidate.name}
											{candidate.incumbent ? <i> (Incumbent)</i> : ''}
											{candidate.won ? <span className="text-green-500 ml-1">✓</span> : null}
										</td>
										<td className="px-4 py-2">
											{candidate.votes > 1 ? candidate.votes.toLocaleString() : '—'}
										</td>
									</tr>
								))}
						</tbody>
					</table>
					<span className="font-sans text-sm">
						{contest.source ? (
							<>
								Primary Source:{' '}
								{isWebUri(contest.source) ? (
									<a
										href={contest.source}
										target="_blank"
										rel="noopener noreferrer"
										className="text-link"
									>
										{new URL(contest.source).hostname}
									</a>
								) : (
									<span dangerouslySetInnerHTML={{ __html: contest.source }} />
								)}
								<br />
								Secondary{' '}
							</>
						) : null}
						Source:{' '}
						<a
							href={`https://www.ourcampaigns.com/RaceDetail.html?RaceID=${contest._id}`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-link"
						>
							ourcampaigns.com
						</a>
					</span>
				</div>
			) : null}
		</li>
	)
}

type PoliticianWithDetailedContests = Politician & { full_contests: Contest[] }

type PoliticianPageProps = {
	politician?: PoliticianWithDetailedContests
}

const PoliticianPage: React.FunctionComponent<PoliticianPageProps> = ({
	politician = {
		_id: 0,
		name: '',
		rating: { mu: 0, sigma: 0, low_confidence: false },
		ranking: 0,
		last_ran_in: dayjs().year(),
		retired: false,
		party: { name: '', color: '' },
		previous_ranking: null,
		rating_history: [],
		full_contests: [],
	},
}) => {
	const sortedFullContests = useMemo(
		() =>
			politician.full_contests.sort(
				(a, b) =>
					politician.rating_history.findIndex((contest) => contest.contest_id == a._id) -
					politician.rating_history.findIndex((contest) => contest.contest_id == b._id)
			),
		[politician]
	)

	const excluded = politician.rating.low_confidence || politician.retired

	return (
		<div className="flex flex-col items-center bg-gray-200 min-h-screen">
			<Head>
				<title>{politician.name}</title>
				<meta
					property="og:description"
					content={`${politician.name} has a power rating of ${politician.rating.mu.toFixed()}${
						!excluded ? ` and is ranked #${politician.ranking}` : ''
					}`}
				/>
			</Head>
			<Header
				headerChildren={politician.name}
				tagLineChildren={
					<div className="flex flex-col items-center">
						{politician.party.name}
						<Rating rating={politician.rating.mu} size="lg" />
					</div>
				}
				tagLineProps={{ style: { color: politician.party.color } }}
				topRowChildren={
					<Link href="/">
						<a className="text-white font-bold ml-3">← Back</a>
					</Link>
				}
			/>
			{excluded ? (
				<div className="rounded-lg bg-red-300 text-center text-xl md:text-2xl font-big-noodle w-5/6 p-3 my-3">
					This politician is unranked because{' '}
					{politician.rating.low_confidence
						? 'this rating has a low confidence'
						: `they have not run since ${politician.last_ran_in}`}
				</div>
			) : null}
			{sortedFullContests.length > 1 ? (
				<RatingChart contests={sortedFullContests} ratingHistory={politician.rating_history} />
			) : null}
			<div className="font-big-noodle w-5/6 mb-5">
				<ul>
					{Object.entries(
						sortedFullContests
							// group contests by year
							.reduce((groups: object, contest): object => {
								const group = contest.upcoming
									? 'Upcoming'
									: String(new Date(contest.date).getFullYear())
								if (!Object.keys(groups).includes(group)) {
									groups[group] = []
								}
								groups[group].push(contest)
								return groups
							}, {})
					)
						// sort groups by year
						.sort((a, b) => {
							if (a[0] == 'Upcoming') {
								return -1
							} else if (b[0] == 'Upcoming') {
								return 1
							}
							return Number(b[0]) - Number(a[0])
						})
						.map(([year, contests]: [string, Contest[]], idx) => (
							<div key={idx}>
								<h3 className="text-4xl ml-2">{year}</h3>
								<div className="rounded-lg bg-gray-100">
									{contests.reverse().map((contest, idx) => (
										<ContestListItem
											key={idx}
											politician={politician}
											contest={contest}
											ratingDelta={
												politician.rating_history[politician.full_contests.indexOf(contest) + 1]
													.rating.mu -
												politician.rating_history[politician.full_contests.indexOf(contest)].rating
													.mu
											}
										/>
									))}
								</div>
							</div>
						))}
				</ul>
			</div>
		</div>
	)
}

export const getStaticPaths: GetStaticPaths<{ id: string }> = async () => {
	return {
		paths: [],
		fallback: true,
	}
}

export const getStaticProps: GetStaticProps<PoliticianPageProps, { id: string }> = async (
	context
) => {
	const { params } = context

	const db = await connectToDatabase(process.env.MONGODB_URI)

	const collection = await db.collection('politicians')
	const politician = (
		await collection
			.aggregate([
				{ $match: { _id: parseInt(params.id as string) } },
				{
					$lookup: {
						from: 'contests',
						localField: 'rating_history.contest_id',
						foreignField: '_id',
						as: 'full_contests',
					},
				},
			])
			.toArray()
	)[0]

	if (typeof politician == 'undefined') {
		return {
			props: {},
			notFound: true,
		}
	}

	politician.full_contests.forEach((contest) => {
		contest.date = contest.date.toISOString()
	})

	return {
		props: {
			politician: politician,
		},
	}
}

export default PoliticianPage
