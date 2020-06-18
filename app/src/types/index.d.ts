type Candidate = {
  name: string
  votes: number|null
  won: boolean
  incumbent: boolean
  party: string
}

export type Contest = {
  _id: number
  name: string
  date: string
  candidates: Candidate[]
  source: string
}

type Rating = {
  mu: number
  sigma: number
}

type RatedContest = {
  contest_id: number
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
