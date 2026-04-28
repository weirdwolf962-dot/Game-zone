// src/components/games/spy/SpyGame.jsx
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../../../lib/firebase'
import { ref, onValue, update, remove, get } from 'firebase/database'
import { useAuth } from '../../../lib/AuthContext'
import { generateWords } from '../../../lib/wordgen'
import './SpyGame.css'

export default function SpyGame() {
  const { code } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = useState(null)
  const [game, setGame] = useState(null)
  const [myRole, setMyRole] = useState(null)
  const [showWord, setShowWord] = useState(false)
  const [loading, setLoading] = useState(true)
  const [genStatus, setGenStatus] = useState('Generating words with AI...')

  // Track phase locally to detect round resets
  const prevPhaseRef = useRef(null)
  const prevRoundRef = useRef(null)
  const isGenerating = useRef(false)

  const isHost = room?.host === user?.uid
  const players = room?.players ? Object.values(room.players) : []
  const game_ref = ref(db, `rooms/${code}/game`)

  useEffect(() => {
    const unsub = onValue(ref(db, `rooms/${code}`), snap => {
      if (!snap.exists()) { navigate('/'); return }
      const data = snap.val()
      setRoom(data)
      const g = data.game
      setGame(g)
      setLoading(false)

      if (!g) return

      // Detect round change → reset local UI state
      const roundChanged = g.round !== prevRoundRef.current
      const phaseChanged = g.phase !== prevPhaseRef.current

      if (roundChanged) {
        setMyRole(null)
        setShowWord(false)
        prevRoundRef.current = g.round
      }

      prevPhaseRef.current = g.phase

      // Load my role from assignments
      if (g.assignments?.[user.uid]) {
        setMyRole(g.assignments[user.uid])
      }
    })
    return unsub
  }, [code])

  // Host: generate words when phase is 'loading' and no assignments yet
  useEffect(() => {
    if (!isHost || !game || !room) return
    if (game.phase !== 'loading') return
    if (game.assignments) return       // already assigned
    if (isGenerating.current) return   // prevent double-call
    isGenerating.current = true
    assignRoles().finally(() => { isGenerating.current = false })
  }, [isHost, game?.phase, game?.round])

  const assignRoles = async () => {
    setGenStatus('Asking AI for words...')
    const words = await generateWords(game.difficulty || 'medium')
    setGenStatus('Assigning roles...')

    const playerList = Object.values(room.players)
    const shuffled = [...playerList].sort(() => Math.random() - 0.5)
    const spyCount = Math.min(game.spyCount || 1, Math.floor(playerList.length / 2))
    const spies = shuffled.slice(0, spyCount).map(p => p.uid)

    const assignments = {}
    playerList.forEach(p => {
      assignments[p.uid] = {
        isSpy: spies.includes(p.uid),
        word: spies.includes(p.uid) ? words.spy : words.normal,
      }
    })

    await update(game_ref, {
      phase: 'reveal',
      assignments,
      normalWord: words.normal,
      spyWord: words.spy,
      spies,
      votes: {},
      eliminatedThisRound: null,
      voteTally: null,
      winner: null,
      gameOver: false,
      roundStart: Date.now(),
    })
  }

  // My vote — read from Firebase so it survives refresh
  const myVote = game?.votes?.[user.uid] || null

  const castVote = async (targetUid) => {
    if (myVote) return // already voted
    const votes = { ...(game.votes || {}), [user.uid]: targetUid }
    await update(game_ref, { votes })

    const activePlayers = players.filter(p => !game.eliminated?.[p.uid])
    if (Object.keys(votes).length >= activePlayers.length) {
      await tallyVotes(votes, activePlayers)
    }
  }

  const tallyVotes = async (votes, activePlayers) => {
    const tally = {}
    Object.values(votes).forEach(v => { tally[v] = (tally[v] || 0) + 1 })
    const maxVotes = Math.max(...Object.values(tally))
    const topVoted = Object.entries(tally).filter(([_, v]) => v === maxVotes).map(([k]) => k)
    const eliminatedUid = topVoted[0]

    const wasSpies = game.spies || []
    const remaining = activePlayers.filter(p => p.uid !== eliminatedUid)
    const remainingSpies = wasSpies.filter(uid => remaining.find(p => p.uid === uid))
    const remainingCivilian = remaining.filter(p => !wasSpies.includes(p.uid))

    let winner = null
    if (remainingSpies.length === 0) winner = 'civilians'
    else if (remainingSpies.length >= remainingCivilian.length) winner = 'spies'

    await update(game_ref, {
      phase: 'results',
      eliminatedThisRound: eliminatedUid,
      voteTally: tally,
      winner,
      gameOver: !!winner,
    })
  }

  const playAgain = async () => {
    // Full reset — clear assignments so host regenerates
    await update(game_ref, {
      phase: 'loading',
      assignments: null,
      votes: {},
      eliminatedThisRound: null,
      voteTally: null,
      winner: null,
      gameOver: false,
      spies: null,
      normalWord: null,
      spyWord: null,
      round: (game.round || 1) + 1,
    })
  }

  const endGame = async () => {
    await update(ref(db, `rooms/${code}`), { status: 'waiting', game: null })
    navigate(`/room/${code}`)
  }

  if (loading || !game) return (
    <div className="spy-loading">
      <div className="spy-spinner" />
      <p>{genStatus}</p>
    </div>
  )

  // ── PHASE: LOADING ──────────────────────────────────────────
  if (game.phase === 'loading') return (
    <div className="spy-loading">
      <div className="spy-eye animate-float">👁️</div>
      <h2>Preparing the Mission...</h2>
      <p>{genStatus}</p>
      <div className="spy-dots"><span /><span /><span /></div>
    </div>
  )

  // ── PHASE: REVEAL ───────────────────────────────────────────
  if (game.phase === 'reveal') return (
    <div className="spy-page">
      <div className="spy-container">
        <div className="spy-top-bar">
          <span className="badge badge-gold">Round {game.round || 1}</span>
          <span className="badge badge-blue">{game.difficulty?.toUpperCase()}</span>
        </div>

        <div className="reveal-card animate-fadeIn">
          <div className="reveal-icon animate-float">🕵️</div>
          <h1>Your Secret Word</h1>
          <p>Tap the card to reveal your word. <strong>Don't let anyone else see!</strong></p>

          <div className={`word-card ${showWord ? 'flipped' : ''}`} onClick={() => !showWord && setShowWord(true)}>
            {!showWord ? (
              <div className="word-card-back"><span>👆 Tap to Reveal</span></div>
            ) : (
              <div className="word-card-front">
                <div className={`role-badge ${myRole?.isSpy ? 'spy-role' : 'civilian-role'}`}>
                  {myRole?.isSpy ? '🕵️ YOU ARE THE SPY' : '👤 CIVILIAN'}
                </div>
                <div className="your-word">{myRole?.word}</div>
                <p className="word-hint">
                  {myRole?.isSpy
                    ? 'Your word is different! Blend in, describe carefully.'
                    : 'Describe this word without saying it directly.'}
                </p>
              </div>
            )}
          </div>

          {showWord && isHost && (
            <button className="btn btn-spy btn-lg" onClick={() => update(game_ref, { phase: 'discuss' })} style={{ marginTop: 16 }}>
              Everyone Ready? Start Discussion →
            </button>
          )}
          {showWord && !isHost && (
            <p style={{ color: 'var(--spy-muted)', marginTop: 12, fontSize: '0.9rem' }}>
              Waiting for host to start discussion...
            </p>
          )}
        </div>
      </div>
    </div>
  )

  // ── PHASE: DISCUSS ──────────────────────────────────────────
  if (game.phase === 'discuss') return (
    <div className="spy-page">
      <div className="spy-container">
        <div className="spy-top-bar">
          <span className="badge badge-gold">Round {game.round || 1}</span>
          <span style={{ color: 'var(--spy-muted)', fontSize: '0.85rem', fontFamily: 'Space Mono, monospace' }}>DISCUSSION</span>
        </div>

        <div className="discuss-header animate-fadeIn">
          <h1>Describe Your Word</h1>
          <p>Each player gives ONE clue. Listen carefully — someone is lying!</p>
        </div>

        <div className="players-discuss animate-fadeIn">
          {players.map((p, i) => (
            <div key={p.uid} className="discuss-player" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="avatar" style={{ background: p.avatarColor, fontSize: '1.3rem' }}>{p.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.nickname}</div>
                {p.uid === user.uid && <span style={{ color: 'var(--spy-accent)', fontSize: '0.8rem' }}>You</span>}
              </div>
              <span>🎤</span>
            </div>
          ))}
        </div>

        <div className="my-word-reminder animate-fadeIn">
          <p>Your word: <strong>{myRole?.word}</strong></p>
          {myRole?.isSpy && <span className="badge badge-red">You are the SPY — blend in!</span>}
        </div>

        {isHost && (
          <button className="btn btn-spy btn-lg" onClick={() => update(game_ref, { phase: 'vote', votes: {} })} style={{ width: '100%' }}>
            Start Voting →
          </button>
        )}
        {!isHost && (
          <p style={{ textAlign: 'center', color: 'var(--spy-muted)', fontSize: '0.9rem' }}>
            Host controls when voting begins.
          </p>
        )}
      </div>
    </div>
  )

  // ── PHASE: VOTE ─────────────────────────────────────────────
  if (game.phase === 'vote') {
    const votes = game.votes || {}
    const hasVoted = !!myVote   // from Firebase — survives refresh
    const voteCount = Object.keys(votes).length

    return (
      <div className="spy-page">
        <div className="spy-container">
          <div className="spy-top-bar">
            <span className="badge badge-gold">Round {game.round || 1}</span>
            <span className="badge badge-red">VOTING</span>
          </div>

          <div className="vote-header animate-fadeIn">
            <h1>Who is the Spy?</h1>
            <p>Vote for who you think is the spy. Most votes = eliminated!</p>
            <div className="vote-progress">
              <div className="vote-bar" style={{ width: `${(voteCount / players.length) * 100}%` }} />
            </div>
            <small style={{ color: 'var(--spy-muted)' }}>{voteCount}/{players.length} voted</small>
          </div>

          <div className="vote-grid animate-fadeIn">
            {players.map(p => {
              const voteCountP = Object.values(votes).filter(v => v === p.uid).length
              const isMe = p.uid === user.uid
              const votedForThis = myVote === p.uid
              return (
                <button
                  key={p.uid}
                  className={`vote-card ${votedForThis ? 'voted' : ''} ${isMe ? 'is-me' : ''} ${hasVoted ? 'disabled' : ''}`}
                  onClick={() => !hasVoted && !isMe && castVote(p.uid)}
                  disabled={isMe || hasVoted}
                >
                  <div className="avatar" style={{ background: p.avatarColor, fontSize: '1.5rem', width: 56, height: 56 }}>
                    {p.avatar}
                  </div>
                  <div className="vote-name">{p.nickname}</div>
                  {isMe && <div className="vote-sub">Can't self-vote</div>}
                  {voteCountP > 0 && <div className="vote-count-badge">{voteCountP} 🗳️</div>}
                  {votedForThis && <div className="voted-label">✓ Your Vote</div>}
                </button>
              )
            })}
          </div>

          {hasVoted && (
            <p className="waiting-votes animate-fadeIn">
              {voteCount < players.length ? `Waiting for ${players.length - voteCount} more vote(s)...` : 'Tallying votes...'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── PHASE: RESULTS ──────────────────────────────────────────
  if (game.phase === 'results') {
    const eliminated = players.find(p => p.uid === game.eliminatedThisRound)
    const wasSpies = game.spies || []
    const eliminatedWasSpy = wasSpies.includes(game.eliminatedThisRound)
    const tally = game.voteTally || {}

    return (
      <div className="spy-page">
        <div className="spy-container results-container">
          <div className="results-header animate-fadeIn">
            {game.winner ? (
              <>
                <div className="winner-emoji animate-float">{game.winner === 'civilians' ? '🎉' : '😈'}</div>
                <h1 className={game.winner === 'civilians' ? 'win-civ' : 'win-spy'}>
                  {game.winner === 'civilians' ? 'Civilians Win!' : 'Spies Win!'}
                </h1>
                <p>{game.winner === 'civilians' ? 'You caught all the spies!' : 'The spies fooled everyone!'}</p>
              </>
            ) : (
              <>
                <div className="result-emoji animate-float">{eliminatedWasSpy ? '🎯' : '❌'}</div>
                <h1>{eliminatedWasSpy ? 'Spy Caught!' : 'Wrong Vote!'}</h1>
                <p>{eliminated?.nickname} was eliminated</p>
              </>
            )}
          </div>

          <div className="word-reveal-panel card animate-fadeIn">
            <h2>The Words Were:</h2>
            <div className="words-reveal">
              <div className="word-reveal-item">
                <span className="badge badge-green">👥 Civilian Word</span>
                <div className="revealed-word">{game.normalWord}</div>
              </div>
              <div className="word-reveal-item">
                <span className="badge badge-red">🕵️ Spy Word</span>
                <div className="revealed-word spy-word-reveal">{game.spyWord}</div>
              </div>
            </div>
          </div>

          <div className="spy-reveal-panel card animate-fadeIn">
            <h2>The Spies Were:</h2>
            <div className="spy-reveal-list">
              {wasSpies.map(uid => {
                const p = players.find(pl => pl.uid === uid)
                return p ? (
                  <div key={uid} className="spy-reveal-item">
                    <div className="avatar" style={{ background: p.avatarColor, fontSize: '1.3rem' }}>{p.avatar}</div>
                    <span>{p.nickname}</span>
                    <span className="badge badge-red">SPY</span>
                  </div>
                ) : null
              })}
            </div>
          </div>

          <div className="tally-panel card animate-fadeIn">
            <h2>Vote Count:</h2>
            {players.map(p => (
              <div key={p.uid} className="tally-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar" style={{ background: p.avatarColor, fontSize: '1rem', width: 32, height: 32 }}>{p.avatar}</div>
                  <span>{p.nickname}</span>
                </div>
                <div className="tally-bar-wrap">
                  <div className="tally-bar" style={{ width: `${((tally[p.uid] || 0) / players.length) * 100}%` }} />
                </div>
                <span className="tally-num">{tally[p.uid] || 0}</span>
              </div>
            ))}
          </div>

          {isHost && (
            <div className="results-actions animate-fadeIn">
              {!game.gameOver && (
                <button className="btn btn-spy btn-lg" onClick={playAgain}>↻ Next Round</button>
              )}
              <button className="btn btn-ghost" onClick={endGame}>🏠 Back to Lobby</button>
            </div>
          )}
          {!isHost && (
            <p style={{ textAlign: 'center', color: 'var(--spy-muted)', fontSize: '0.9rem' }}>
              Waiting for host to continue...
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}
