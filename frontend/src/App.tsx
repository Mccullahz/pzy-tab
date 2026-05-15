import { Routes, Route } from 'react-router-dom'

import Hero from './pages/Hero'

export default function App() {
  return (
    <Routes>
        <Route path="/" element={<Hero />} />

    </Routes>
  )
}

