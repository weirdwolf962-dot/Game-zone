// src/components/lobby/Room.jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { ref, onValue, set, remove, update } from 'firebase/database'
import { useAuth } from '../../lib/AuthContext'
import './Room.css'
import { AvatarDisplay } from '../auth/AvatarPicker'
import VoiceBar from '../shared/VoiceBar'

const DIFFICULTIES = [
  { id: 'easy', label: '😄 Easy', desc: 'Clearly different words' },
  { id: 'medium', label: '🤔 Medium', desc: 'Same category, somewhat different' },
  { id: 'hard', label: '🔥 Hard', desc: 'Very similar, tricky words' },
]

export default function Room() {
  const { code } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [spyCount, setSpyCount] = useState(1)
  const [difficulty, setDifficulty] = useState('medium')
  const [starting, setStarting] = useState(false)

  const isHost = room?.host === user?.uid
  const players = room?.players ? Object.values(room.players) : []
  const canStart = players.length >= 3

  useEffect(() => {
    const roomRef = ref(db, `rooms/${code}`)
    const unsub = onValue(roomRef, snap => {
      if (!snap.exists()) { navigate('/'); return }
      const data = snap.val()
      setRoom(data)
      setLoading(false)
      // If game started, navigate to game
      if (data.status === 'playing' && data.game) {
        navigate(`/room/${code}/spy`)
      }
    })
    return unsub
  }, [code])

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveRoom = async () => {
    await remove(ref(db, `rooms/${code}/players/${user.uid}`))
    if (isHost) await remove(ref(db, `rooms/${code}`))
    navigate('/')
  }

  const startGame = async () => {
    if (!canStart || !isHost) return
    setStarting(true)
    // Set game config — SpyGame component will handle word generation
    await update(ref(db, `rooms/${code}`), {
      status: 'playing',
      game: {
        type: 'spy',
        difficulty,
        spyCount: Math.min(spyCount, Math.floor(players.length / 2)),
        phase: 'loading',
        round: 1,
      }
    })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="room-page">
      <div className="room-container">
        {/* Header */}
        <div className="room-header animate-fadeIn">
          <div>
            <h1>Game Room</h1>
            <p style={{ color: 'var(--gc-muted)' }}>Waiting for everyone to join...</p>
          </div>
          <button className="btn btn-ghost" onClick={leaveRoom}>
            {isHost ? '🗑️ Close Room' : '← Leave'}
          </button>
        </div>

        {/* Room Code */}
        <div className="room-code-card card animate-fadeIn" style={{ animationDelay: '0.05s' }}>
          <p>Share this code with friends</p>
          <div className="code-display">{code}</div>
          <button className="btn btn-secondary" onClick={copyCode}>
            {copied ? '✅ Copied!' : '📋 Copy Code'}
          </button>
        </div>

        <div className="room-body">
          {/* Players */}
          <div className="players-panel card animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Players <span className="badge badge-blue">{players.length}</span></h2>
              {!canStart && <span style={{ color: 'var(--gc-muted)', fontSize: '0.85rem' }}>Need at least 3</span>}
            </div>
            <div className="players-list">
              {players.map(p => (
                <div key={p.uid} className="player-item">
<AvatarDisplay profile={p} size={40} fontSize='1.2rem' />
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.nickname}</div>
                    {p.isHost && <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>Host</span>}
                  </div>
                  {p.uid === user.uid && (
                    <span style={{ marginLeft: 'auto', color: 'var(--gc-muted)', fontSize: '0.8rem' }}>You</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Game Settings (host only) */}
          {isHost && (
            <div className="settings-panel card animate-fadeIn" style={{ animationDelay: '0.15s' }}>
              <h2>Game Settings</h2>

              <div className="setting-group">
                <label>Difficulty</label>
                <div className="difficulty-options">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d.id}
                      className={`diff-btn ${difficulty === d.id ? 'selected' : ''}`}
                      onClick={() => setDifficulty(d.id)}
                    >
                      <span>{d.label}</span>
                      <small>{d.desc}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label>Number of Spies</label>
                <div className="spy-counter">
                  <button className="btn btn-ghost" onClick={() => setSpyCount(Math.max(1, spyCount - 1))}>−</button>
                  <div className="spy-count-display">
                    <span>{spyCount}</span>
                    <small>max {Math.floor(players.length / 2) || 1}</small>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setSpyCount(Math.min(Math.max(1, Math.floor(players.length / 2)), spyCount + 1))}>+</button>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 8 }}
                onClick={startGame}
                disabled={!canStart || starting}
              >
                {!canStart
                  ? `⏳ Need ${3 - players.length} more player${3 - players.length !== 1 ? 's' : ''}`
                  : starting ? '🚀 Starting...' : '🎮 Start Game!'}
              </button>
            </div>
          )}

          {/* Non-host waiting */}
          {!isHost && (
            <div className="waiting-panel card animate-fadeIn" style={{ animationDelay: '0.15s' }}>
              <div className="waiting-emoji animate-float">⏳</div>
              <h2>Waiting for host...</h2>
              <p style={{ color: 'var(--gc-muted)' }}>
                The host will start the game when everyone's ready.<br />
                Use Discord or WhatsApp to talk with friends while you wait!
              </p>
            </div>
          )}
        </div>
      </div>

      <VoiceBar roomCode={code} userId={user?.uid} players={players} />
    </div>
  )
}
