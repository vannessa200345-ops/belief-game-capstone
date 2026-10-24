import type {
  ActionResult,
  AnalyticsSnapshot,
  DeckId,
  JoinResult,
  NoticeEmailResult,
  PlayerStat,
} from '../domain/types.ts'

/**
 * 日後換 Supabase 時保持這組方法。
 * 讀取進行中的房間用 Realtime（現由 useGame 模擬）；
 * getScores / getAnalytics 是事後查詢的形狀。
 */
export type SelfPaceSubmitResult =
  | { ok: true; isCorrect: boolean | null }
  | { ok: false; error: string }

export interface BeliefApi {
  createRoom(input: { deck: DeckId; name: string; email?: string }): Promise<ActionResult>
  joinRoom(input: { code: string; name: string; email?: string }): Promise<JoinResult>
  leaveRoom(): Promise<ActionResult>
  saveNoticeEmail(email: string): Promise<NoticeEmailResult>
  /** 主持按一次。會先 start_room，再嘗試 start_self_paced。 */
  startRoom(): Promise<ActionResult>
  endRoom(): Promise<ActionResult>
  revealRound(): Promise<ActionResult>
  nextRound(): Promise<ActionResult>
  submitAnswer(optionId: string): Promise<ActionResult>
  submitSelfPaced(input: {
    cardId: string
    choiceId: 'yes' | 'no'
    timeMs: number
  }): Promise<SelfPaceSubmitResult>
  requestSpeak(): Promise<ActionResult>
  lowerHand(): Promise<ActionResult>
  clearSpeakQueue(): Promise<ActionResult>
  pauseRoom(): Promise<ActionResult>
  advanceSpeaker(): Promise<ActionResult>
  getScores(): Promise<PlayerStat[]>
  getAnalytics(): Promise<AnalyticsSnapshot>
}
