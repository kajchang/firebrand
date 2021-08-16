import React from 'react'

import Image from 'next/image'

type RatingProps = {
	rating: number
	size: 'sm' | 'md' | 'lg'
}

export const TIERS = {
	Bronze: 0,
	Silver: 1000,
	Gold: 1500,
	Platinum: 2000,
	Master: 2250,
	Grandmaster: 2500,
}

const COMPONENT_SIZES = {
	sm: {
		textClassName: 'text-md',
		iconSize: 20,
	},
	md: {
		textClassName: 'text-xl',
		iconSize: 30,
	},
	lg: {
		textClassName: 'text-3xl ml-2',
		iconSize: 45,
	},
}

const Rating: React.FunctionComponent<RatingProps> = ({ rating, size }) => {
	const tier = Object.keys(TIERS)
		.reverse()
		.find((tier) => TIERS[tier] <= rating)

	const { textClassName, iconSize } = COMPONENT_SIZES[size]

	return (
		<div className="flex flex-row items-center">
			<Image
				layout="fixed"
				src={`/badges/rank-${tier}Tier.png`}
				alt={`${tier} Tier`}
				height={iconSize}
				width={iconSize}
			/>
			<i className={`${textClassName} text-${tier}`}>{Math.round(rating)}</i>
		</div>
	)
}

export default Rating
