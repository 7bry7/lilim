export default function Landing({ onStart }) {
  return (
    <main className="screen center">
      <h1 className="title">Lilim Photobooth</h1>
      <p className="tagline">4 shots. 1 strip. Just us.</p>
      <button className="btn" onClick={onStart}>Start</button>
    </main>
  )
}