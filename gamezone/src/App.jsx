// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './components/auth/LoginPage'
import AvatarPicker from './components/auth/AvatarPicker'
import Home from './components/lobby/Home'
import Room from './components/lobby/Room'
import SpyGame from './components/games/spy/SpyGame'

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <LoginPage />
  if (!profile) return <AvatarPicker />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:code" element={<Room />} />
      <Route path="/room/:code/spy" element={<SpyGame />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
