type Candidate = {
  name: string
  votes: number
  won: boolean
  incumbent: boolean
  party: Party
  rating?: Rating
}

type Party = {
  name: string
  color: string
}

export type Contest = {
  _id: number
  name: string
  date: string
  candidates: Candidate[]
  source: string
  upcoming: boolean
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
  _id: number
  name: string
  rating: Rating & { low_confidence: boolean }
  ranking: number
  last_ran_in: number
  retired: boolean
  party: Party
  rating_history: RatedContest[]
}
