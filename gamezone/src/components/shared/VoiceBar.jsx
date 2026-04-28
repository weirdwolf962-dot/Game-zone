// src/components/shared/VoiceBar.jsx
// Push-to-talk voice bar — shown in Room and SpyGame

import { useEffect, useCallback } from 'react'
import { useVoiceChat } from '../../lib/useVoiceChat'
import './VoiceBar.css'

export default function VoiceBar({ roomCode, userId, players = [] }) {
  const { peers, mySpeaking, micAllowed, micError, startSpeaking, stopSpeaking } = useVoiceChat(roomCode, userId)

  // Keyboard: hold SPACE to talk
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && !e.repeat) {
        e.preventDefault()
        startSpeaking()
      }
    }
    const onUp = (e) => {
      if (e.code === 'Space') stopSpeaking()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [startSpeaking, stopSpeaking])

  if (micAllowed === false) return (
    <div className="voice-bar voice-error">
      🎙️ {micError || 'Mic access denied — allow mic in browser settings'}
    </div>
  )

  return (
    <div className="voice-bar">
      {/* Speaking indicators */}
      <div className="voice-peers">
        {players.map(p => {
          const isSpeaking = peers?.[p.uid]?.speaking || (p.uid === userId && mySpeaking)
          return (
            <div key={p.uid} className={`voice-peer ${isSpeaking ? 'speaking' : ''}`} title={p.nickname}>
              <div className="voice-avatar" style={{ background: p.avatarColor }}>
                {p.avatar}
                {isSpeaking && <div className="speaking-ring" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* PTT Button */}
      <button
        className={`ptt-btn ${mySpeaking ? 'active' : ''}`}
        onMouseDown={startSpeaking}
        onMouseUp={stopSpeaking}
        onTouchStart={(e) => { e.preventDefault(); startSpeaking() }}
        onTouchEnd={stopSpeaking}
      >
        <span className="ptt-icon">{mySpeaking ? '🔴' : '🎙️'}</span>
        <span className="ptt-label">{mySpeaking ? 'Speaking...' : 'Hold to Talk'}</span>
        <span className="ptt-hint">or hold SPACE</span>
      </button>
    </div>
  )
}
