import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';
import {useTranslation} from 'react-i18next';
import { useCallback, useEffect, useState } from 'react'

type TopBarProps = {
  testTitle: string
  candidateId: string
  remainingSeconds: number
  paused: boolean
}

function formatMinutesLabel(seconds: number, paused: boolean): string {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  return i18n.t(paused ? 'exams:runner.pausedRemaining' : 'exams:runner.remaining', {count: minutes, minutes: formatNumber(minutes)});
}

function isFullscreenActive(): boolean {
  return Boolean(document.fullscreenElement)
}

async function toggleFullscreen() {
  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
    return true
  } catch {
    return false
  }
}

export function TopBar({ testTitle, candidateId, remainingSeconds, paused }: TopBarProps) {
  const {t: translate} = useTranslation();
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)

  useEffect(() => {
    const sync = () => setFullscreen(isFullscreenActive())
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const handleFullscreen = useCallback(() => {
    void toggleFullscreen().then(success => setFullscreenError(!success))
  }, [])

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <strong className="top-bar__title">{testTitle}</strong>
        <span className="top-bar__candidate">{translate('exams:runner.candidate', {id: candidateId})}</span>
      </div>
      <div className="top-bar__right">
        <span className={`top-bar__timer ${paused ? 'is-paused' : ''}`}>
                    {formatMinutesLabel(remainingSeconds, paused)}
        </span>
        {fullscreenError ? <span role="alert">{translate('exams:runner.fullscreenError')}</span> : null}
        <button
          type="button"
          className="icon-btn icon-btn--clickable"
          title={fullscreen ? translate('exams:runner.exitFullscreen') : translate('exams:runner.enterFullscreen')}
          aria-label={fullscreen ? translate('exams:runner.exitFullscreen') : translate('exams:runner.enterFullscreen')}
          aria-pressed={fullscreen}
          onClick={handleFullscreen}
        >
          {fullscreen ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 9h5V4M15 4v5h5M4 15h5v5M15 20v-5h5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}
