// src/components/shared/VoiceBar.jsx
import { useEffect, useState } from 'react'
import { useVoiceChat } from '../../lib/useVoiceChat'
import './VoiceBar.css'

export default function VoiceBar({ roomCode, userId, players = [] }) {
  const { speaking, mySpeaking, micAllowed, micError, startSpeaking, stopSpeaking } = useVoiceChat(roomCode, userId)
  const [expanded, setExpanded] = useState(false)

  // Hold SPACE to talk
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && !e.repeat) {
        e.preventDefault(); startSpeaking()
      }
    }
    const up = (e) => { if (e.code === 'Space') stopSpeaking() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [startSpeaking, stopSpeaking])

  const speakingPlayers = players.filter(p => speaking[p.uid])

  return (
    <div className={`voice-widget ${mySpeaking ? 'my-speaking' : ''}`}>

      {/* Speaking avatars popup — shown when expanded or someone speaking */}
      {(expanded || speakingPlayers.length > 0) && (
        <div className="voice-speakers">
          {players.map(p => {
            const isSpeaking = speaking[p.uid] || (p.uid === userId && mySpeaking)
            if (!isSpeaking && !expanded) return null
            return (
              <div key={p.uid} className={`voice-speaker-avatar ${isSpeaking ? 'active' : 'idle'}`}
                style={{ background: p.avatarColor }} title={p.nickname}>
                <span>{p.avatar}</span>
                {isSpeaking && <div className="pulse-ring" />}
              </div>
            )
          })}
        </div>
      )}

      {/* Main PTT button */}
      <button
        className={`ptt-fab ${mySpeaking ? 'talking' : ''} ${micAllowed === false ? 'denied' : ''}`}
        onMouseDown={startSpeaking}
        onMouseUp={stopSpeaking}
        onTouchStart={(e) => { e.preventDefault(); startSpeaking() }}
        onTouchEnd={stopSpeaking}
        onContextMenu={(e) => { e.preventDefault(); setExpanded(v => !v) }}
        title={micAllowed === false ? micError : mySpeaking ? 'Speaking...' : 'Hold to Talk (or hold SPACE)'}
      >
        {micAllowed === false ? '🚫' : mySpeaking ? '🔴' : '🎙️'}
      </button>

      {mySpeaking && <div className="ptt-label-popup">Speaking...</div>}
    </div>
  )
}
