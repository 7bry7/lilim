import { useReducer } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StickerControls from './StickerControls.jsx'
import StickerLayer from './StickerLayer.jsx'
import { appReducer, initialState } from '../appReducer.js'
import { MAX_STICKERS, KEY_STEP } from '../lib/stickerPlacement.js'

const sticker = (over = {}) => ({
  id: 1, kind: 'star', x: 480, y: 1500, scale: 1, rotation: 0, flipped: false, ...over,
})

function controlProps(over = {}) {
  return {
    stickers: [], selectedId: null, notice: null,
    onAdd: vi.fn(), onScale: vi.fn(), onRotate: vi.fn(), onFlip: vi.fn(),
    onDelete: vi.fn(), onClear: vi.fn(),
    ...over,
  }
}

function layerProps(over = {}) {
  return {
    stickers: [sticker()], selectedId: null,
    onSelect: vi.fn(), onMove: vi.fn(), onScale: vi.fn(), onRotate: vi.fn(), onDelete: vi.fn(),
    ...over,
  }
}

function Harness() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const { stickers, selectedId } = state.editor
  return (
    <div>
      <StickerLayer
        stickers={stickers}
        selectedId={selectedId}
        onSelect={(id) => dispatch({ type: 'STICKER_SELECT', id })}
        onMove={(id, x, y) => dispatch({ type: 'STICKER_MOVE', id, x, y })}
        onScale={(id, scale) => dispatch({ type: 'STICKER_SCALE', id, scale })}
        onRotate={(id, rotation) => dispatch({ type: 'STICKER_ROTATE', id, rotation })}
        onDelete={(id) => dispatch({ type: 'STICKER_DELETE', id })}
      />
      <StickerControls
        stickers={stickers}
        selectedId={selectedId}
        notice={state.notice}
        onAdd={(kind) => dispatch({ type: 'STICKER_ADD', kind })}
        onScale={(id, scale) => dispatch({ type: 'STICKER_SCALE', id, scale })}
        onRotate={(id, rotation) => dispatch({ type: 'STICKER_ROTATE', id, rotation })}
        onFlip={(id) => dispatch({ type: 'STICKER_FLIP', id })}
        onDelete={(id) => dispatch({ type: 'STICKER_DELETE', id })}
        onClear={() => dispatch({ type: 'STICKER_CLEAR' })}
      />
      <span data-testid="flipped">{String(stickers[0]?.flipped)}</span>
      <span data-testid="count">{stickers.length}</span>
    </div>
  )
}

describe('StickerControls messages', () => {
  it('shows the limit message', () => {
    render(<StickerControls {...controlProps({ notice: 'limit' })} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      `The ${MAX_STICKERS}-sticker limit is reached`,
    )
  })

  it('shows the no-space message', () => {
    render(<StickerControls {...controlProps({ notice: 'no-space' })} />)
    expect(screen.getByRole('status')).toHaveTextContent('No space is available')
  })

  it('shows no message without a notice', () => {
    render(<StickerControls {...controlProps()} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})

describe('StickerControls actions', () => {
  it('Remove All calls onClear and is disabled with no stickers', async () => {
    const user = userEvent.setup()
    const props = controlProps({ stickers: [sticker()], selectedId: 1 })
    const { rerender } = render(<StickerControls {...props} />)
    await user.click(screen.getByRole('button', { name: 'Remove all stickers' }))
    expect(props.onClear).toHaveBeenCalledTimes(1)
    rerender(<StickerControls {...controlProps()} />)
    expect(screen.getByRole('button', { name: 'Remove all stickers' })).toBeDisabled()
  })

  it('every control has a non-empty accessible name', () => {
    render(<StickerControls {...controlProps({ stickers: [sticker()], selectedId: 1 })} />)
    const controls = [...screen.getAllByRole('button'), ...screen.getAllByRole('slider')]
    expect(controls.length).toBeGreaterThanOrEqual(11)
    for (const c of controls) {
      expect(c).toHaveAccessibleName(/\S/)
    }
  })

  it('every sticker hit element has a non-empty accessible name', () => {
    render(<StickerLayer {...layerProps({ stickers: [sticker(), sticker({ id: 2, kind: 'heart' })] })} />)
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAccessibleName(/\S/)
  })
})

describe('StickerLayer keyboard and selection', () => {
  it('arrow keys move by the key step', async () => {
    const user = userEvent.setup()
    const props = layerProps({ selectedId: 1 })
    render(<StickerLayer {...props} />)
    screen.getByRole('button', { name: /star sticker/i }).focus()
    await user.keyboard('{ArrowLeft}{ArrowRight}{ArrowUp}{ArrowDown}')
    expect(props.onMove.mock.calls).toEqual([
      [1, 480 - KEY_STEP, 1500],
      [1, 480 + KEY_STEP, 1500],
      [1, 480, 1500 - KEY_STEP],
      [1, 480, 1500 + KEY_STEP],
    ])
  })

  it('+ and - resize, Delete deletes', async () => {
    const user = userEvent.setup()
    const props = layerProps({ selectedId: 1 })
    render(<StickerLayer {...props} />)
    screen.getByRole('button', { name: /star sticker/i }).focus()
    await user.keyboard('+-')
    expect(props.onScale.mock.calls[0][1]).toBeGreaterThan(1)
    expect(props.onScale.mock.calls[1][1]).toBeLessThan(1)
    await user.keyboard('{Delete}')
    expect(props.onDelete).toHaveBeenCalledWith(1)
  })

  it('focusing a sticker selects it', async () => {
    const user = userEvent.setup()
    const props = layerProps()
    render(<StickerLayer {...props} />)
    await user.tab()
    expect(props.onSelect).toHaveBeenCalledWith(1)
  })

  it('pressing the layer background clears the selection', async () => {
    const user = userEvent.setup()
    const props = layerProps({ selectedId: 1 })
    render(<StickerLayer {...props} />)
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByTestId('sticker-layer') })
    expect(props.onSelect).toHaveBeenCalledWith(null)
  })

  it('pressing a sticker does not clear the selection', async () => {
    const user = userEvent.setup()
    const props = layerProps({ selectedId: 1 })
    render(<StickerLayer {...props} />)
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: /star sticker/i }) })
    expect(props.onSelect).not.toHaveBeenCalledWith(null)
  })
})

describe('Sticker UI with real reducer', () => {
  it('Flip twice restores orientation', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add Star sticker' }))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    const flip = screen.getByRole('button', { name: 'Flip sticker' })
    await user.click(flip)
    expect(screen.getByTestId('flipped')).toHaveTextContent('true')
    await user.click(flip)
    expect(screen.getByTestId('flipped')).toHaveTextContent('false')
  })

  it('Remove All empties the layer', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add Star sticker' }))
    await user.click(screen.getByRole('button', { name: 'Add Heart sticker' }))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    await user.click(screen.getByRole('button', { name: 'Remove all stickers' }))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('shows a message once adding can no longer succeed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const add = screen.getByRole('button', { name: 'Add Star sticker' })
    for (let i = 0; i < MAX_STICKERS + 1; i++) await user.click(add)
    expect(screen.getByRole('status')).toHaveTextContent(/limit is reached|No space/)
  })
})
