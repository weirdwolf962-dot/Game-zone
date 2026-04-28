// src/components/auth/AvatarPicker.jsx
import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import './AvatarPicker.css'

export const CREW_AVATARS = [
  { id: 'crew_0', techyName: 'R4YY4N',   realName: 'Rayyan',    image: '/avatars/rayyan.png',    initials: 'RY' },
  { id: 'crew_1', techyName: '4R5H',      realName: 'Arsh',      image: '/avatars/arsh.png',      initials: 'AR' },
  { id: 'crew_2', techyName: 'R4J4.EXE', realName: 'Rajandeep', image: '/avatars/rajandeep.png', initials: 'RJ' },
  { id: 'crew_3', techyName: '5UDH1N',   realName: 'Sudhin',    image: '/avatars/sudhin.png',    initials: 'SD' },
  { id: 'crew_4', techyName: 'PR4JW4L',  realName: 'Prajwal',   image: '/avatars/prajwal.png',   initials: 'PJ' },
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

// Helper: render avatar circle anywhere in app
export function AvatarDisplay({ profile, size = 48, fontSize = '1.4rem' }) {
  const crew = profile?.crewId ? CREW_AVATARS.find(c => c.id === profile.crewId) : null
  const style = {
    width: size, height: size, borderRadius: '50%',
    background: profile?.avatarColor || '#4d96ff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize, overflow: 'hidden', flexShrink: 0,
  }

  if (crew?.image) {
    return (
      <div style={style}>
        <img
          src={crew.image}
          alt={crew.realName}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
        <span style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', fontWeight: 700 }}>
          {crew.initials}
        </span>
      </div>
    )
  }

  return <div style={style}>{profile?.avatar || '🎮'}</div>
}

export default function AvatarPicker() {
  const { user, saveProfile } = useAuth()
  const [selected, setSelected] = useState(EMOJI_AVATARS[0])
  const [color, setColor] = useState(COLORS[0])
  const [nickname, setNickname] = useState(user?.displayName?.split(' ')[0] || '')
  const [saving, setSaving] = useState(false)

  const selectedCrew = CREW_AVATARS.find(c => c.id === selected)

  const handleSave = async () => {
    if (!nickname.trim()) return
    setSaving(true)
    await saveProfile({
      avatar: selectedCrew ? selectedCrew.initials : selected,
      avatarColor: color,
      nickname: nickname.trim(),
      crewId: selectedCrew?.id || null,
      avatarImage: selectedCrew?.image || null, // store image path in Firebase
    })
  }

  // Preview content
  const renderPreview = () => {
    if (selectedCrew?.image) {
      return (
        <img
          src={selectedCrew.image}
          alt={selectedCrew.realName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      )
    }
    if (selectedCrew) {
      return <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.1rem', fontWeight: 700 }}>{selectedCrew.initials}</span>
    }
    return selected
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
            {renderPreview()}
          </div>
          <div className="preview-name">{nickname || 'Your Name'}</div>
          {selectedCrew
            ? <span className="badge badge-gold" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>{selectedCrew.techyName}</span>
            : <div className="badge badge-blue">Player</div>}
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
                  <img
                    src={c.image}
                    alt={c.realName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onError={e => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <span className="crew-initials" style={{ display: 'none' }}>{c.initials}</span>
                </div>
                <span className="crew-techy-name">{c.techyName}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--gc-muted)', marginTop: 4 }}>
            Add photos to <code>public/avatars/</code> folder named rayyan.png, arsh.png, etc.
          </p>
        </div>

        {/* Emoji Avatars */}
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

        {/* Color */}
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
