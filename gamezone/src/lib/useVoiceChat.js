// src/lib/useVoiceChat.js
// WebRTC peer-to-peer voice chat with Firebase signaling
// Push-to-talk: hold SPACE or hold the button to speak

import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from './firebase'
import { ref, onValue, set, remove, onDisconnect, push, off } from 'firebase/database'

export function useVoiceChat(roomCode, userId) {
  const [peers, setPeers] = useState({})       // uid -> { speaking }
  const [mySpeaking, setMySpeaking] = useState(false)
  const [micAllowed, setMicAllowed] = useState(null) // null=unknown, true, false
  const [micError, setMicError] = useState('')

  const localStream = useRef(null)
  const peerConnections = useRef({})  // uid -> RTCPeerConnection
  const audioElements = useRef({})    // uid -> <audio>

  const sigRef = (path) => ref(db, `voice/${roomCode}/${path}`)

  // ICE servers — using free public STUN
  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  // ── Get mic access ──────────────────────────────────────────
  const initMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // Start muted — push to talk
      stream.getAudioTracks().forEach(t => { t.enabled = false })
      localStream.current = stream
      setMicAllowed(true)
      return stream
    } catch (e) {
      setMicAllowed(false)
      setMicError('Mic access denied. Allow mic in browser settings.')
      return null
    }
  }

  // ── Create peer connection ──────────────────────────────────
  const createPeer = useCallback((targetUid, isInitiator, stream) => {
    if (peerConnections.current[targetUid]) return
    const pc = new RTCPeerConnection(iceConfig)
    peerConnections.current[targetUid] = pc

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    // On remote track — play it
    pc.ontrack = (e) => {
      let audio = audioElements.current[targetUid]
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audioElements.current[targetUid] = audio
      }
      audio.srcObject = e.streams[0]
    }

    // ICE candidates → Firebase
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        push(sigRef(`candidates/${targetUid}/${userId}`), e.candidate.toJSON())
      }
    }

    // Connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close()
        delete peerConnections.current[targetUid]
      }
    }

    if (isInitiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer)
        set(sigRef(`offers/${targetUid}/${userId}`), { sdp: offer.sdp, type: offer.type })
      })
    }

    return pc
  }, [roomCode, userId])

  // ── Main signaling listener ─────────────────────────────────
  useEffect(() => {
    if (!roomCode || !userId) return
    let stream = null

    const setup = async () => {
      stream = await initMic()
      if (!stream) return

      // Announce presence
      const presenceRef = sigRef(`presence/${userId}`)
      set(presenceRef, { uid: userId, joined: Date.now() })
      onDisconnect(presenceRef).remove()

      // Watch others' presence → initiate connections
      const presRef = sigRef('presence')
      onValue(presRef, snap => {
        if (!snap.exists()) return
        const present = snap.val()
        Object.keys(present).forEach(uid => {
          if (uid !== userId && !peerConnections.current[uid]) {
            // Lower uid initiates to avoid double-offers
            const isInitiator = userId < uid
            createPeer(uid, isInitiator, localStream.current)
          }
        })
        setPeers(present)
      })

      // Watch incoming offers for me
      const offersRef = sigRef(`offers/${userId}`)
      onValue(offersRef, snap => {
        if (!snap.exists()) return
        Object.entries(snap.val()).forEach(async ([fromUid, offer]) => {
          let pc = peerConnections.current[fromUid]
          if (!pc) pc = createPeer(fromUid, false, localStream.current)
          if (!pc || pc.signalingState !== 'stable') return
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          set(sigRef(`answers/${fromUid}/${userId}`), { sdp: answer.sdp, type: answer.type })
        })
      })

      // Watch incoming answers for me
      const answersRef = sigRef(`answers/${userId}`)
      onValue(answersRef, snap => {
        if (!snap.exists()) return
        Object.entries(snap.val()).forEach(async ([fromUid, answer]) => {
          const pc = peerConnections.current[fromUid]
          if (!pc || pc.signalingState !== 'have-local-offer') return
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        })
      })

      // Watch ICE candidates for me
      const candRef = sigRef(`candidates/${userId}`)
      onValue(candRef, snap => {
        if (!snap.exists()) return
        Object.entries(snap.val()).forEach(([fromUid, candidates]) => {
          const pc = peerConnections.current[fromUid]
          if (!pc) return
          Object.values(candidates).forEach(c => {
            pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
          })
        })
      })

      // Watch speaking indicators
      const speakRef = sigRef('speaking')
      onValue(speakRef, snap => {
        if (!snap.exists()) { setPeers(p => ({ ...p })); return }
        // handled via peers state
      })
    }

    setup()

    return () => {
      // Cleanup
      off(sigRef('presence'))
      off(sigRef(`offers/${userId}`))
      off(sigRef(`answers/${userId}`))
      off(sigRef(`candidates/${userId}`))
      remove(sigRef(`presence/${userId}`))
      remove(sigRef(`speaking/${userId}`))
      Object.values(peerConnections.current).forEach(pc => pc.close())
      peerConnections.current = {}
      Object.values(audioElements.current).forEach(a => { a.srcObject = null })
      audioElements.current = {}
      if (localStream.current) localStream.current.getTracks().forEach(t => t.stop())
      localStream.current = null
    }
  }, [roomCode, userId])

  // ── Push to talk ────────────────────────────────────────────
  const startSpeaking = useCallback(() => {
    if (!localStream.current) return
    localStream.current.getAudioTracks().forEach(t => { t.enabled = true })
    setMySpeaking(true)
    set(sigRef(`speaking/${userId}`), true)
  }, [roomCode, userId])

  const stopSpeaking = useCallback(() => {
    if (!localStream.current) return
    localStream.current.getAudioTracks().forEach(t => { t.enabled = false })
    setMySpeaking(false)
    remove(sigRef(`speaking/${userId}`))
  }, [roomCode, userId])

  return { peers, mySpeaking, micAllowed, micError, startSpeaking, stopSpeaking }
}
