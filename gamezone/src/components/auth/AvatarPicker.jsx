// src/components/auth/AvatarPicker.jsx
import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import './AvatarPicker.css'

// ── Crew avatars ── add image paths here later e.g. image: '/avatars/rayyan.png'
const CREW_AVATARS = [
  { id: 'crew_0', techyName: 'R4YY4N',     realName: 'Rayyan',     image: null, initials: 'RY' },
  { id: 'crew_1', techyName: '4R5H',        realName: 'Arsh',       image: '/avatars/arsh.png' },
  { id: 'crew_2', techyName: 'R4J4.EXE',   realName: 'Rajandeep',  image: null, initials: 'RJ' },
  { id: 'crew_3', techyName: '5UDH1N',      realName: 'Sudhin',     image: '/avatars/sudhin.png' },
  { id: 'crew_4', techyName: 'PR4JW4L',    realName: 'Prajwal',    image: null, initials: 'PJ' },
]

const EMOJI_AVATARS = [
  '🦊','🐺','🐸','🐼','🦁','🐯','🦝','🐨',
  '🦄','🐉','🦋','🦅','🐙','🦈','🐧','🦜',
  '🤖','👾','🧙','🥷','🕵️','🎭','👻','🤡',
]

const COLORS = [
  '#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
  '#c77dff','#ff9f43','#48dbfb','#ff6b9d',
]

export default function AvatarPicker() {
  const { user, saveProfile } = useAuth()
  // selected can be a crew id like 'crew_0' or an emoji
  const [selected, setSelected] = useState(EMOJI_AVATARS[0])
  const [color, setColor] = useState(COLORS[0])
  const [nickname, setNickname] = useState(user?.displayName?.split(' ')[0] || '')
  const [saving, setSaving] = useState(false)

  const selectedCrew = CREW_AVATARS.find(c => c.id === selected)

  // What to show in the preview circle
  const previewContent = selectedCrew
    ? selectedCrew.image
      ? <img src={selectedCrew.image} alt={selectedCrew.realName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      : <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.1rem', fontWeight: 700 }}>{selectedCrew.initials}</span>
    : selected

  const handleSave = async () => {
    if (!nickname.trim()) return
    setSaving(true)
    // Store crew id or emoji
    await saveProfile({
      avatar: selectedCrew ? selectedCrew.initials : selected,
      avatarColor: color,
      nickname: nickname.trim(),
      isCrew: !!selectedCrew,
      crewId: selectedCrew?.id || null,
    })
  }

  return (
    <div className="avatar-picker-page">
      <div className="avatar-picker-content animate-fadeIn">
        <div className="picker-header">
          <h1>Customize Your Player</h1>
          <p>Choose how you appear to your friends</p>
        </div>

        {/* Preview */}
        <div className="avatar-preview">
          <div className="preview-avatar" style={{ background: color, overflow: 'hidden' }}>
            {previewContent}
          </div>
          <div className="preview-name">{nickname || 'Your Name'}</div>
          {selectedCrew
            ? <span className="badge badge-gold" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>{selectedCrew.techyName}</span>
            : <div className="badge badge-blue">Player</div>
          }
        </div>

        {/* Nickname */}
        <div className="picker-section">
          <label>Your Nickname</label>
          <input
            className="input"
            placeholder="Enter nickname..."
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={16}
          />
        </div>

        {/* Crew Avatars */}
        <div className="picker-section">
          <label>⚡ Quantum Coders Crew</label>
          <div className="crew-grid">
            {CREW_AVATARS.map(c => (
              <button
                key={c.id}
                className={`crew-option ${selected === c.id ? 'selected' : ''}`}
                onClick={() => setSelected(c.id)}
                style={selected === c.id ? { borderColor: color, boxShadow: `0 0 12px ${color}55` } : {}}
              >
                <div className="crew-avatar-img" style={{ background: selected === c.id ? color : 'var(--gc-surface)' }}>
                  {c.image
                    ? <img src={c.image} alt={c.realName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <span className="crew-initials">{c.initials}</span>
                  }
                </div>
                <span className="crew-techy-name">{c.techyName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Emoji Avatar Grid */}
        <div className="picker-section">
          <label>Or Pick an Emoji Avatar</label>
          <div className="avatar-grid">
            {EMOJI_AVATARS.map(a => (
              <button
                key={a}
                className={`avatar-option ${selected === a ? 'selected' : ''}`}
                onClick={() => setSelected(a)}
                style={selected === a ? { background: color, borderColor: color } : {}}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div className="picker-section">
          <label>Avatar Color</label>
          <div className="color-grid">
            {COLORS.map(c => (
              <button
                key={c}
                className={`color-option ${color === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={handleSave}
          disabled={saving || !nickname.trim()}
        >
          {saving ? '✨ Setting up...' : "🎮 Let's Play!"}
        </button>
      </div>
    </div>
  )
}
