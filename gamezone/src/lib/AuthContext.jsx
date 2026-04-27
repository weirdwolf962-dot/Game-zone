// src/lib/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { auth, googleProvider } from './firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { db } from './firebase'
import { ref, set, get } from 'firebase/database'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await get(ref(db, `users/${u.uid}`))
        if (snap.exists()) setProfile(snap.val())
        else setProfile(null)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider)

  const logout = () => signOut(auth)

  const saveProfile = async (data) => {
    await set(ref(db, `users/${user.uid}`), {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      ...data
    })
    setProfile({ uid: user.uid, name: user.displayName, email: user.email, ...data })
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout, saveProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
