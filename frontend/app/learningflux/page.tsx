'use client'

import { useReveal, Nav, Footer } from './components'
import { Hero, Agitation, Features, Moat, FinalCTA } from './sections'

export default function LearningFluxPage() {
  useReveal()
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Agitation />
        <Features />
        <Moat />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
