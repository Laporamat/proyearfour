import { Routes, Route, useLocation } from 'react-router-dom'
import { ChartProvider } from './context/ChartContext'
import { AuthProvider }  from './context/AuthContext'
import Layout          from './components/Layout'
import Dashboard       from './pages/Dashboard'
import Chat            from './pages/Chat'
import Landing         from './pages/Landing'
import Login           from './pages/Login'
import AuthCallback    from './pages/AuthCallback'
import ProtectedRoute  from './components/ProtectedRoute'

function AppRouter() {
  const location = useLocation()
  // CRITICAL: detect OAuth callback FIRST (during render, before any route/effect)
  // to avoid race conditions with the AuthProvider /me check.
  if (location.hash?.includes('session_id=')) return <AuthCallback />

  return (
    <Routes>
      <Route path="/"       element={<Landing />} />
      <Route path="/login"  element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <ChartProvider>
              <Layout />
            </ChartProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat"      element={<Chat />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
