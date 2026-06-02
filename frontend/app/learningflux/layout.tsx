import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export const metadata: Metadata = {
  title: 'LearningFlux — White-labeled AI tutoring for IIT-JEE institutes',
  description: 'White-labeled AI tutoring infrastructure for serious IIT-JEE institutes. Your brand on the front. Our brain underneath.',
}

export default function LearningFluxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lf-root ${GeistSans.variable} ${GeistMono.variable}`}>
      {children}
    </div>
  )
}
