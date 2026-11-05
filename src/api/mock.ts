import { selectAnalytics } from '../domain/selectors.ts'
import type { BeliefApi } from './contract.ts'
import type { SelfPaceSubmitResult } from './contract.ts'
import * as store from '../store/gameStore.ts'

function wait(ms = 180) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export const mockApi: BeliefApi = {
  async createRoom(input) {
    await wait()
    return store.createRoom(input.deck)
  },
  async joinRoom(input) {
    await wait(240)
    return store.joinRoom(input)
  },
  async leaveRoom() {
    await wait(120)
    return store.leaveRoom()
  },
  async saveNoticeEmail(email) {
    await wait(140)
    return store.saveNoticeEmail(email)
  },
  async startRoom() {
    await wait(160)
    return store.startRoom()
  },
  async endRoom() {
    await wait(120)
    return store.endRoom()
  },
  async revealRound() {
    await wait(120)
    return store.revealRound()
  },
  async nextRound() {
    await wait(120)
    return store.nextRound()
  },
  async submitAnswer(optionId) {
    await wait(140)
    return store.submitAnswer(optionId)
  },
  async submitSelfPaced(input): Promise<SelfPaceSubmitResult> {
    await wait(80)
    return store.submitSelfPaced(input)
  },
  async sendNote(text, fromHost) {
    await wait(80)
    return store.sendNote(text, fromHost)
  },
  async requestSpeak() {
    await wait(100)
    return store.requestSpeak()
  },
  async lowerHand() {
    await wait(80)
    return store.lowerHand()
  },
  async clearSpeakQueue() {
    await wait(80)
    return store.clearSpeakQueue()
  },
  async pauseRoom() {
    await wait(80)
    return store.pauseRoom()
  },
  async advanceSpeaker() {
    await wait(100)
    return store.advanceSpeaker()
  },
  async getScores() {
    await wait()
    return selectAnalytics(store.readState()).players
  },
  async getAnalytics() {
    await wait()
    return selectAnalytics(store.readState())
  },
}
