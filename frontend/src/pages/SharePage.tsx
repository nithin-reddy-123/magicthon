import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMeme, react, reactionStream, reactionTotals } from '../lib/api'
import BgBlobs from '../components/BgBlobs'

const REACTIONS = [
  { kind: 'laugh', emoji: '😂', label: 'laugh' },
  { kind: 'dead', emoji: '💀', label: 'dead' },
  { kind: 'fire', emoji: '🔥', label: 'fire' },
  { kind: 'mid', emoji: '🥱', label: 'mid' },
  { kind: 'love', emoji: '❤️', label: 'love' }
]

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function SharePage() {
  const { slug } = useParams<{ slug: string }>()
  const [meme, setMeme] = useState<any>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [bumped, setBumped] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    getMeme(slug).then(setMeme).catch(e => setErr(e.message))
    reactionTotals(slug).then(r => { setCounts(r.counts || {}); setTotal(r.total || 0) })
    const stop = reactionStream(slug, r => {
      setCounts(r.counts || {})
      setTotal(r.total || 0)
    })
    return stop
  }, [slug])

  async function send(kind: string) {
    if (!slug || !imageLoaded) return
    setBumped(kind)
    setTimeout(() => setBumped(null), 400)
    try {
      const r = await react(slug, kind)
      setCounts(r.counts || {})
      setTotal(r.total || 0)
    } catch {}
  }

  if (err) return <ErrorState />

  return (
    <div className="share-page">
      <BgBlobs />
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <span className="sticker">
          <span className="dot" />
          magicthon.live
        </span>
        {meme?.caption && (
          <p className="share-caption" style={{
            color: 'var(--text-dim)',
            fontSize: 14,
            marginTop: 14,
            fontFamily: 'Space Mono, monospace',
            maxWidth: 480,
            margin: '14px auto 0'
          }}>
            {meme.caption}
          </p>
        )}
      </div>

      <div className={`share-meme ${!imageLoaded ? 'is-loading' : ''}`}>
        {!imageLoaded && (
          <div className="skeleton skeleton-meme">
            <span className="glow">
              <span className="spinner" />
              loading the meme…
            </span>
          </div>
        )}
        {meme && (
          <img
            src={API + meme.imageUrl}
            alt="meme"
            onLoad={() => setImageLoaded(true)}
            style={!imageLoaded ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : {}}
          />
        )}
      </div>

      <div className={`reactions-bar ${!imageLoaded ? 'dimmed' : ''}`}>
        {REACTIONS.map(r => {
          const n = counts[r.kind] || 0
          return (
            <button key={r.kind} className="react-btn" onClick={() => send(r.kind)} disabled={!imageLoaded}>
              <span className={bumped === r.kind ? 'pop' : ''} style={{ fontSize: 22 }}>{r.emoji}</span>
              <span className="count" key={`${r.kind}-${n}`}>{n}</span>
            </button>
          )
        })}
      </div>

      <p className="live-count" style={{
        textAlign: 'center',
        marginTop: 16,
        color: 'var(--text-faint)',
        fontFamily: 'Space Mono, monospace',
        fontSize: 12,
        letterSpacing: '0.12em'
      }}>
        {imageLoaded ? `${total} reaction${total === 1 ? '' : 's'} · live` : 'connecting…'}
      </p>

      <div style={{ flex: 1 }} />
      <p className="share-footer" style={{
        textAlign: 'center',
        padding: '40px 0 8px',
        color: 'var(--text-faint)',
        fontSize: 13,
        fontFamily: 'Space Mono, monospace'
      }}>
        made on magicthon · <a href="/" style={{ color: 'var(--lime)' }}>make your own →</a>
      </p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="share-page">
      <BgBlobs />
      <div style={{ textAlign: 'center', marginTop: 80 }}>
        <span className="sticker">404 · not found</span>
        <p className="display-sm" style={{ marginTop: 24 }}>this meme<br/>doesn't exist.</p>
        <p style={{ color: 'var(--text-dim)', marginTop: 14, fontFamily: 'Space Mono, monospace', fontSize: 13 }}>
          maybe the creator deleted it. or the link's wrong.
        </p>
        <p style={{ marginTop: 28 }}>
          <a href="/" style={{ color: 'var(--lime)', fontFamily: 'Space Mono, monospace', fontSize: 14 }}>
            ← make your own
          </a>
        </p>
      </div>
    </div>
  )
}
