// src/components/auth/AvatarPicker.jsx
import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import './AvatarPicker.css'

const AVATARS = [
  '🦊','🐺','🐸','🐼','🦁','🐯','🦝','🐨',
  '🦄','🐉','🦋','🦅','🐙','🦈','🦊','🐧',
  '🤖','👾','🧙','🥷','🕵️','🎭','👻','🤡',
]

const COLORS = [
  '#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
  '#c77dff','#ff9f43','#48dbfb','#ff6b9d',
]

export default function AvatarPicker() {
  const { user, saveProfile } = useAuth()
  const [selected, setSelected] = useState(AVATARS[0])
  const [color, setColor] = useState(COLORS[0])
  const [nickname, setNickname] = useState(user?.displayName?.split(' ')[0] || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nickname.trim()) return
    setSaving(true)
    await saveProfile({ avatar: selected, avatarColor: color, nickname: nickname.trim() })
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
          <div className="preview-avatar" style={{ background: color }}>
            {selected}
          </div>
          <div className="preview-name">{nickname || 'Your Name'}</div>
          <div className="badge badge-blue">Player</div>
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

        {/* Avatar Grid */}
        <div className="picker-section">
          <label>Pick Your Avatar</label>
          <div className="avatar-grid">
            {AVATARS.map(a => (
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
