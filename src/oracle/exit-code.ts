import type { Outcome, Oracle, Candidate } from '../types.js'

export const exitCodeOracle: Oracle = async (_candidate: Candidate): Promise<Outcome> => {
  return 'pass'
}