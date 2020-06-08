type Candidate = {
  name: string
  votes: number|null
  won: boolean
  incumbent: boolean
  party: string
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
  contest_id: string
  rating: Rating
}

export type Politician = {
  _id: string
  name: string
  rating: Rating & { low_confidence: boolean }
  ranking: number
  last_ran_in: number
  retired: boolean
  party: string
  rating_history: RatedContest[]
}
