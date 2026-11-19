import clsx from 'clsx'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { getDraft, setDraftText } from '../../services/chat/drafts.js'
import { selectSession, useChatStore } from '../../services/chat/store.js'
import { startVoiceCall } from '../../services/speech/voiceCall.js'
import {
  IconAttachmentOutline22,
  IconChatBubbleOutline16,
  IconGalleryOutline22,
  IconVoiceCall16,
} from '../base/icons.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

type HomeVariant = 'desk' | 'sheet' | 'ledger'

const readVariant = (): HomeVariant => {
  if (typeof window === 'undefined') {
    return 'desk'
  }
  const value = new URLSearchParams(window.location.search).get('design')
  return value === 'sheet' || value === 'ledger' ? value : 'desk'
}

const formatRecentTime = (value: number) => {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' }).format(date)
}

/** 新对话：像一张安静的工作台。先选择要完成的事，再开始对话。 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const variant = readVariant()
  const sessions = useChatStore((state) => state.sessions)
  const recent = sessions.slice(0, 4)

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
    <div className={clsx(styles.container, styles[variant])}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className={styles.canvas}>
          <section className={styles.hero}>
            <div className={styles.brandRow}>
              <img className={styles.mark} src="./assets/icon.svg" alt="" />
              <span className={styles.brandName}>hl-dsc</span>
              <span className={styles.brandRule} aria-hidden="true" />
              <span className={styles.brandMeta}>{t('homeWorkspaceLabel')}</span>
            </div>
            <h1 className={styles.greeting}>{t('welcomeMessageChat250808')}</h1>
            <p className={styles.tagline}>{t('welcomeTagline')}</p>
            <div className={styles.toolRail} role="list" aria-label={t('welcomeTagline')}>
              {starters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="listitem"
                  className={styles.toolButton}
                  onClick={item.onClick}
                >
                  <span className={styles.toolTop}>
                    <span className={styles.toolIcon}>{item.icon}</span>
                    <span className={styles.toolLabel}>{item.label}</span>
                  </span>
                  <span className={styles.toolHint}>{item.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className={styles.recent} aria-label={t('homeRecentTitle')}>
            <div className={styles.recentHead}>
              <h2>{t('homeRecentTitle')}</h2>
              <span>{t('homeRecentHint')}</span>
            </div>
            {recent.length > 0 ? (
              <div className={styles.recentList}>
                {recent.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={styles.recentRow}
                    onClick={() => selectSession(session.id)}
                  >
                    <span className={styles.recentIcon} aria-hidden="true">
                      <IconChatBubbleOutline16 />
                    </span>
                    <span className={styles.recentTitle}>
                      {session.title || t('untitledChat')}
                    </span>
                    <span className={styles.recentTime}>{formatRecentTime(session.updatedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.recentEmpty}>{t('homeRecentEmpty')}</p>
            )}
          </aside>
        </div>

        <div className={styles.composer}>
          <ChatInput sessionId={null} />
        </div>
        {isMobile ? <div className={styles.caveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}
