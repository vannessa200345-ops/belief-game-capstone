export interface LobbyYou {
  email: string | null
  is_host: boolean
  player_id: string
  display_name: string
}

export interface LobbyPlayer {
  email: string | null
  is_host: boolean
  left_at: string | null
  joined_at: string
  player_id: string
  auth_user_id: string
  display_name: string
}

export interface LobbyRound {
  card_id: string
  ended_at: string | null
  round_id: string
  started_at: string
  revealed_at: string | null
  round_index: number
}

export interface LobbySpeak {
  id: string
  position: number
  player_id: string
  enqueued_at: string
  display_name?: string
}

export interface LobbySnapshot {
  you: LobbyYou
  code: string
  status: string
  deck_id: string | null
  players: LobbyPlayer[]
  room_id: string
  ended_at: string | null
  created_at: string
  open_round: LobbyRound | null
  rounds: LobbyRound[]
  speak_queue: LobbySpeak[]
  answer_count?: number
}

export interface CardEventRow {
  player_id: string
  card_id: string
  choice_id: string
  is_correct: boolean
  time_ms: number | null
}

export interface SpeakEnqueue {
  already_queued?: boolean
  player_id: string
}

export interface SpeakDequeue {
  removed?: boolean
  player_id?: string
}
