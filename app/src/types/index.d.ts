type Candidate = {
  name: string
  votes: number|null
  won: boolean
  incumbent: boolean|null
  party: string|null
}

export type Contest = {
  _id: string
  name: string
  year: number
  candidates: Candidate[]
}

type Rating = {
  mu: number
  sigma: number
}

type RatedContest = {
  _id: string
  rating: Rating
}

export type Politician = {
  _id: string
  name: string
  rating: Rating
  ranking: number
  contests: RatedContest[]
}
