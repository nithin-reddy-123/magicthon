import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ImageInput from '../components/ImageInput'
import IdeaGrid from '../components/IdeaGrid'
import MemeCanvas, { MemeCanvasHandle, TextLayer } from '../components/MemeCanvas'
import BgBlobs from '../components/BgBlobs'
import { analyzeImage, MemeIdea, saveMeme } from '../lib/api'

type Stage = 'upload' | 'ideas' | 'editor' | 'shared'

const FONTS = [
  { label: 'Impact', value: 'Impact, "Anton", sans-serif' },
  { label: 'Anton', value: '"Anton", sans-serif' },
  { label: 'Bangers', value: '"Bangers", cursive' },
  { label: 'Bricolage', value: '"Bricolage Grotesque", sans-serif' },
  { label: 'Inter', value: '"Inter", sans-serif' }
]

const COLORS = ['#ffffff', '#c6f24e', '#ff5436', '#ffd700', '#000000']

function normalizeFmt(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '')
}

function initialLayers(idea: MemeIdea, w: number, h: number): TextLayer[] {
  const f = normalizeFmt(idea.format)
  const pad = Math.round(w * 0.04)
  const layers: TextLayer[] = []

  const big = Math.round(Math.min(w, h) * 0.075)
  const med = Math.round(Math.min(w, h) * 0.055)
  const small = Math.round(Math.min(w, h) * 0.042)

  const impactLayer = (id: string, text: string, y: number): TextLayer => ({
    id,
    text: (text || '').toUpperCase(),
    x: pad,
    y,
    width: w - pad * 2,
    fontFamily: 'Impact, "Anton", sans-serif',
    fontSize: big,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: Math.max(2, Math.round(big * 0.08))
  })

  const softLayer = (id: string, text: string, y: number, size = med): TextLayer => ({
    id,
    text: text || '',
    x: pad,
    y,
    width: w - pad * 2,
    fontFamily: '"Inter", sans-serif',
    fontSize: size,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: Math.max(2, Math.round(size * 0.07))
  })

  if (f === 'topbottom') {
    if (idea.topText) layers.push(impactLayer('top', idea.topText, pad))
    if (idea.bottomText) layers.push(impactLayer('bottom', idea.bottomText, h - pad - big * 2))
  } else if (f === 'thoughts') {
    if (idea.topText) layers.push(softLayer('top', idea.topText, pad))
    if (idea.bottomText) layers.push(softLayer('bottom', idea.bottomText, h - pad - med * 2))
  } else if (f === 'pov' || f === 'telltale') {
    const t = idea.topText || idea.bottomText
    if (t) layers.push(softLayer('top', t, pad, small))
  } else if (f === 'caption' || f === 'deadpan') {
    const t = idea.bottomText || idea.topText
    if (t) layers.push(softLayer('bottom', t, h - pad - small * 2.4, small))
  } else {
    if (idea.topText) layers.push(impactLayer('top', idea.topText, pad))
    if (idea.bottomText) layers.push(impactLayer('bottom', idea.bottomText, h - pad - big * 2))
  }
  return layers
}

