'use client'

import { useReveal, Nav, Footer } from "./learningflux/components";
import { Hero, Agitation, Features, Moat, FinalCTA } from "./learningflux/sections";

export default function Home() {
  useReveal();
  return (
    <div className="lf-root">
      <Nav />
      <main>
        <Hero />
        <Agitation />
        <Features />
        <Moat />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
