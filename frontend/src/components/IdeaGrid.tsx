import { MemeIdea } from '../lib/api'

type Props = {
  imageDataUrl: string
  ideas: MemeIdea[]
  onSelect: (i: number) => void
}

function fmt(idea: MemeIdea): string {
  return (idea.format || '').toLowerCase().replace(/[^a-z]/g, '')
}

function Preview({ idea, imageDataUrl }: { idea: MemeIdea; imageDataUrl: string }) {
  const f = fmt(idea)

  // Impact-style top+bottom
  if (f === 'topbottom') {
    return (
      <>
        <img src={imageDataUrl} alt="" />
        <div className="overlay top-bottom">
          <div className="impact-text">{idea.topText}</div>
          <div className="impact-text">{idea.bottomText}</div>
        </div>
      </>
    )
  }

  // POV: top dark band
  if (f === 'pov') {
    return (
      <>
        <img src={imageDataUrl} alt="" />
        <div className="overlay">
          <div className="band band-top">{idea.topText || idea.bottomText}</div>
        </div>
      </>
    )
  }

  // tell me you're X without telling me — top band
  if (f === 'telltale') {
    return (
      <>
        <img src={imageDataUrl} alt="" />
        <div className="overlay">
          <div className="band band-top thin">{idea.topText || idea.bottomText}</div>
        </div>
      </>
    )
  }

  // deadpan: single bottom band
  if (f === 'deadpan') {
    return (
      <>
        <img src={imageDataUrl} alt="" />
        <div className="overlay">
          <div className="band band-bottom">{idea.bottomText || idea.topText}</div>
        </div>
      </>
    )
  }

  // caption: bottom white bar (tweet meme style)
  if (f === 'caption') {
    return (
      <>
        <img src={imageDataUrl} alt="" />
        <div className="overlay">
          <div className="band band-bottom bar-white">{idea.bottomText || idea.topText}</div>
        </div>
      </>
    )
  }

  // thoughts: lowercase top + bottom, no Impact
  if (f === 'thoughts') {
    return (
      <>
        <img src={imageDataUrl} alt="" />
        <div className="overlay top-bottom">
          <div className="soft-text">{idea.topText}</div>
          <div className="soft-text">{idea.bottomText}</div>
        </div>
      </>
    )
  }

  // fallback — show whatever has text
  return (
    <>
      <img src={imageDataUrl} alt="" />
      <div className="overlay top-bottom">
        {idea.topText && <div className="impact-text">{idea.topText}</div>}
        {idea.bottomText && <div className="impact-text">{idea.bottomText}</div>}
      </div>
    </>
  )
}

export default function IdeaGrid({ imageDataUrl, ideas, onSelect }: Props) {
  return (
    <div className="grid6">
      {ideas.map((idea, i) => (
        <button
          key={i}
          className="card"
          onClick={() => onSelect(i)}
          type="button"
        >
          <div className="preview-frame">
            <Preview idea={idea} imageDataUrl={imageDataUrl} />
          </div>
          <div className="meta">
            <span className="format">{fmt(idea) || idea.format}</span>
            <span className="vibe">{idea.vibe}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
