import { useCallback, useEffect, useState } from 'react'
import { AudioPlayer } from './AudioPlayer'

type ListeningTopBarProps = {
  testTitle: string
  candidateId: string
  remainingSeconds: number
  paused: boolean
  audioSrc: string | null
  audioLoading?: boolean
  audioError?: string | null
  audioStopSignal?: number
}

function formatMinutesLabel(seconds: number): string {
  const minutes = Math.max(0, Math.ceil(seconds / 60))
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
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
  } catch {
    window.alert('Unable to enter fullscreen. Please allow fullscreen for this page.')
  }
}

export function ListeningTopBar({
  testTitle,
  candidateId,
  remainingSeconds,
  paused,
  audioSrc,
  audioLoading = false,
  audioError = null,
  audioStopSignal = 0,
}: ListeningTopBarProps) {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setFullscreen(isFullscreenActive())
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const handleFullscreen = useCallback(() => {
    void toggleFullscreen()
  }, [])

  return (
    <header className="listening-top">
      <div className="listening-top__left">
        <strong className="top-bar__title">{testTitle}</strong>
        <span className="listening-top__candidate">Candidate: {candidateId}</span>
        <span className={`listening-top__timer ${paused ? 'is-paused' : ''}`}>
          {paused ? 'Paused · ' : ''}
          {formatMinutesLabel(remainingSeconds)}
        </span>
      </div>
      <div className="listening-top__center">
        <AudioPlayer
          src={audioSrc}
          loading={audioLoading}
          error={audioError}
          stopSignal={audioStopSignal}
        />
      </div>
      <div className="listening-top__right">
        <button
          type="button"
          className="icon-btn icon-btn--clickable"
          title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
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
