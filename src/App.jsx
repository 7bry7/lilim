import { useState } from 'react'
import Landing from './components/Landing'
import Capture from './components/Capture'
import Editor from './components/Editor'

export default function App() {
  // One state value decides which screen shows. No router needed for 3 screens.
  const [screen, setScreen] = useState('landing')
  const [photos, setPhotos] = useState([]) // array of 4 image data URLs

  const handleDone = (shots) => {
    setPhotos(shots)
    setScreen('editor')
  }

  if (screen === 'capture') {
    return <Capture onDone={handleDone} onBack={() => setScreen('landing')} />
  }
  if (screen === 'editor') {
    return <Editor photos={photos} onRetake={() => setScreen('capture')} />
  }
  return <Landing onStart={() => setScreen('capture')} />
}