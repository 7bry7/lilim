import { MAX_STICKERS, SCALE_MIN, SCALE_MAX, normalizeAngle } from '../lib/stickerPlacement.js'
import { STICKER_KINDS } from '../lib/stickerAssets.js'

const NOTICES = {
  limit: `The ${MAX_STICKERS}-sticker limit is reached. Delete a sticker to add another.`,
  'no-space': 'No space is available for another sticker.',
}

const btn = { minWidth: 44, minHeight: 44 }

/**
 * Props: stickers, selectedId, notice (null|'limit'|'no-space'), loadError (string|null),
 * availableKinds (optional array of kinds that decoded), onAdd(kind),
 * onScale(id,scale), onRotate(id,deg), onFlip(id), onDelete(id), onClear().
 */
export default function StickerControls({
  stickers,
  selectedId,
  notice,
  loadError = null,
  availableKinds,
  onAdd,
  onScale,
  onRotate,
  onFlip,
  onDelete,
  onClear,
}) {
  const sel = stickers.find((s) => s.id === selectedId) || null
  const kinds = availableKinds
    ? STICKER_KINDS.filter((k) => availableKinds.includes(k.kind))
    : STICKER_KINDS
  const rotation = sel ? Math.round(normalizeAngle(sel.rotation)) % 360 : 0
  const percent = sel ? Math.round(sel.scale * 100) : 100

  return (
    <div role="group" aria-label="Stickers">
      <div role="group" aria-label="Sticker palette" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            className="chip"
            style={btn}
            aria-label={`Add ${k.label} sticker`}
            onClick={() => onAdd(k.kind)}
          >
            <img src={k.url} alt="" width={28} height={28} />
          </button>
        ))}
      </div>

      <div aria-live="polite" role="status">
        {notice && NOTICES[notice]}
      </div>
      {loadError && <div role="alert">{loadError}</div>}

      <label style={{ display: 'block' }}>
        Size {sel ? `${percent}%` : ''}
        <input
          type="range"
          min={SCALE_MIN * 100}
          max={SCALE_MAX * 100}
          step={1}
          value={percent}
          disabled={!sel}
          aria-label="Sticker size"
          onChange={(e) => sel && onScale(sel.id, Number(e.target.value) / 100)}
        />
      </label>

      <label style={{ display: 'block' }}>
        Rotation {sel ? `${rotation}°` : ''}
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={rotation}
          disabled={!sel}
          aria-label="Sticker rotation"
          onChange={(e) => sel && onRotate(sel.id, Number(e.target.value))}
        />
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="chip" style={btn} disabled={!sel} aria-label="Rotate sticker left 15 degrees" onClick={() => onRotate(sel.id, rotation - 15)}>
          ⟲ 15°
        </button>
        <button type="button" className="chip" style={btn} disabled={!sel} aria-label="Rotate sticker right 15 degrees" onClick={() => onRotate(sel.id, rotation + 15)}>
          ⟳ 15°
        </button>
        <button type="button" className="chip" style={btn} disabled={!sel} aria-label="Flip sticker" onClick={() => onFlip(sel.id)}>
          Flip
        </button>
        <button type="button" className="chip" style={btn} disabled={!sel} aria-label="Delete sticker" onClick={() => onDelete(sel.id)}>
          Delete
        </button>
        <button type="button" className="chip" style={btn} disabled={stickers.length === 0} aria-label="Remove all stickers" onClick={onClear}>
          Remove All
        </button>
      </div>
    </div>
  )
}
