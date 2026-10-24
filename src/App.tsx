import { Link, Route, Routes } from 'react-router-dom'
import { ConnectionGate } from '@/components/Connection'
import { Frame } from '@/components/Frame'
import { PlayerSync } from '@/components/PlayerSync'
import { AnalyticsPage } from '@/screens/AnalyticsPage'
import { ControlPage } from '@/screens/ControlPage'
import { FinalPage } from '@/screens/FinalPage'
import { HostLobbyPage } from '@/screens/HostLobbyPage'
import { JoinPage } from '@/screens/JoinPage'
import { LobbyPage } from '@/screens/LobbyPage'
import { PlayPage } from '@/screens/PlayPage'
import { ResultPage } from '@/screens/ResultPage'

function MissingPage() {
  return (
    <Frame>
      <main id="main" className="pt-16">
        <h1 className="text-2xl font-medium">這一頁不在房間裡</h1>
        <p className="mt-3 text-sm text-muted">你可以回到學員入口，或去主持開場。</p>
        <p className="mt-6 flex gap-4 text-sm">
          <Link to="/" className="underline decoration-line underline-offset-4">
            學員入口
          </Link>
          <Link to="/host" className="underline decoration-line underline-offset-4">
            主持開場
          </Link>
        </p>
      </main>
    </Frame>
  )
}

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        跳到內容
      </a>
      <PlayerSync />
      <ConnectionGate>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/r/:code" element={<JoinPage />} />
          <Route path="/play/lobby" element={<LobbyPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/play/result" element={<ResultPage />} />
          <Route path="/play/final" element={<FinalPage />} />
          <Route path="/host" element={<HostLobbyPage />} />
          <Route path="/host/control" element={<ControlPage />} />
          <Route path="/host/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<MissingPage />} />
        </Routes>
      </ConnectionGate>
    </>
  )
}
