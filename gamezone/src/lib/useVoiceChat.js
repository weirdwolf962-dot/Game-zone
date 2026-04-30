// src/lib/useVoiceChat.js — WebRTC push-to-talk, Firebase signaling

import { useEffect, useRef, useState } from 'react'
import { db } from './firebase'
import { ref, onValue, set, remove, onDisconnect, push, off } from 'firebase/database'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

export function useVoiceChat(roomCode, userId) {
  const [mySpeaking, setMySpeaking] = useState(false)
  const [speaking, setSpeaking]     = useState({})
  const [micAllowed, setMicAllowed] = useState(null)
  const [micError, setMicError]     = useState('')

  const localStream = useRef(null)
  const pcs         = useRef({})
  const audioEls    = useRef({})
  const pendingIce  = useRef({}) // buffer ICE until remoteDesc set
  const didInit     = useRef(false)

  useEffect(() => {
    if (!roomCode || !userId) return
    if (didInit.current) return
    didInit.current = true

    // stable Firebase path helper — defined inside effect so closure is correct
    const vr = (path) => ref(db, `voice/${roomCode}/${path}`)

    const playRemote = (uid, stream) => {
      if (!audioEls.current[uid]) {
        const a = new Audio()
        a.autoplay = true
        a.volume = 1.0
        audioEls.current[uid] = a
      }
      audioEls.current[uid].srcObject = stream
      audioEls.current[uid].play().catch(() => {})
    }

    const addPendingIce = async (pc, uid) => {
      const candidates = pendingIce.current[uid] || []
      for (const c of candidates) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
      }
      pendingIce.current[uid] = []
    }

    const createPc = (uid) => {
      if (pcs.current[uid]) return pcs.current[uid]

      const pc = new RTCPeerConnection(ICE_SERVERS)
      pcs.current[uid] = pc

      // Add local audio tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach(t => {
          pc.addTrack(t, localStream.current)
        })
      }

      // Play incoming audio
      pc.ontrack = (e) => {
        if (e.streams?.[0]) playRemote(uid, e.streams[0])
      }

      // Send ICE to Firebase
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          push(vr(`ice/${uid}/${userId}`), e.candidate.toJSON())
        }
      }

      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          pc.close()
          delete pcs.current[uid]
        }
      }

      return pc
    }

    const makeOffer = async (uid) => {
      const pc = createPc(uid)
      if (pc.signalingState !== 'stable') return
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await set(vr(`offer/${uid}/${userId}`), { sdp: offer.sdp, type: offer.type })
      } catch (e) { console.warn('offer error', e) }
    }

    const handleOffer = async (fromUid, offerData) => {
      const pc = createPc(fromUid)
      if (pc.signalingState !== 'stable') return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerData))
        await addPendingIce(pc, fromUid)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await set(vr(`answer/${fromUid}/${userId}`), { sdp: answer.sdp, type: answer.type })
      } catch (e) { console.warn('offer handle error', e) }
    }

    const handleAnswer = async (fromUid, answerData) => {
      const pc = pcs.current[fromUid]
      if (!pc) return
      if (pc.signalingState !== 'have-local-offer') return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answerData))
        await addPendingIce(pc, fromUid)
      } catch (e) { console.warn('answer handle error', e) }
    }

    const setup = async () => {
      // 1. Get mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        stream.getAudioTracks().forEach(t => { t.enabled = false })
        localStream.current = stream
        setMicAllowed(true)
      } catch {
        setMicAllowed(false)
        setMicError('Mic blocked — allow mic in browser settings')
        return
      }

      // 2. Announce presence
      const presRef = vr(`presence/${userId}`)
      await set(presRef, { uid: userId, ts: Date.now() })
      onDisconnect(presRef).remove()
      onDisconnect(vr(`speaking/${userId}`)).remove()

      // 3. Watch others joining — higher ts user initiates offer
      onValue(vr('presence'), async (snap) => {
        if (!snap.exists()) return
        const all = snap.val()
        for (const [uid, data] of Object.entries(all)) {
          if (uid === userId) continue
          if (pcs.current[uid]) continue
          // Whoever joined LATER sends the offer (higher ts = initiator)
          const myTs = all[userId]?.ts || 0
          const theirTs = data?.ts || 0
          if (myTs > theirTs) {
            await makeOffer(uid)
          }
        }
      })

      // 4. Watch offers for me
      onValue(vr(`offer/${userId}`), async (snap) => {
        if (!snap.exists()) return
        for (const [fromUid, offerData] of Object.entries(snap.val())) {
          await handleOffer(fromUid, offerData)
        }
      })

      // 5. Watch answers for me
      onValue(vr(`answer/${userId}`), async (snap) => {
        if (!snap.exists()) return
        for (const [fromUid, answerData] of Object.entries(snap.val())) {
          await handleAnswer(fromUid, answerData)
        }
      })

      // 6. Watch ICE candidates for me — buffer if PC not ready
      onValue(vr(`ice/${userId}`), async (snap) => {
        if (!snap.exists()) return
        for (const [fromUid, candidates] of Object.entries(snap.val())) {
          const pc = pcs.current[fromUid]
          for (const c of Object.values(candidates)) {
            if (pc && pc.remoteDescription) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
            } else {
              // Buffer for later
              if (!pendingIce.current[fromUid]) pendingIce.current[fromUid] = []
              pendingIce.current[fromUid].push(c)
            }
          }
        }
      })

      // 7. Watch speaking indicators
      onValue(vr('speaking'), (snap) => {
        setSpeaking(snap.exists() ? snap.val() : {})
      })
    }

    setup()

    return () => {
      off(vr('presence'))
      off(vr(`offer/${userId}`))
      off(vr(`answer/${userId}`))
      off(vr(`ice/${userId}`))
      off(vr('speaking'))
      remove(vr(`presence/${userId}`))
      remove(vr(`speaking/${userId}`))
      Object.values(pcs.current).forEach(pc => { try { pc.close() } catch {} })
      pcs.current = {}
      pendingIce.current = {}
      Object.values(audioEls.current).forEach(a => { a.srcObject = null })
      audioEls.current = {}
      if (localStream.current) {
        localStream.current.getTracks().forEach(t => t.stop())
        localStream.current = null
      }
      didInit.current = false
    }
  }, [roomCode, userId])

  // PTT controls — defined with stable refs
  const startSpeaking = () => {
    if (!localStream.current) return
    localStream.current.getAudioTracks().forEach(t => { t.enabled = true })
    setMySpeaking(true)
    set(ref(db, `voice/${roomCode}/speaking/${userId}`), true)
  }

  const stopSpeaking = () => {
    if (!localStream.current) return
    localStream.current.getAudioTracks().forEach(t => { t.enabled = false })
    setMySpeaking(false)
    remove(ref(db, `voice/${roomCode}/speaking/${userId}`))
  }

  return { speaking, mySpeaking, micAllowed, micError, startSpeaking, stopSpeaking }
}
