import { selectAnalytics } from '../domain/selectors.ts'
import type { BeliefApi } from './contract.ts'
import * as live from '../live/store.ts'

/** 已接上的 Supabase adapter。畫面仍呼叫這組方法，不直接打表。 */
export const supabaseApi: BeliefApi = {
  createRoom: (input) => live.createRoom(input),
  joinRoom: (input) => live.joinRoom(input),
  leaveRoom: () => live.leaveRoom(),
  saveNoticeEmail: (email) => live.saveNoticeEmail(email),
  startRoom: () => live.startRoom(),
  endRoom: () => live.endRoom(),
  revealRound: () => live.revealRound(),
  nextRound: () => live.nextRound(),
  submitAnswer: (optionId) => live.submitAnswer(optionId),
  submitSelfPaced: (input) => live.submitSelfPaced(input),
  requestSpeak: () => live.requestSpeak(),
  lowerHand: () => live.lowerHand(),
  clearSpeakQueue: () => live.clearSpeakQueue(),
  pauseRoom: () => live.pauseRoom(),
  advanceSpeaker: () => live.advanceSpeaker(),
  async getScores() {
    return selectAnalytics(live.readState()).players
  },
  async getAnalytics() {
    return selectAnalytics(live.readState())
  },
}