export default function HomePage() {
  const [stage, setStage] = useState<Stage>('upload')
  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [imageDims, setImageDims] = useState<{ w: number; h: number }>({ w: 720, h: 720 })
  const [ideas, setIdeas] = useState<MemeIdea[]>([])
  const [selectedIdea, setSelectedIdea] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [layers, setLayers] = useState<TextLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [shareUrl, setShareUrl] = useState<string>('')
  const [displayWidth, setDisplayWidth] = useState(720)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const canvasRef = useRef<MemeCanvasHandle>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stage])

  useLayoutEffect(() => {
    function measure() {
      if (!canvasWrapRef.current) return
      const cs = getComputedStyle(canvasWrapRef.current)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const w = canvasWrapRef.current.clientWidth - padX
      setDisplayWidth(Math.max(240, Math.min(720, w)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (canvasWrapRef.current) ro.observe(canvasWrapRef.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [stage])

  async function handlePicked(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl)
    const img = new Image()
    img.onload = () => {
      const ratio = img.height / img.width
      const w = 720
      const h = w * ratio
      setImageDims({ w, h })
    }
    img.src = dataUrl

    setAnalyzing(true)
    try {
      const got = await analyzeImage(file)
      if (got.length === 0) {
        alert('No ideas came back from the model. Try another photo.')
        setAnalyzing(false)
        return
      }
      setIdeas(got)
      setStage('ideas')
    } catch (e) {
      alert('Failed to analyze: ' + (e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  function pickIdea(i: number) {
    setSelectedIdea(i)
    const idea = ideas[i]
    setLayers(initialLayers(idea, imageDims.w, imageDims.h))
    setSelectedId(null)
    setStage('editor')
  }

  function backToIdeas() {
    setStage('ideas')
    setSelectedId(null)
  }

  function startOver() {
    setStage('upload')
    setIdeas([])
    setLayers([])
    setShareUrl('')
    setImageDataUrl('')
    setSelectedIdea(0)
  }

  function updateSelectedLayer(patch: Partial<TextLayer>) {
    if (!selectedId) return
    setLayers(layers.map(l => l.id === selectedId ? { ...l, ...patch } : l))
  }

  function addLayer() {
    const id = 'l' + Date.now()
    const fs = Math.round(Math.min(imageDims.w, imageDims.h) * 0.07)
    setLayers([...layers, {
      id,
      text: 'NEW TEXT',
      x: imageDims.w / 2 - 120,
      y: imageDims.h / 2 - fs,
      width: 240,
      fontFamily: 'Impact, "Anton", sans-serif',
      fontSize: fs,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: Math.max(2, Math.round(fs * 0.08))
    }])
    setSelectedId(id)
  }

  function deleteSelected() {
    if (!selectedId) return
    setLayers(layers.filter(l => l.id !== selectedId))
    setSelectedId(null)
  }

  async function exportPng() {
    if (!canvasRef.current) return
    const url = canvasRef.current.exportPng()
    const a = document.createElement('a')
    a.href = url
    a.download = 'magicthon-meme.png'
    a.click()
  }

  async function copyLink() {
    let ok = false
    try {
      await navigator.clipboard.writeText(shareUrl)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = shareUrl
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    setCopyState(ok ? 'copied' : 'failed')
    setTimeout(() => setCopyState('idle'), 1800)
  }

  async function shipIt() {
    if (!canvasRef.current) return
    setSaving(true)
    try {
      const dataUrl = canvasRef.current.exportPng()
      const caption = ideas[selectedIdea]?.caption || ''
      const { slug } = await saveMeme(dataUrl, caption)
      setShareUrl(`${window.location.origin}/m/${slug}`)
      setStage('shared')
    } catch (e) {
      alert('Save failed: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const sel = layers.find(l => l.id === selectedId) || null

  return (
    <div className="page">
      <BgBlobs />
      <Marquee />

      <div className="wrap">
        {stage === 'upload' && (
          <div key="upload" className="stage-enter">
            <div className="hero">
              <span className="sticker"><span className="dot" />live · build day · ship it</span>
              <h1 className="display">
                <span className="line line-1">your pic.</span>
                <span className="line line-2">our chaos.</span>
                <span className="line line-3">one <span className="underline">link.</span></span>
              </h1>
              <p className="tag">
                drop a pic. <span className="hl">AI cooks 6 memes</span> built for what's actually in it.
                edit in seconds. share a link. watch the reactions stack up live. no signup. no impact font (unless you want it). 🫡
              </p>
            </div>
            <ImageInput onPicked={handlePicked} />
            {analyzing && <AnalyzingLoader />}
            <FeatureRow />
          </div>
        )}

        {stage === 'ideas' && (
          <div key="ideas" className="section stage-enter">
            <button className="back-btn" onClick={startOver}>← different photo</button>
            <div className="step-head">
              <span className="step-num">02</span>
              <h2 className="display-sm">pick a take.</h2>
            </div>
            <p className="step-sub">six formats, written for what's actually in your photo.</p>
            <IdeaGrid imageDataUrl={imageDataUrl} ideas={ideas} onSelect={pickIdea} />
          </div>
        )}

        {stage === 'editor' && (
          <div key="editor" className="section stage-enter">
            <button className="back-btn" onClick={backToIdeas}>← pick a different format</button>
            <div className="step-head">
              <span className="step-num">04</span>
              <h2 className="display-sm">edit.</h2>
            </div>
            <p className="step-sub">
              <span className="format-pill">{normalizeFmt(ideas[selectedIdea]?.format)}</span>
              <span style={{ opacity: 0.6 }}> · {ideas[selectedIdea]?.vibe}</span>
              <br/>
              <span style={{ fontSize: 13 }}>tap a text layer to select · double-tap to retype · drag to reposition</span>
            </p>
            <div className="editor">
              <div className="canvas-wrap" ref={canvasWrapRef}>
                <MemeCanvas
                  ref={canvasRef}
                  imageDataUrl={imageDataUrl}
                  layers={layers}
                  setLayers={setLayers}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  logicalWidth={imageDims.w}
                  logicalHeight={imageDims.h}
                  displayWidth={displayWidth}
                />
              </div>
              <div className="panel">
                <h4>Layer</h4>
                {!sel && <p className="panel-hint">Tap a text layer on the canvas to edit. Double-tap to retype.</p>}
                {sel && (
                  <>
                    <div>
                      <label>Text</label>
                      <textarea
                        value={sel.text}
                        onChange={e => updateSelectedLayer({ text: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Font</label>
                      <select value={sel.fontFamily} onChange={e => updateSelectedLayer({ fontFamily: e.target.value })}>
                        {FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Size: {sel.fontSize}px</label>
                      <input type="range" min={20} max={160} value={sel.fontSize}
                        onChange={e => updateSelectedLayer({ fontSize: parseInt(e.target.value) })} />
                    </div>
                    <div>
                      <label>Outline: {sel.strokeWidth}px</label>
                      <input type="range" min={0} max={16} value={sel.strokeWidth}
                        onChange={e => updateSelectedLayer({ strokeWidth: parseInt(e.target.value) })} />
                    </div>
                    <div>
                      <label>Fill</label>
                      <div className="row">
                        {COLORS.map(c => (
                          <span key={c}
                            className={`swatch ${sel.fill === c ? 'active' : ''}`}
                            style={{ background: c }}
                            onClick={() => updateSelectedLayer({ fill: c })}
                          />
                        ))}
                      </div>
                    </div>
                    <button className="btn ghost" onClick={deleteSelected}>Delete layer</button>
                  </>
                )}
                <div className="panel-row">
                  <button className="btn ghost" onClick={addLayer}>+ Text</button>
                  <button className="btn ghost" onClick={() => {
                    const newIdx = (selectedIdea + 1) % ideas.length
                    setSelectedIdea(newIdx)
                    setLayers(initialLayers(ideas[newIdx], imageDims.w, imageDims.h))
                  }}>Swap template</button>
                </div>
                <div className="panel-row">
                  <button className="btn ghost" onClick={exportPng}>Download</button>
                  <button className="btn hot" onClick={shipIt} disabled={saving}>
                    {saving ? <><span className="spinner" />Shipping…</> : 'Ship it →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'shared' && (
          <div key="shared" className="section stage-enter">
            <div className="step-head">
              <span className="step-num">06</span>
              <h2 className="display-sm">shipped.</h2>
            </div>
            <p className="step-sub">anyone who opens this can react. you watch the laughs roll in.</p>
            <div className="share-box">{shareUrl}</div>
            <div className="panel-row">
              <button className={`btn ${copyState === 'failed' ? 'hot' : ''}`} onClick={copyLink}>
                {copyState === 'copied' ? 'copied ✓' : copyState === 'failed' ? "couldn't copy" : 'copy link'}
              </button>
              <a className="btn ghost" href={shareUrl} target="_blank" rel="noreferrer">open</a>
              <button className="btn ghost" onClick={startOver}>make another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Marquee() {
  const items = [
    '🫡 no signup',
    '💀 no watermark',
    '✨ AI does the funny',
    '🔥 ship in 4 minutes',
    '📲 mobile native',
    '🎯 reactions live',
    '💅 made on magicthon'
  ]
  return (
    <div className="marquee">
      <div className="marquee-track">
        {Array.from({ length: 3 }).flatMap((_, k) =>
          items.map((it, i) => <span key={`${k}-${i}`} className="marquee-item">{it}</span>)
        )}
      </div>
    </div>
  )
}

function AnalyzingLoader() {
  const messages = [
    'reading the photo…',
    'noticing the weird details…',
    'writing 6 takes…',
    'making sure they hit…',
    'almost there…'
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(prev => (prev + 1) % messages.length), 1600)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="analyzing">
      <span className="spinner" />
      <span key={i} className="analyzing-text">{messages[i]}</span>
    </div>
  )
}

function FeatureRow() {
  const feats = [
    { n: '01', emoji: '📸', label: 'drop a pic', sub: 'drag, paste, or snap one' },
    { n: '02', emoji: '🧠', label: 'AI roasts it', sub: '6 takes, built for your face' },
    { n: '03', emoji: '✂️', label: 'edit fast', sub: 'draggable text, real canvas' },
    { n: '04', emoji: '🚀', label: 'ship a link', sub: 'reactions roll in live' }
  ]
  return (
    <div className="feature-row">
      {feats.map(f => (
        <div className="feature" key={f.n}>
          <span className="emoji">{f.emoji}</span>
          <div className="num">{f.n}</div>
          <div className="feature-label">{f.label}</div>
          <div className="feature-sub">{f.sub}</div>
        </div>
      ))}
    </div>
  )
}
