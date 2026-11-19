import clsx from 'clsx'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { registerAndroidBackHandler } from '../../app/androidBack.js'
import { useTranslate } from '../../i18n/index.js'
import { useSettings } from '../../services/settings.js'
import {
  endVoiceCall,
  flushVoiceCallSpeech,
  interruptVoiceCall,
  setVoiceCallVideoElement,
  switchVoiceCallCamera,
  toggleVoiceCallCamera,
  toggleVoiceCallMute,
  useVoiceCall,
} from '../../services/speech/voiceCall.js'
import {
  IconCameraOff16,
  IconCameraOutline16,
  IconCloseOutline16,
  IconFlipCamera16,
  IconMicOff16,
  IconMicOutline16,
  IconPhoneOff16,
  IconSendOutline16,
  IconStopFill16,
} from '../base/icons.js'
import { Tooltip } from '../base/Tooltip.js'
import styles from './VoiceCallOverlay.module.css'

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** 独立全屏语音 / 视频通话界面，不是悬浮窗式弹层 */
export const VoiceCallOverlay = () => {
  const t = useTranslate()
  const call = useVoiceCall()
  const model = useSettings((state) => state.model)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    setVoiceCallVideoElement(video)
    if (video) {
      video.srcObject = call.videoStream
      if (call.videoStream) {
        void video.play().catch(() => {})
      }
    }
    return () => {
      if (video) {
        video.srcObject = null
      }
      setVoiceCallVideoElement(null)
    }
  }, [call.videoStream, call.cameraEnabled])

  useEffect(() => {
    if (!call.active) {
      setElapsed(0)
      return
    }
    const startedAt = Date.now()
    setElapsed(0)
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [call.active])

  useEffect(() => {
    if (!call.active) {
      return
    }
    const bridge = (
      window as {
        __HLDSC_ANDROID_BRIDGE__?: {
          enterCallMode?: () => void
          exitCallMode?: () => void
        }
      }
    ).__HLDSC_ANDROID_BRIDGE__
    bridge?.enterCallMode?.()
    return () => {
      bridge?.exitCallMode?.()
    }
  }, [call.active])

  useEffect(() => {
    if (!call.active) {
      return
    }
    const unregisterBack = registerAndroidBackHandler(150, () => {
      endVoiceCall()
      return true
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        endVoiceCall()
      } else if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        interruptVoiceCall()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      unregisterBack()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [call.active])

  if (!call.active) {
    return null
  }

  const busy =
    call.phase === 'transcribing' || call.phase === 'thinking' || call.phase === 'speaking'
  const errorMessage =
    call.error === null
      ? null
      : typeof call.error === 'string'
        ? call.error
        : t(call.error.key, call.error.params)
  const statusLabel = errorMessage
    ? errorMessage
    : call.phase === 'muted'
      ? t('voiceCallMuted')
      : call.phase === 'transcribing'
        ? t('voiceCallTranscribing')
        : call.phase === 'thinking'
          ? t('voiceCallThinking')
          : call.phase === 'speaking'
            ? t('voiceCallSpeaking')
            : call.speechDetected
              ? t('voiceCallHearing')
              : t('voiceCallListening')

  const videoMode = call.cameraEnabled && Boolean(call.videoStream)
  const title = videoMode ? t('voiceCallVideoTitle') : t('voiceCallAudioTitle')
  const levelStyle = { '--call-level': String(call.level) } as CSSProperties
  const transcript =
    call.userText || call.assistantText ? (
      <div className={styles.transcriptBox}>
        {call.userText ? <div className={styles.userCaption}>{call.userText}</div> : null}
        {call.assistantText ? (
          <div className={styles.assistantCaption}>{call.assistantText}</div>
        ) : null}
      </div>
    ) : null

  return createPortal(
    <div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={levelStyle}
    >
      {videoMode ? (
        <div className={styles.videoLayer}>
          <video
            ref={videoRef}
            className={clsx(
              styles.videoElement,
              call.facingMode === 'user' && styles.videoMirror
            )}
            autoPlay
            playsInline
            muted
          />
          <div className={styles.videoTopShade} />
          <div className={styles.videoBottomShade} />
        </div>
      ) : null}

      <header className={clsx(styles.topBar, videoMode && styles.topBarVideo)}>
        <div className={styles.brandLockup}>
          <img className={styles.brandMark} src="./assets/icon.svg" alt="" />
          <span className={styles.brandName}>hl-dsc</span>
        </div>
        <div className={styles.callHeading}>
          <div className={styles.callTitle}>{title}</div>
          <div className={styles.callMeta}>
            <span className={clsx(styles.liveDot, call.muted && styles.liveDotMuted)} />
            <span>{formatDuration(elapsed)}</span>
            <span className={styles.metaDivider}>·</span>
            <span className={styles.modelName}>{model}</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.topClose}
          aria-label={t('voiceCallHangUp')}
          onClick={endVoiceCall}
        >
          <IconCloseOutline16 />
        </button>
      </header>

      {videoMode ? (
        <div className={styles.videoStatusWrap}>
          <div className={styles.statusPill}>
            <span className={clsx(styles.liveDot, call.muted && styles.liveDotMuted)} />
            <span>{statusLabel}</span>
          </div>
        </div>
      ) : (
        <main className={styles.audioStage}>
          <button
            type="button"
            className={styles.avatarButton}
            aria-label={busy ? t('voiceCallInterrupt') : statusLabel}
            onClick={() => {
              if (busy || call.speechDetected) {
                interruptVoiceCall()
              }
            }}
          >
            <span className={styles.avatarRing} />
            <span className={styles.avatarRingOuter} />
            <img className={styles.avatar} src="./assets/icon.svg" alt="" />
            <span className={styles.avatarBadge}>
              {call.muted ? <IconMicOff16 /> : <span className={styles.avatarWave} />}
            </span>
          </button>
          <div className={styles.audioName}>hl-dsc</div>
          <div className={clsx(styles.statusText, errorMessage && styles.errorText)}>
            {statusLabel}
          </div>
          {transcript}
        </main>
      )}

      <footer className={clsx(styles.bottomBar, videoMode && styles.bottomBarVideo)}>
        {videoMode ? transcript : null}
        <div className={styles.controls}>
          <Tooltip content={call.muted ? t('voiceCallUnmute') : t('voiceCallMute')}>
            <button
              type="button"
              className={clsx(styles.controlBtn, call.muted && styles.controlBtnActive)}
              aria-label={call.muted ? t('voiceCallUnmute') : t('voiceCallMute')}
              aria-pressed={call.muted}
              onClick={toggleVoiceCallMute}
            >
              {call.muted ? <IconMicOff16 /> : <IconMicOutline16 />}
            </button>
          </Tooltip>

          <Tooltip content={call.cameraEnabled ? t('voiceCallCameraOff') : t('voiceCallCameraOn')}>
            <button
              type="button"
              className={clsx(styles.controlBtn, call.cameraEnabled && styles.controlBtnActive)}
              aria-label={call.cameraEnabled ? t('voiceCallCameraOff') : t('voiceCallCameraOn')}
              aria-pressed={call.cameraEnabled}
              disabled={call.cameraPending}
              onClick={toggleVoiceCallCamera}
            >
              {call.cameraEnabled ? <IconCameraOutline16 /> : <IconCameraOff16 />}
            </button>
          </Tooltip>

          {call.cameraEnabled ? (
            <Tooltip content={t('voiceCallSwitchCamera')}>
              <button
                type="button"
                className={styles.controlBtn}
                aria-label={t('voiceCallSwitchCamera')}
                disabled={call.cameraPending}
                onClick={switchVoiceCallCamera}
              >
                <IconFlipCamera16 />
              </button>
            </Tooltip>
          ) : null}

          {busy ? (
            <Tooltip content={t('voiceCallInterrupt')}>
              <button
                type="button"
                className={styles.controlBtn}
                aria-label={t('voiceCallInterrupt')}
                onClick={interruptVoiceCall}
              >
                <IconStopFill16 />
              </button>
            </Tooltip>
          ) : call.phase === 'listening' && call.speechDetected ? (
            <Tooltip content={t('voiceCallSendNow')}>
              <button
                type="button"
                className={styles.controlBtn}
                aria-label={t('voiceCallSendNow')}
                onClick={flushVoiceCallSpeech}
              >
                <IconSendOutline16 />
              </button>
            </Tooltip>
          ) : null}

          <Tooltip content={t('voiceCallHangUp')}>
            <button
              type="button"
              className={styles.hangupBtn}
              aria-label={t('voiceCallHangUp')}
              onClick={endVoiceCall}
            >
              <IconPhoneOff16 />
            </button>
          </Tooltip>
        </div>
        <p className={styles.callHint}>{t('voiceCallHint')}</p>
      </footer>
    </div>,
    document.body
  )
}
