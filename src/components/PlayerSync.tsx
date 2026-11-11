import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGame } from '@/api/useGame'
import { youPlayer } from '@/domain/selectors'
import { useHostAccess } from '@/host/access'
import { loadSurfaceBrowser, saveSurfaceBrowser } from '@/host/deskStore'
import { restoreNavigation, surfaceToRemember } from '@/live/restoreNav'
import { usePace } from '@/self/pace'

export function PlayerSync() {
  const state = useGame()
  const pace = usePace(state.room.code)
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useHostAccess()
  const you = youPlayer(state)

  useEffect(() => {
    const surface = surfaceToRemember(location.pathname, Boolean(session))
    if (surface) saveSurfaceBrowser(surface)
  }, [location.pathname, session])

  useEffect(() => {
    const next = restoreNavigation({
      pathname: location.pathname,
      invite: location.pathname.startsWith('/r/'),
      connection: state.connection,
      hasYou: Boolean(you),
      phase: state.room.phase,
      paceDone: pace.done,
      pendingRoom: state.pendingRoom,
      hostUnlocked: Boolean(session),
      lastPath: loadSurfaceBrowser(),
      roomCode: state.room.code,
    })
    if (next) navigate(next, { replace: true })
  }, [
    location.pathname,
    navigate,
    pace.done,
    session,
    state.connection,
    state.pendingRoom,
    state.room.code,
    state.room.phase,
    you,
  ])

  return null
}
