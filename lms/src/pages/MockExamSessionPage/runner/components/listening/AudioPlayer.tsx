import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type AudioPlayerProps = {
  src: string | null
  loading?: boolean
  error?: string | null
  /** Increment to force-pause playback (e.g. after Finish confirm). */
  stopSignal?: number
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatSpeed(rate: number): string {
  return Number.isInteger(rate) ? `${rate}.0` : rate.toFixed(1)
}

export function AudioPlayer({
  src,
  loading = false,
  error = null,
  stopSignal = 0,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const speeds = useMemo(() => {
    const list: number[] = []
    for (let rate = 0.5; rate <= 1.5 + 1e-9; rate += 0.1) {
      list.push(Math.round(rate * 10) / 10)
    }
    return list
  }, [])

  const ready = Boolean(src) && !loading && !error

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrent(audio.currentTime)
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = speed
  }, [speed])

  useEffect(() => {
    if (stopSignal <= 0) return
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setPlaying(false)
  }, [stopSignal])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    if (!src) {
      audio.removeAttribute('src')
      audio.load()
      return
    }
    audio.src = src
    audio.load()
    audio.playbackRate = speedRef.current
  }, [src])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    if (audio.paused) {
      void audio.play().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to play audio'
        window.alert(`Unable to play audio. ${message}`)
      })
    } else {
      audio.pause()
    }
  }, [ready])

  const rewind10 = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    audio.currentTime = Math.max(0, audio.currentTime - 10)
  }, [ready])

  const seek = useCallback(
    (value: number) => {
      const audio = audioRef.current
      if (!audio || !ready) return
      audio.currentTime = value
      setCurrent(value)
    },
    [ready],
  )

  return (
    <div
      className={`audio-player ${loading || !src ? 'audio-player--loading' : ''} ${error ? 'audio-player--error' : ''}`}
      aria-busy={loading || !src}
    >
      <audio ref={audioRef} preload="auto" />
      {error ? (
        <span className="audio-player__loading-text" role="alert">
          {error}
        </span>
      ) : loading || !src ? (
        <span className="audio-player__loading-text">Loading audio…</span>
      ) : (
        <>
          <button
            type="button"
            className="audio-player__btn"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="audio-player__btn"
            onClick={rewind10}
            aria-label="Rewind 10 seconds"
            title="Rewind 10 seconds"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
              <text x="12" y="16" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">
                10
              </text>
            </svg>
          </button>
          <div className="audio-player__track">
            <input
              className="audio-player__seek"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(current, duration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek"
            />
            <div className="audio-player__times">
              <span>{formatTime(current)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <label className="audio-player__speed-wrap">
            <span className="audio-player__speed-label">Speed</span>
            <select
              className="audio-player__speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              aria-label="Playback speed"
              title="Playback speed"
            >
              {speeds.map((rate) => (
                <option key={rate} value={rate}>
                  {formatSpeed(rate)}x
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  )
}
