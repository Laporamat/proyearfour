import { Routes, Route } from 'react-router-dom'
import { ChartProvider } from './context/ChartContext'
import Layout    from './components/Layout'
import Dashboard from './pages/Dashboard'
import Chat      from './pages/Chat'

export default function App() {
  return (
    <ChartProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index        element={<Dashboard />} />
          <Route path="chat"  element={<Chat />} />
        </Route>
      </Routes>
    </ChartProvider>
  )
}
