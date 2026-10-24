import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { youPlayer } from '@/domain/selectors'
import { usePace } from '@/self/pace'
import type { Phase } from '@/domain/types'

function pathFor(phase: Phase, done: boolean) {
  if (phase === 'lobby') return '/play/lobby'
  if (phase === 'final' || done) return '/play/final'
  return '/play'
}

export function PlayerSync() {
  const state = useGame()
  const pace = usePace(state.room.code)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const invite = location.pathname.startsWith('/r/')
    const onPlayerSurface = location.pathname === '/' || location.pathname.startsWith('/play') || invite
    if (!onPlayerSurface) return
    const you = youPlayer(state)
    if (!you) {
      if (!invite && location.pathname !== '/') navigate('/', { replace: true })
      return
    }
    if (invite && state.room.code && location.pathname.toUpperCase() !== `/R/${state.room.code}`) return
    const target = pathFor(state.room.phase, pace.done)
    if (location.pathname !== target) navigate(target, { replace: true })
  }, [location.pathname, navigate, pace.done, state])

  return null
}
