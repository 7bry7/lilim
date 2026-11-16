import fc from 'fast-check'

describe('test runner', () => {
  it('runs a trivial test with jsdom and fast-check', () => {
    expect(document.createElement('dialog').showModal).toBeTypeOf('function')
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n))
  })
})
