import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Landing from './Landing.jsx'

afterEach(() => {
  vi.useRealTimers()
  delete window.matchMedia
})

const mockMedia = (reduce) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce })
}

describe('Landing curtain', () => {
  it('calls onStart immediately under prefers-reduced-motion, once', () => {
    mockMedia(true)
    const onStart = vi.fn()
    render(<Landing onStart={onStart} />)
    const btn = screen.getByRole('button', { name: 'Start' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('parts the curtain, then calls onStart once after ~500 ms', () => {
    vi.useFakeTimers()
    mockMedia(false)
    const onStart = vi.fn()
    render(<Landing onStart={onStart} />)
    const btn = screen.getByRole('button', { name: 'Start' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onStart).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(500))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
