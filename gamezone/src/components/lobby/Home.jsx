// src/components/lobby/Home.jsx
import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { ref, set, get, push } from 'firebase/database'
import './Home.css'

export default function Home() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = async () => {
    setCreating(true)
    setError('')
    const code = generateRoomCode()
    try {
      await set(ref(db, `rooms/${code}`), {
        code,
        host: user.uid,
        hostName: profile.nickname,
        game: null,
        status: 'waiting',
        createdAt: Date.now(),
        players: {
          [user.uid]: {
            uid: user.uid,
            nickname: profile.nickname,
            avatar: profile.avatar,
            avatarColor: profile.avatarColor,
            isHost: true,
            joinedAt: Date.now()
          }
        }
      })
      navigate(`/room/${code}`)
    } catch (e) {
      setError('Failed to create room. Check your internet.')
      setCreating(false)
    }
  }

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code || code.length < 4) { setError('Enter a valid room code!'); return }
    setJoining(true)
    setError('')
    try {
      const snap = await get(ref(db, `rooms/${code}`))
      if (!snap.exists()) { setError('Room not found! Double check the code.'); setJoining(false); return }
      const room = snap.val()
      if (room.status === 'playing') { setError("Game already in progress. Wait for next round!"); setJoining(false); return }

      await set(ref(db, `rooms/${code}/players/${user.uid}`), {
        uid: user.uid,
        nickname: profile.nickname,
        avatar: profile.avatar,
        avatarColor: profile.avatarColor,
        isHost: false,
        joinedAt: Date.now()
      })
      navigate(`/room/${code}`)
    } catch (e) {
      setError('Something went wrong. Try again.')
      setJoining(false)
    }
  }

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="header-logo"><img src="/logo.png" alt="GameZone" style={{ height: 32, width: 32, objectFit: 'contain' }} /> <span>GameZone</span></div>
        <div className="header-profile">
          <div className="avatar" style={{ background: profile?.avatarColor, fontSize: '1.4rem' }}>
            {profile?.avatar}
          </div>
          <span>{profile?.nickname}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main className="home-main">
        {/* Hero */}
        <div className="home-hero animate-fadeIn">
          <h1>Play Together,<br /><span className="hero-highlight">Anywhere!</span></h1>
          <p>Create a room, share the code, and play with your friends online. No downloads needed!</p>
        </div>

        {/* Room Actions */}
        <div className="room-actions animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <div className="room-card card">
            <div className="room-card-icon">🏠</div>
            <h2>Create Room</h2>
            <p>Start a new game room and invite your friends with a code</p>
            <button className="btn btn-primary btn-lg" onClick={createRoom} disabled={creating}>
              {creating ? '⏳ Creating...' : '✨ Create Room'}
            </button>
          </div>

          <div className="room-divider">
            <span>or</span>
          </div>

          <div className="room-card card">
            <div className="room-card-icon">🚪</div>
            <h2>Join Room</h2>
            <p>Enter the 6-letter code your friend shared with you</p>
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              <input
                className="input"
                placeholder="Enter room code (e.g. AB12CD)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', fontWeight: 700 }}
              />
              <button className="btn btn-secondary btn-lg" onClick={joinRoom} disabled={joining}>
                {joining ? '⏳ Joining...' : '→ Join Room'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="home-error animate-fadeIn">{error}</div>}

        {/* Games Grid */}
        <div className="games-section animate-fadeIn" style={{ animationDelay: '0.2s' }}>
          <h2>Games Available</h2>
          <div className="games-grid">
            <div className="game-card spy-card">
              <div className="game-card-emoji">🕵️</div>
              <div className="game-card-info">
                <h3>Spy Game</h3>
                <p>Find the spy among your friends. Describe your word without giving it away!</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span className="badge badge-gold">Available</span>
                  <span className="badge badge-blue">3–15 players</span>
                </div>
              </div>
            </div>
            <div className="game-card coming-card">
              <div className="game-card-emoji">🎯</div>
              <div className="game-card-info">
                <h3>More Games</h3>
                <p>New exciting games are coming soon to GameZone!</p>
                <span className="badge badge-yellow">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
