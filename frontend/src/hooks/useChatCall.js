import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../lib/api'
import { getEcho } from '../lib/echo'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function newCallId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `call-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function repairSdpText(raw) {
  if (typeof raw !== 'string' || !raw) return ''
  let text = raw
  // Recover if newlines were JSON-escaped twice into literal \n / \r\n.
  if (!text.includes('\n') && (text.includes('\\n') || text.includes('\\r'))) {
    text = text
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
  }
  // Spec requires CRLF; browsers reject mangled / space-joined SDP lines.
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\r\n')
}

function toSdpPayload(description) {
  if (!description?.type || !description?.sdp) return null
  const sdp = repairSdpText(description.sdp)
  // Base64 avoids newline corruption through HTTP + Reverb/Echo.
  return {
    type: description.type,
    sdp_b64: btoa(unescape(encodeURIComponent(sdp))),
  }
}

function normalizeSdp(desc) {
  if (!desc || typeof desc !== 'object') return null
  const type = desc.type
  if (!type) return null

  let sdp = ''
  if (typeof desc.sdp_b64 === 'string' && desc.sdp_b64) {
    try {
      sdp = decodeURIComponent(escape(atob(desc.sdp_b64)))
    } catch {
      return null
    }
  } else if (typeof desc.sdp === 'string') {
    sdp = desc.sdp
  }
  sdp = repairSdpText(sdp)
  if (!sdp) return null
  return { type, sdp }
}

export function useChatCall({
  user,
  conversationId,
  peerName = '',
  isStaff = false,
  onIncomingInvite = null,
}) {
  const [call, setCall] = useState(null)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const callRef = useRef(null)
  const conversationIdRef = useRef(conversationId)
  const onIncomingInviteRef = useRef(onIncomingInvite)
  const peerNameRef = useRef(peerName)
  const pendingOfferRef = useRef(null)
  const earlyOffersRef = useRef(new Map())
  const pendingIceRef = useRef([])
  const acceptedRef = useRef(false)
  const answeringRef = useRef(false)
  const handledSignalRef = useRef(new Set())
  const customerConversationIdRef = useRef(null)

  useEffect(() => {
    callRef.current = call
  }, [call])

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    onIncomingInviteRef.current = onIncomingInvite
  }, [onIncomingInvite])

  useEffect(() => {
    peerNameRef.current = peerName
  }, [peerName])

  const cleanupMedia = useCallback(() => {
    try {
      pcRef.current?.close()
    } catch {
      // ignore
    }
    pcRef.current = null

    localStreamRef.current?.getTracks()?.forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore
      }
    })
    localStreamRef.current = null
    remoteStreamRef.current = null
    pendingOfferRef.current = null
    earlyOffersRef.current.clear()
    pendingIceRef.current = []
    acceptedRef.current = false
    answeringRef.current = false
    handledSignalRef.current.clear()
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
  }, [])

  const postSignal = useCallback(async (action, { callId, payload, conversationId: cid } = {}) => {
    const active = callRef.current
    const id = cid || conversationIdRef.current || active?.conversationId
    const resolvedCallId = callId || active?.id
    if (!id || !resolvedCallId) return
    await api.post(`/chat/conversations/${id}/call`, {
      action,
      call_type: 'audio',
      call_id: resolvedCallId,
      payload: payload || undefined,
    })
  }, [])

  const attachLocalStream = useCallback((stream) => {
    localStreamRef.current = stream
  }, [])

  const attachRemoteAudio = useCallback((stream) => {
    if (!stream || !remoteAudioRef.current) return
    remoteAudioRef.current.srcObject = stream
    remoteAudioRef.current.play().catch(() => {})
  }, [])

  const flushIce = useCallback(async (pc) => {
    if (!pc || !pendingIceRef.current.length) return
    const queued = [...pendingIceRef.current]
    pendingIceRef.current = []
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        // ignore bad/early candidates
      }
    }
  }, [])

  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    const remoteStream = new MediaStream()
    remoteStreamRef.current = remoteStream
    attachRemoteAudio(remoteStream)

    pc.ontrack = (event) => {
      const stream = remoteStreamRef.current || new MediaStream()
      remoteStreamRef.current = stream
      if (event.streams?.[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!stream.getTracks().some((t) => t.id === track.id)) {
            stream.addTrack(track)
          }
        })
      } else if (event.track) {
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track)
        }
      }
      attachRemoteAudio(stream)
      setCall((prev) => (prev && prev.status !== 'active' ? { ...prev, status: 'active' } : prev))
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !callRef.current) return
      postSignal('ice', {
        payload: { candidate: event.candidate.toJSON() },
      }).catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        setCall((prev) => (prev ? { ...prev, status: 'active' } : prev))
      }
      if (state === 'failed') {
        setError('Call connection failed.')
        cleanupMedia()
        setCall(null)
      }
    }

    return pc
  }, [attachRemoteAudio, cleanupMedia, postSignal])

  const getMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
    attachLocalStream(stream)
    return stream
  }, [attachLocalStream])

  const answerRemoteOffer = useCallback(async (offerSdp, activeCall) => {
    const sdp = normalizeSdp(offerSdp)
    if (!sdp || !activeCall) return
    if (answeringRef.current) return

    const pc = ensurePeerConnection()
    if (!localStreamRef.current) {
      throw new Error('Microphone is not ready yet.')
    }

    // Already answered this call.
    if (pc.signalingState === 'stable' && pc.currentRemoteDescription) {
      pendingOfferRef.current = null
      return
    }

    answeringRef.current = true
    try {
      const senders = pc.getSenders()
      localStreamRef.current.getTracks().forEach((track) => {
        if (!senders.some((sender) => sender.track?.id === track.id)) {
          pc.addTrack(track, localStreamRef.current)
        }
      })

      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      await flushIce(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await postSignal('answer', {
        callId: activeCall.id,
        callType: activeCall.type,
        conversationId: activeCall.conversationId,
        payload: { sdp: toSdpPayload(pc.localDescription) },
      })
      pendingOfferRef.current = null
      setCall((prev) => (prev ? { ...prev, status: 'active', pendingOffer: null } : prev))
    } finally {
      answeringRef.current = false
    }
  }, [ensurePeerConnection, flushIce, postSignal])

  const endCall = useCallback(async ({ remote = false } = {}) => {
    const active = callRef.current
    if (!active) return
    if (!remote) {
      try {
        await postSignal('end', {
          callId: active.id,
          callType: active.type,
          conversationId: active.conversationId,
        })
      } catch {
        // ignore
      }
    }
    cleanupMedia()
    setMuted(false)
    setCall(null)
    setError('')
  }, [cleanupMedia, postSignal])

  const startCall = useCallback(async () => {
    if (!conversationId || !user?.id || callRef.current) return
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError('Calls are not supported in this browser.')
      return
    }

    const callId = newCallId()
    pendingOfferRef.current = null
    earlyOffersRef.current.clear()
    pendingIceRef.current = []
    acceptedRef.current = false
    answeringRef.current = false
    handledSignalRef.current.clear()
    setError('')
    setCall({
      id: callId,
      type: 'audio',
      role: 'caller',
      status: 'outgoing',
      peerName: peerName || 'Support',
      conversationId,
    })

    try {
      const stream = await getMedia()
      const pc = ensurePeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await postSignal('invite', { callId, callType: 'audio', conversationId })

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      })
      await pc.setLocalDescription(offer)
      await postSignal('offer', {
        callId,
        callType: 'audio',
        conversationId,
        payload: { sdp: toSdpPayload(pc.localDescription) },
      })
    } catch (err) {
      setError(err?.message || 'Could not start call.')
      cleanupMedia()
      setCall(null)
    }
  }, [conversationId, user?.id, peerName, getMedia, ensurePeerConnection, postSignal, cleanupMedia])

  const acceptCall = useCallback(async () => {
    const active = callRef.current
    if (!active || active.role !== 'callee') return

    try {
      acceptedRef.current = true
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev))
      const stream = await getMedia()
      const pc = ensurePeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await postSignal('accept', {
        callId: active.id,
        callType: active.type,
        conversationId: active.conversationId,
      })

      // Offer usually arrives before accept — answer it now that media is ready.
      const pending = pendingOfferRef.current || active.pendingOffer
      if (pending) {
        await answerRemoteOffer(pending, {
          ...active,
          status: 'connecting',
        })
      }
      // If offer is still in flight, onSignal will answer once it arrives
      // because acceptedRef + localStreamRef are set.
    } catch (err) {
      setError(err?.message || 'Could not answer call.')
      try {
        await postSignal('reject', {
          callId: active.id,
          callType: active.type,
          conversationId: active.conversationId,
        })
      } catch {
        // ignore
      }
      cleanupMedia()
      setCall(null)
    }
  }, [getMedia, ensurePeerConnection, postSignal, cleanupMedia, answerRemoteOffer])

  const rejectCall = useCallback(async () => {
    const active = callRef.current
    if (!active) return
    try {
      await postSignal('reject', {
        callId: active.id,
        callType: active.type,
        conversationId: active.conversationId,
      })
    } catch {
      // ignore
    }
    cleanupMedia()
    setCall(null)
  }, [postSignal, cleanupMedia])

  const toggleMute = useCallback(() => {
    const next = !muted
    localStreamRef.current?.getAudioTracks()?.forEach((track) => {
      track.enabled = !next
    })
    setMuted(next)
  }, [muted])

  // Bind remote audio after overlay mounts (ref is null until Connecting UI renders).
  useEffect(() => {
    if (!call) return
    if (remoteStreamRef.current) attachRemoteAudio(remoteStreamRef.current)
  }, [call?.id, call?.status, attachRemoteAudio])

  const cleanupMediaRef = useRef(cleanupMedia)
  const ensurePeerConnectionRef = useRef(ensurePeerConnection)
  const postSignalRef = useRef(postSignal)
  const answerRemoteOfferRef = useRef(answerRemoteOffer)
  const flushIceRef = useRef(flushIce)
  const userIdRef = useRef(user?.id)

  useEffect(() => { cleanupMediaRef.current = cleanupMedia }, [cleanupMedia])
  useEffect(() => { ensurePeerConnectionRef.current = ensurePeerConnection }, [ensurePeerConnection])
  useEffect(() => { postSignalRef.current = postSignal }, [postSignal])
  useEffect(() => { answerRemoteOfferRef.current = answerRemoteOffer }, [answerRemoteOffer])
  useEffect(() => { flushIceRef.current = flushIce }, [flushIce])
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])

  const handleCallSignal = useCallback(async (payload) => {
    const selfId = userIdRef.current
    if (!payload?.call_id || !selfId || Number(payload.from_user_id) === Number(selfId)) return

    const sdpType = payload?.payload?.sdp?.type || ''
    const sdpFingerprint = payload?.payload?.sdp?.sdp_b64?.slice(0, 24)
      || payload?.payload?.sdp?.sdp?.slice(0, 24)
      || ''
    const cand = payload?.payload?.candidate?.candidate || payload?.payload?.candidate || ''
    const key = `${payload.call_id}:${payload.action}:${sdpType}:${sdpFingerprint}:${typeof cand === 'string' ? cand.slice(0, 64) : ''}`
    if (payload.action !== 'ice') {
      if (handledSignalRef.current.has(key)) return
      handledSignalRef.current.add(key)
      if (handledSignalRef.current.size > 200) handledSignalRef.current.clear()
    }

    const action = payload.action
    const active = callRef.current
    const targetConversationId = Number(
      payload.conversation_id || conversationIdRef.current || 0,
    )
    const sdp = normalizeSdp(payload.payload?.sdp)
    const candidate = payload.payload?.candidate

    if (action === 'offer' && sdp) {
      earlyOffersRef.current.set(payload.call_id, sdp)
      pendingOfferRef.current = sdp
    }

    if (action === 'invite') {
      if (active) {
        if (targetConversationId) {
          api.post(`/chat/conversations/${targetConversationId}/call`, {
            action: 'reject',
            call_type: payload.call_type,
            call_id: payload.call_id,
          }).catch(() => {})
        }
        return
      }
      const earlyOffer = earlyOffersRef.current.get(payload.call_id) || null
      pendingOfferRef.current = earlyOffer
      pendingIceRef.current = []
      acceptedRef.current = false
      answeringRef.current = false
      handledSignalRef.current.clear()
      handledSignalRef.current.add(key)
      if (typeof onIncomingInviteRef.current === 'function' && targetConversationId) {
        onIncomingInviteRef.current(targetConversationId)
      }
      setCall({
        id: payload.call_id,
        type: 'audio',
        role: 'callee',
        status: 'incoming',
        peerName: payload.from_name || peerNameRef.current || 'Caller',
        conversationId: targetConversationId,
        pendingOffer: earlyOffer,
      })
      return
    }

    // Offer can arrive before invite on the customer channel — keep it, don't drop.
    if (action === 'offer' && sdp && (!active || active.id !== payload.call_id)) {
      return
    }

    if (!active || active.id !== payload.call_id) return

    if (action === 'reject' || action === 'end') {
      cleanupMediaRef.current()
      setCall(null)
      return
    }

    if (action === 'accept' && active.role === 'caller') {
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev))
      try {
        const pc = pcRef.current || ensurePeerConnectionRef.current()
        if (pc.localDescription?.type === 'offer') {
          await postSignalRef.current('offer', {
            callId: active.id,
            callType: 'audio',
            conversationId: active.conversationId,
            payload: { sdp: toSdpPayload(pc.localDescription) },
          })
        }
      } catch {
        // ignore
      }
      return
    }

    try {
      if (action === 'offer' && sdp) {
        pendingOfferRef.current = sdp
        setCall((prev) => (prev ? { ...prev, pendingOffer: sdp } : prev))
        const canAnswer = active.role === 'callee'
          && localStreamRef.current
          && (acceptedRef.current || active.status === 'connecting' || active.status === 'active')
        if (canAnswer) await answerRemoteOfferRef.current(sdp, active)
        return
      }

      if (action === 'answer' && sdp) {
        const pc = pcRef.current || ensurePeerConnectionRef.current()
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          await flushIceRef.current(pc)
        }
        setCall((prev) => (prev ? { ...prev, status: 'active' } : prev))
        return
      }

      if (action === 'ice' && candidate) {
        const pc = pcRef.current
        if (!pc || !pc.remoteDescription) {
          pendingIceRef.current.push(candidate)
          return
        }
        try {
          await pc.addIceCandidate(candidate)
        } catch {
          pendingIceRef.current.push(candidate)
        }
      }
    } catch (err) {
      setError(err?.message || 'Call signaling failed.')
    }
  }, [])

  const handleCallSignalRef = useRef(handleCallSignal)
  useEffect(() => { handleCallSignalRef.current = handleCallSignal }, [handleCallSignal])

  // Personal inbox: staff → chat.staff, customer → chat.user.{id}.
  // Customers also join their conversation channel immediately so staff→customer
  // calls ring even when the messenger was never opened this session.
  useEffect(() => {
    if (!user?.id) return undefined

    let cancelled = false
    let retryTimer = null
    const channels = []
    const subscribed = new Set()
    const onSignal = (payload) => handleCallSignalRef.current(payload)

    const listen = (echo, name) => {
      if (subscribed.has(name)) return
      subscribed.add(name)
      const channel = echo.private(name)
      channel.listen('.chat.call', onSignal)
      channels.push(channel)
    }

    const subscribe = async () => {
      if (cancelled) return
      const echo = getEcho()
      if (!echo) {
        retryTimer = window.setTimeout(() => { void subscribe() }, 250)
        return
      }

      if (isStaff) {
        listen(echo, 'chat.staff')
      } else {
        listen(echo, `chat.user.${user.id}`)
        try {
          const { data } = await api.post('/chat/conversations/open')
          const homeId = data?.conversation?.id
          if (homeId && !cancelled) {
            customerConversationIdRef.current = homeId
            listen(echo, `chat.conversation.${homeId}`)
          }
        } catch {
          // Personal channel still receives invites if /open fails.
        }
      }

      const openId = conversationIdRef.current
      if (openId) {
        listen(echo, `chat.conversation.${openId}`)
      }
    }

    void subscribe()

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
      channels.forEach((channel) => {
        try {
          channel.stopListening('.chat.call', onSignal)
        } catch {
          // ignore
        }
      })
    }
  }, [user?.id, isStaff])

  // When staff/customer switches the open thread, listen there too (deduped).
  useEffect(() => {
    if (!user?.id || !conversationId) return undefined
    if (!isStaff && Number(customerConversationIdRef.current) === Number(conversationId)) {
      return undefined
    }

    let cancelled = false
    let retryTimer = null
    let channel = null
    const onSignal = (payload) => handleCallSignalRef.current(payload)

    const subscribe = () => {
      if (cancelled) return
      const echo = getEcho()
      if (!echo) {
        retryTimer = window.setTimeout(subscribe, 250)
        return
      }
      channel = echo.private(`chat.conversation.${conversationId}`)
      channel.listen('.chat.call', onSignal)
    }

    subscribe()

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
      try {
        channel?.stopListening('.chat.call', onSignal)
      } catch {
        // ignore
      }
    }
  }, [user?.id, isStaff, conversationId])

  // Only tear down media when the hook unmounts — switching conversations on
  // incoming invite must not wipe a pending offer / peer connection.
  useEffect(() => () => {
    cleanupMedia()
  }, [cleanupMedia])

  return {
    call,
    muted,
    error,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  }
}
