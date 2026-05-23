import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Image as KImage, Text as KText, Transformer } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'

export type TextLayer = {
  id: string
  text: string
  x: number
  y: number
  fontFamily: string
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  width: number
}

export type MemeCanvasHandle = {
  exportPng: () => string
}

type Props = {
  imageDataUrl: string
  layers: TextLayer[]
  setLayers: (l: TextLayer[]) => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  logicalWidth: number
  logicalHeight: number
  displayWidth: number
}

const MemeCanvas = forwardRef<MemeCanvasHandle, Props>(function MemeCanvas(
  { imageDataUrl, layers, setLayers, selectedId, setSelectedId, logicalWidth, logicalHeight, displayWidth }, ref
) {
  const [img] = useImage(imageDataUrl, 'anonymous')
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const textRefs = useRef<Record<string, Konva.Text>>({})
  const [editing, setEditing] = useState<string | null>(null)

  const scale = displayWidth / logicalWidth
  const stageW = displayWidth
  const stageH = displayWidth * (logicalHeight / logicalWidth)

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      setSelectedId(null)
      trRef.current?.nodes([])
      const stage = stageRef.current!
      const prevScaleX = stage.scaleX()
      const prevScaleY = stage.scaleY()
      const prevW = stage.width()
      const prevH = stage.height()
      stage.scale({ x: 1, y: 1 })
      stage.size({ width: logicalWidth, height: logicalHeight })
      stage.draw()
      const url = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
      stage.scale({ x: prevScaleX, y: prevScaleY })
      stage.size({ width: prevW, height: prevH })
      stage.draw()
      return url
    }
  }), [setSelectedId, logicalWidth, logicalHeight])

  function updateLayer(id: string, patch: Partial<TextLayer>) {
    setLayers(layers.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  function attachTransformer(id: string) {
    const node = textRefs.current[id]
    if (node && trRef.current) {
      trRef.current.nodes([node])
      trRef.current.getLayer()?.batchDraw()
    }
  }

  function onDblClick(layer: TextLayer) {
    const stage = stageRef.current
    if (!stage) return
    const node = textRefs.current[layer.id]
    if (!node) return
    node.hide()
    trRef.current?.hide()
    setEditing(layer.id)

    const stageBox = stage.container().getBoundingClientRect()
    const areaPosition = {
      x: stageBox.left + node.x() * scale,
      y: stageBox.top + node.y() * scale
    }
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.value = layer.text
    textarea.style.position = 'absolute'
    textarea.style.top = areaPosition.y + window.scrollY + 'px'
    textarea.style.left = areaPosition.x + window.scrollX + 'px'
    textarea.style.width = (layer.width * scale) + 'px'
    textarea.style.minHeight = (layer.fontSize * scale * 1.4) + 'px'
    textarea.style.fontSize = (layer.fontSize * scale) + 'px'
    textarea.style.fontFamily = layer.fontFamily
    textarea.style.color = layer.fill
    textarea.style.background = 'rgba(0,0,0,0.78)'
    textarea.style.border = '2px solid #c6f24e'
    textarea.style.padding = '6px'
    textarea.style.borderRadius = '6px'
    textarea.style.outline = 'none'
    textarea.style.resize = 'none'
    textarea.style.zIndex = '999'
    textarea.style.textAlign = 'center'
    textarea.style.lineHeight = '1.1'
    textarea.focus()
    textarea.select()

    function finish() {
      updateLayer(layer.id, { text: textarea.value })
      if (textarea.parentNode) document.body.removeChild(textarea)
      node.show()
      trRef.current?.show()
      setEditing(null)
    }
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish() }
      if (e.key === 'Escape') {
        if (textarea.parentNode) document.body.removeChild(textarea)
        node.show(); trRef.current?.show(); setEditing(null)
      }
    })
    textarea.addEventListener('blur', finish)
  }

  return (
    <Stage
      ref={stageRef}
      width={stageW}
      height={stageH}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={e => {
        if (e.target === e.target.getStage()) {
          setSelectedId(null)
          trRef.current?.nodes([])
        }
      }}
      onTouchStart={e => {
        if (e.target === e.target.getStage()) {
          setSelectedId(null)
          trRef.current?.nodes([])
        }
      }}
      style={{ maxWidth: '100%', touchAction: 'none' }}
    >
      <Layer>
        {img && <KImage image={img} width={logicalWidth} height={logicalHeight} listening={false} />}
      </Layer>
      <Layer>
        {layers.map(l => (
          <KText
            key={l.id}
            ref={node => { if (node) textRefs.current[l.id] = node }}
            text={l.text}
            x={l.x}
            y={l.y}
            width={l.width}
            fontFamily={l.fontFamily}
            fontSize={l.fontSize}
            fontStyle="bold"
            fill={l.fill}
            stroke={l.stroke}
            strokeWidth={l.strokeWidth}
            fillAfterStrokeEnabled
            align="center"
            wrap="word"
            shadowColor="#000"
            shadowBlur={4}
            shadowOpacity={0.65}
            shadowOffsetX={2}
            shadowOffsetY={2}
            draggable
            onClick={() => { setSelectedId(l.id); attachTransformer(l.id) }}
            onTap={() => { setSelectedId(l.id); attachTransformer(l.id) }}
            onDblClick={() => onDblClick(l)}
            onDblTap={() => onDblClick(l)}
            onDragEnd={e => updateLayer(l.id, { x: e.target.x(), y: e.target.y() })}
            onTransform={e => {
              const node = e.target as Konva.Text
              const scaleX = node.scaleX()
              const newW = Math.max(80, node.width() * scaleX)
              node.scaleX(1)
              node.scaleY(1)
              updateLayer(l.id, {
                x: node.x(),
                y: node.y(),
                width: newW,
                fontSize: Math.max(16, l.fontSize * scaleX)
              })
            }}
            visible={editing !== l.id}
          />
        ))}
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          enabledAnchors={['middle-left', 'middle-right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(_, n) => n}
        />
      </Layer>
    </Stage>
  )
})

export default MemeCanvas
