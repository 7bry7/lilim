export function printSheetLayout(sheetW, sheetH, stripW, stripH) {
  const scale = Math.min(sheetW / stripW, sheetH / stripH)
  const w = stripW * scale
  const h = stripH * scale
  return { scale, x: (sheetW - w) / 2, y: (sheetH - h) / 2, w, h }
}
