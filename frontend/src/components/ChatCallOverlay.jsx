import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMicrophone,
  faMicrophoneSlash,
  faPhone,
  faPhoneSlash,
} from '../lib/icons'

export default function ChatCallOverlay({
  call,
  muted,
  error,
  remoteAudioRef,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  t,
}) {
  if (!call) return null

  const statusLabel = {
    outgoing: t('chatCallRinging'),
    incoming: t('chatCallIncoming'),
    connecting: t('chatCallConnecting'),
    active: t('chatCallConnected'),
    ended: t('chatCallEnded'),
  }[call.status] || ''

  return (
    <div className="chat-call-overlay is-audio">
      <div className="chat-call-audio-panel">
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <div className="chat-call-avatar is-lg" aria-hidden="true">
          {(call.peerName || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="chat-call-peer">{call.peerName}</div>
        <div className="chat-call-status">{statusLabel}</div>
      </div>

      {error ? <div className="chat-call-error">{error}</div> : null}

      <div className="chat-call-actions">
        {call.status === 'incoming' ? (
          <>
            <button type="button" className="chat-call-btn is-reject" onClick={onReject} aria-label={t('chatCallDecline')}>
              <FontAwesomeIcon icon={faPhoneSlash} />
            </button>
            <button type="button" className="chat-call-btn is-accept" onClick={onAccept} aria-label={t('chatCallAccept')}>
              <FontAwesomeIcon icon={faPhone} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`chat-call-btn${muted ? ' is-off' : ''}`}
              onClick={onToggleMute}
              aria-label={muted ? t('chatCallUnmute') : t('chatCallMute')}
            >
              <FontAwesomeIcon icon={muted ? faMicrophoneSlash : faMicrophone} />
            </button>
            <button type="button" className="chat-call-btn is-reject" onClick={onEnd} aria-label={t('chatCallEnd')}>
              <FontAwesomeIcon icon={faPhoneSlash} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
