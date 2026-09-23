import { Routes, Route, useLocation } from 'react-router-dom'
import { ChartProvider } from './context/ChartContext'
import { AuthProvider }  from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout          from './components/Layout'
import Dashboard       from './pages/Dashboard'
import Chat            from './pages/Chat'
import MetricAnalysis  from './pages/MetricAnalysis'
import MyPortfolio     from './pages/MyPortfolio'
import Rebalancing      from './pages/Rebalancing'
import Backtesting      from './pages/Backtesting'
import Watchlist        from './pages/Watchlist'
import Settings        from './pages/Settings'
import Landing         from './pages/Landing'
import Login           from './pages/Login'
import Register        from './pages/Register'
import AuthCallback    from './pages/AuthCallback'
import { ForgotPassword, ResetPassword } from './pages/PasswordFlow'
import ProtectedRoute  from './components/ProtectedRoute'

function AppRouter() {
  const location = useLocation()
  // CRITICAL: detect OAuth callback FIRST (during render, before any route/effect)
  if (location.hash?.includes('session_id=')) return <AuthCallback />

  return (
    <Routes>
      <Route path="/"                 element={<Landing />} />
      <Route path="/login"            element={<Login />} />
      <Route path="/register"         element={<Register />} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/reset-password"   element={<ResetPassword />} />
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
        <Route path="/analysis/:metric" element={<MetricAnalysis />} />
        <Route path="/portfolio" element={<MyPortfolio />} />
        <Route path="/rebalancing" element={<Rebalancing />} />
        <Route path="/backtesting" element={<Backtesting />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  )
}
