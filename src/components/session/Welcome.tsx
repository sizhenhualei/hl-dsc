import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { getDraft, setDraftText } from '../../services/chat/drafts.js'
import { startVoiceCall } from '../../services/speech/voiceCall.js'
import {
  IconAttachmentOutline22,
  IconGalleryOutline22,
  IconVoiceCall16,
} from '../base/icons.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

/** 新对话：问候语 + 快捷入口 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()

  const pick = (kind: 'file' | 'photo') => {
    if (!getDraft(null).text.trim()) {
      setDraftText(null, kind === 'file' ? t('starterDocumentPrompt') : t('starterPhotoPrompt'))
    }
    window.dispatchEvent(new CustomEvent('hl-dsc:pick', { detail: kind }))
  }

  const starters = [
    {
      key: 'document',
      icon: <IconAttachmentOutline22 />,
      label: t('starterDocument'),
      hint: t('starterDocumentHint'),
      onClick: () => pick('file'),
    },
    {
      key: 'photo',
      icon: <IconGalleryOutline22 />,
      label: t('starterPhoto'),
      hint: t('starterPhotoHint'),
      onClick: () => pick('photo'),
    },
    {
      key: 'voice',
      icon: <IconVoiceCall16 />,
      label: t('starterVoice'),
      hint: t('starterVoiceHint'),
      onClick: () => startVoiceCall(null),
    },
  ] as const

  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className={styles.hero}>
          <div className={styles.brandRow}>
            <img className={styles.mark} src="./assets/icon.svg" alt="" />
            <span className={styles.brandName}>hl-dsc</span>
            <span className={styles.brandDot} aria-hidden="true" />
          </div>
          <h1 className={styles.greeting}>{t('welcomeMessageChat250808')}</h1>
          <p className={styles.tagline}>{t('welcomeTagline')}</p>
          <div className={styles.starters} aria-label={t('welcomeTagline')}>
            {starters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={styles.starter}
                onClick={item.onClick}
              >
                <span className={styles.starterIcon}>{item.icon}</span>
                <span className={styles.starterText}>
                  <span className={styles.starterLabel}>{item.label}</span>
                  <span className={styles.starterHint}>{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.composer}>
          <ChatInput sessionId={null} />
        </div>
        {isMobile ? <div className={styles.caveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}
