import { useCallback, useEffect, useState } from 'react'

type TopBarProps = {
  candidateId: string
  remainingSeconds: number
  paused: boolean
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

export function TopBar({ candidateId, remainingSeconds, paused }: TopBarProps) {
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
    <header className="top-bar">
      <div className="top-bar__left">
        <span className="top-bar__candidate">Candidate: {candidateId}</span>
        <span className={`top-bar__timer ${paused ? 'is-paused' : ''}`}>
          {paused ? 'Paused · ' : ''}
          {formatMinutesLabel(remainingSeconds)}
        </span>
      </div>
      <div className="top-bar__right">
        <span className="icon-btn" title="Settings" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
          </svg>
        </span>
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
