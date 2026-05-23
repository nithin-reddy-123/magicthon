import { useEffect, useRef, useState } from 'react'

type Props = { onPicked: (file: File, dataUrl: string) => void }

export default function ImageInput({ onPicked }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [webcamOn, setWebcamOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onPicked(file, reader.result as string)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile()
          if (f) handleFile(f)
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  async function pasteFromClipboard() {
    const nav = navigator as any
    if (!nav.clipboard || !nav.clipboard.read) {
      alert("your browser blocks direct paste. press ⌘V (mac) or Ctrl+V (windows) instead — that works.")
      return
    }
    try {
      const items = await nav.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const file = new File([blob], 'pasted.png', { type: blob.type })
            handleFile(file)
            return
          }
        }
      }
      alert("no image in clipboard — copy an image first, then click paste.")
    } catch (e) {
      alert("couldn't read clipboard. try ⌘V (mac) or Ctrl+V (windows) directly.")
    }
  }

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      setWebcamOn(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 50)
    } catch (e) {
      alert('Could not access webcam: ' + (e as Error).message)
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setWebcamOn(false)
  }

  function snap() {
    const v = videoRef.current
    if (!v) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(v, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'webcam.png', { type: 'image/png' })
      handleFile(file)
      stopWebcam()
    }, 'image/png')
  }

  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false)
        const f = e.dataTransfer.files[0]
        if (f) handleFile(f)
      }}
    >
      {!webcamOn && (
        <>
          <h3>Drop a photo, paste it, or use your camera</h3>
          <p style={{ color: 'var(--muted)' }}>Any face works best. We'll handle the funny part.</p>
          <div className="actions">
            <button className="btn" onClick={() => fileRef.current?.click()}>choose file</button>
            <button className="btn ghost" onClick={pasteFromClipboard}>paste</button>
            <button className="btn ghost" onClick={startWebcam}>webcam</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </>
      )}
      {webcamOn && (
        <div>
          <video ref={videoRef} style={{ width: '100%', maxHeight: 360, borderRadius: 12, background: '#000' }} playsInline muted />
          <div className="actions">
            <button className="btn" onClick={snap}>Snap</button>
            <button className="btn ghost" onClick={stopWebcam}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
