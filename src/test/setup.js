import '@testing-library/jest-dom/vitest'
import fc from 'fast-check'

fc.configureGlobal({ numRuns: 100 })

// jsdom does not fully implement HTMLDialogElement.showModal/close.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
