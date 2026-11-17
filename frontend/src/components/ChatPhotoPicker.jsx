import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faImage, faXmark } from '../lib/icons'

const GALLERY_FLAG = 'chat.galleryAccess'

function readGalleryAllowed() {
  try {
    return sessionStorage.getItem(GALLERY_FLAG) === '1'
  } catch {
    return false
  }
}

function writeGalleryAllowed(value) {
  try {
    sessionStorage.setItem(GALLERY_FLAG, value ? '1' : '0')
  } catch {
    // ignore
  }
}

async function snapshotToFile(video) {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not capture photo.')
  ctx.drawImage(video, 0, 0, width, height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not capture photo.'))),
      'image/jpeg',
      0.92,
    )
  })

  return new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

export default function ChatPhotoPicker({
  photos = [],
  disabled = false,
  onPhotosLoaded,
  onSendPhoto,
  t,
}) {
  const [mode, setMode] = useState('gallery') // gallery | camera
  const [galleryAllowed, setGalleryAllowed] = useState(readGalleryAllowed)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewFile, setPreviewFile] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const galleryInputRef = useRef(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore
      }
    })
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl)
      } catch {
        // ignore
      }
    }
    setPreviewUrl('')
    setPreviewFile(null)
  }, [previewUrl])

  const startCamera = useCallback(async (facing = facingMode) => {
    setCameraError('')
    setCameraReady(false)
    clearPreview()
    stopCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('chatCameraUnsupported'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play().catch(() => {})
      }
      setCameraReady(true)
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      setCameraError(denied ? t('chatCameraDenied') : (err?.message || t('chatCameraUnsupported')))
      setCameraReady(false)
    }
  }, [facingMode, clearPreview, stopCamera, t])

  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera()
      clearPreview()
      return undefined
    }
    void startCamera(facingMode)
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, facingMode])

  useEffect(() => () => {
    stopCamera()
    clearPreview()
  }, [stopCamera, clearPreview])

  function openGalleryPicker() {
    galleryInputRef.current?.click()
  }

  function allowGalleryAccess() {
    writeGalleryAllowed(true)
    setGalleryAllowed(true)
    // Must open the picker in the same user gesture for mobile browsers.
    openGalleryPicker()
  }

  function onGalleryPick(e) {
    const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    writeGalleryAllowed(true)
    setGalleryAllowed(true)
    onPhotosLoaded?.(files)
  }

  async function capturePhoto() {
    if (!videoRef.current || !cameraReady || disabled) return
    try {
      const file = await snapshotToFile(videoRef.current)
      clearPreview()
      const url = URL.createObjectURL(file)
      setPreviewFile(file)
      setPreviewUrl(url)
      stopCamera()
    } catch (err) {
      setCameraError(err?.message || t('chatCameraUnsupported'))
    }
  }

  async function useCapturedPhoto() {
    if (!previewFile || disabled) return
    const file = previewFile
    clearPreview()
    setMode('gallery')
    onPhotosLoaded?.([file])
    await onSendPhoto?.(file)
  }

  function retakePhoto() {
    clearPreview()
    void startCamera(facingMode)
  }

  function flipCamera() {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  if (mode === 'camera') {
    return (
      <div className="chat-photo-camera">
        <div className="chat-photo-camera-stage">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="chat-photo-camera-preview" />
          ) : (
            <video ref={videoRef} className="chat-photo-camera-video" autoPlay muted playsInline />
          )}
          {!previewUrl && !cameraReady && !cameraError ? (
            <div className="chat-photo-camera-status">{t('chatCameraStarting')}</div>
          ) : null}
          {cameraError ? <div className="chat-photo-camera-status is-error">{cameraError}</div> : null}
        </div>

        <div className="chat-photo-camera-actions">
          <button
            type="button"
            className="chat-photo-camera-btn is-ghost"
            onClick={() => {
              clearPreview()
              stopCamera()
              setMode('gallery')
            }}
          >
            <FontAwesomeIcon icon={faXmark} />
            <span>{t('dismiss')}</span>
          </button>

          {previewUrl ? (
            <>
              <button type="button" className="chat-photo-camera-btn is-ghost" onClick={retakePhoto} disabled={disabled}>
                {t('chatCameraRetake')}
              </button>
              <button type="button" className="chat-photo-camera-btn is-primary" onClick={useCapturedPhoto} disabled={disabled}>
                {t('chatSendPhoto')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="chat-photo-camera-shutter"
                onClick={capturePhoto}
                disabled={disabled || !cameraReady}
                aria-label={t('chatCameraCapture')}
              />
              <button type="button" className="chat-photo-camera-btn is-ghost" onClick={flipCamera} disabled={!!cameraError}>
                {t('chatCameraFlip')}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="chat-photo-sheet">
      <input
        ref={galleryInputRef}
        type="file"
        className="sr-only"
        accept="image/*"
        multiple
        onChange={onGalleryPick}
      />

      {!galleryAllowed ? (
        <div className="chat-photo-permission">
          <div className="chat-photo-permission-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faImage} />
          </div>
          <div className="chat-photo-permission-title">{t('chatGalleryPermissionTitle')}</div>
          <p className="chat-photo-permission-copy">{t('chatGalleryPermissionBody')}</p>
          <div className="chat-photo-permission-actions">
            <button type="button" className="chat-photo-permission-btn is-primary" onClick={allowGalleryAccess}>
              {t('chatGalleryAllow')}
            </button>
            <button
              type="button"
              className="chat-photo-permission-btn"
              onClick={() => setMode('camera')}
              disabled={disabled}
            >
              <FontAwesomeIcon icon={faCamera} />
              {t('chatCamera')}
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-photo-grid">
          <button
            type="button"
            className="chat-photo-tile is-camera"
            onClick={() => setMode('camera')}
            aria-label={t('chatCamera')}
            disabled={disabled}
          >
            <FontAwesomeIcon icon={faCamera} />
            <span>{t('chatCamera')}</span>
          </button>

          {photos.map((row) => (
            <button
              key={row.id}
              type="button"
              className="chat-photo-tile"
              onClick={() => onSendPhoto?.(row.file)}
              aria-label={t('chatSendPhoto')}
              disabled={disabled}
            >
              <img src={row.url} alt="" />
            </button>
          ))}

          <button
            type="button"
            className="chat-photo-tile is-gallery"
            onClick={openGalleryPicker}
            aria-label={t('chatGalleryAdd')}
            disabled={disabled}
          >
            <FontAwesomeIcon icon={faImage} />
            <span>{photos.length ? t('chatGalleryAdd') : t('chatGallery')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
