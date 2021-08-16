import React from 'react'

type HeaderProps = {
	headerChildren: React.ReactChild
	headerProps?: React.HTMLAttributes<HTMLHeadingElement>
	tagLineChildren: React.ReactChild
	tagLineProps?: React.HTMLAttributes<HTMLHeadingElement>
	topRowChildren?: React.ReactChild
	bottomRowChildren?: React.ReactChild
}

const Header: React.FunctionComponent<HeaderProps> = ({
	headerChildren,
	headerProps = {},
	tagLineChildren,
	tagLineProps = {},
	topRowChildren = [],
	bottomRowChildren = [],
}) => {
	return (
		<>
			<div
				className="flex flex-row items-center h-12 w-full"
				style={{ background: 'rgb(191,13,62)' }}
			>
				{topRowChildren}
			</div>
			<div className="text-center bg-white w-full py-5">
				<div className="flex flex-row items-center justify-center">
					<span className="text-2xl text-flag-blue mx-2">★</span>
					<h1
						{...headerProps}
						className={
							'flex flex-row  items-center justify-center text-5xl md:text-6xl text-bold text-yellow-400 font-big-star uppercase leading-none mx-3 ' +
							headerProps.className
						}
					>
						{headerChildren}
					</h1>
					<span className="text-2xl text-flag-blue mx-2">★</span>
				</div>
				<h3
					{...tagLineProps}
					className={
						'flex flex-row items-center justify-center text-lg md:text-xl font-big-star ' +
						tagLineProps.className
					}
				>
					{tagLineChildren}
				</h3>
			</div>
			<div className="h-12 w-full" style={{ background: 'rgb(10,49,97)' }}>
				{bottomRowChildren}
			</div>
		</>
	)
}

export default Header
