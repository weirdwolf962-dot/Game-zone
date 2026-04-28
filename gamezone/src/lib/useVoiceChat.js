// src/lib/useVoiceChat.js
// WebRTC push-to-talk via Firebase signaling

import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from './firebase'
import { ref, onValue, set, remove, onDisconnect, push, off, get } from 'firebase/database'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]
}

export function useVoiceChat(roomCode, userId) {
  const [mySpeaking, setMySpeaking]   = useState(false)
  const [speaking, setSpeaking]       = useState({}) // uid -> bool
  const [micAllowed, setMicAllowed]   = useState(null)
  const [micError, setMicError]       = useState('')

  const localStream   = useRef(null)
  const pcs           = useRef({})     // uid -> RTCPeerConnection
  const audioEls      = useRef({})     // uid -> Audio element
  const initialized   = useRef(false)

  const vRef = (path) => ref(db, `voice/${roomCode}/${path}`)

  // ── Attach remote stream to audio element ──
  const playRemote = (uid, stream) => {
    if (!audioEls.current[uid]) {
      const audio = new Audio()
      audio.autoplay = true
      audio.playsInline = true
      audioEls.current[uid] = audio
    }
    audioEls.current[uid].srcObject = stream
    audioEls.current[uid].play().catch(() => {})
  }

  // ── Create or get peer connection ──
  const getPc = useCallback((uid) => {
    if (pcs.current[uid]) return pcs.current[uid]

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcs.current[uid] = pc

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current))
    }

    // Remote track → play audio
    pc.ontrack = (e) => {
      if (e.streams?.[0]) playRemote(uid, e.streams[0])
    }

    // Send ICE candidates to Firebase
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        push(vRef(`ice/${uid}/${userId}`), e.candidate.toJSON())
      }
    }

    pc.onconnectionstatechange = () => {
      if (['failed','disconnected','closed'].includes(pc.connectionState)) {
        pc.close()
        delete pcs.current[uid]
      }
    }

    return pc
  }, [roomCode, userId])

  // ── Make offer ──
  const makeOffer = useCallback(async (uid) => {
    const pc = getPc(uid)
    if (pc.signalingState !== 'stable') return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await set(vRef(`offer/${uid}/${userId}`), { sdp: offer.sdp, type: offer.type })
  }, [getPc, roomCode, userId])

  // ── Handle incoming offer → send answer ──
  const handleOffer = useCallback(async (fromUid, offer) => {
    const pc = getPc(fromUid)
    if (pc.signalingState !== 'stable') return
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await set(vRef(`answer/${fromUid}/${userId}`), { sdp: answer.sdp, type: answer.type })
  }, [getPc, roomCode, userId])

  // ── Handle incoming answer ──
  const handleAnswer = useCallback(async (fromUid, answer) => {
    const pc = pcs.current[fromUid]
    if (!pc || pc.signalingState !== 'have-local-offer') return
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
  }, [])

  // ── Handle ICE ──
  const handleIce = useCallback(async (fromUid, candidate) => {
    const pc = pcs.current[fromUid]
    if (!pc) return
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
  }, [])

  // ── Init ──
  useEffect(() => {
    if (!roomCode || !userId || initialized.current) return
    initialized.current = true

    const setup = async () => {
      // Get mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        stream.getAudioTracks().forEach(t => { t.enabled = false }) // start muted
        localStream.current = stream
        setMicAllowed(true)
      } catch {
        setMicAllowed(false)
        setMicError('Mic blocked — allow mic in browser settings')
        return
      }

      // Announce presence
      const presRef = vRef(`presence/${userId}`)
      await set(presRef, { uid: userId, ts: Date.now() })
      onDisconnect(presRef).remove()
      onDisconnect(vRef(`speaking/${userId}`)).remove()

      // Watch presence — when someone new joins, initiator (lower uid) makes offer
      onValue(vRef('presence'), async (snap) => {
        if (!snap.exists()) return
        for (const uid of Object.keys(snap.val())) {
          if (uid === userId) continue
          if (!pcs.current[uid] && userId < uid) {
            await makeOffer(uid)
          }
        }
      })

      // Watch offers addressed to me
      onValue(vRef(`offer/${userId}`), async (snap) => {
        if (!snap.exists()) return
        for (const [fromUid, offer] of Object.entries(snap.val())) {
          await handleOffer(fromUid, offer)
        }
      })

      // Watch answers addressed to me
      onValue(vRef(`answer/${userId}`), async (snap) => {
        if (!snap.exists()) return
        for (const [fromUid, answer] of Object.entries(snap.val())) {
          await handleAnswer(fromUid, answer)
        }
      })

      // Watch ICE candidates addressed to me
      onValue(vRef(`ice/${userId}`), async (snap) => {
        if (!snap.exists()) return
        for (const [fromUid, candidates] of Object.entries(snap.val())) {
          for (const c of Object.values(candidates)) {
            await handleIce(fromUid, c)
          }
        }
      })

      // Watch speaking indicators
      onValue(vRef('speaking'), (snap) => {
        setSpeaking(snap.exists() ? snap.val() : {})
      })
    }

    setup()

    return () => {
      off(vRef('presence'))
      off(vRef(`offer/${userId}`))
      off(vRef(`answer/${userId}`))
      off(vRef(`ice/${userId}`))
      off(vRef('speaking'))
      remove(vRef(`presence/${userId}`))
      remove(vRef(`speaking/${userId}`))
      Object.values(pcs.current).forEach(pc => pc.close())
      pcs.current = {}
      Object.values(audioEls.current).forEach(a => { a.srcObject = null })
      audioEls.current = {}
      if (localStream.current) localStream.current.getTracks().forEach(t => t.stop())
      localStream.current = null
      initialized.current = false
    }
  }, [roomCode, userId])

  // ── Push to talk ──
  const startSpeaking = useCallback(() => {
    if (!localStream.current) return
    localStream.current.getAudioTracks().forEach(t => { t.enabled = true })
    setMySpeaking(true)
    set(vRef(`speaking/${userId}`), true)
  }, [roomCode, userId])

  const stopSpeaking = useCallback(() => {
    if (!localStream.current) return
    localStream.current.getAudioTracks().forEach(t => { t.enabled = false })
    setMySpeaking(false)
    remove(vRef(`speaking/${userId}`))
  }, [roomCode, userId])

  return { speaking, mySpeaking, micAllowed, micError, startSpeaking, stopSpeaking }
}
