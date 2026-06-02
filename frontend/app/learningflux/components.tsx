'use client'

import { useState, useEffect } from 'react'

/* ---------- scroll reveal ---------- */
export function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

interface RevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const style = delay ? { transitionDelay: delay + 'ms' } : undefined
  return (
    <div className={'reveal ' + className} style={style}>
      {children}
    </div>
  )
}

/* ---------- brand ---------- */
export function Glyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lf-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c5cff" />
          <stop offset="0.5" stopColor="#c64bdd" />
          <stop offset="1" stopColor="#ff3d8b" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0f0a1c" stroke="#352a55" />
      <path d="M11 9h11M11 9v14M11 16h8" stroke="url(#lf-grad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.5 19.5l3.5 3.5-3.5 3.5" stroke="url(#lf-grad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <a href="#top" className="flex items-center gap-2.5 group">
      <span className="floaty"><Glyph size={size} /></span>
      <span className="font-semibold text-[19px] tracking-tight text-ink">
        Learning<span className="text-gradient">Flux</span>
      </span>
    </a>
  )
}

/* ---------- text bits ---------- */
interface EyebrowProps {
  children: React.ReactNode
  className?: string
}

export function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <div className={'inline-flex items-center gap-2 font-mono text-[12px] tracking-eyebrow uppercase text-inkSubtle ' + className}>
      <span className="w-4 h-px bg-gradient-to-r from-primary to-magenta" />
      {children}
    </div>
  )
}

export function GradText({ children }: { children: React.ReactNode }) {
  return <span className="text-gradient">{children}</span>
}

/* ---------- buttons ---------- */
interface ButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  className?: string
  large?: boolean
}

export function PrimaryBtn({ children, href = '#pilot', onClick, className = '', large = false }: ButtonProps) {
  const pad = large ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-[14px]'
  return (
    <a href={href} onClick={onClick}
      className={`btn-grad inline-flex items-center justify-center gap-2 rounded-[10px] font-medium ${pad} ${className}`}>
      {children}
    </a>
  )
}

export function GhostBtn({ children, href = '#features', onClick, className = '', large = false }: ButtonProps) {
  const pad = large ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-[14px]'
  return (
    <a href={href} onClick={onClick}
      className={`btn-ghost inline-flex items-center justify-center gap-2 rounded-[10px] font-medium ${pad} ${className}`}>
      {children}
    </a>
  )
}

/* ---------- icons ---------- */
type IconProps = React.SVGProps<SVGSVGElement>

export const Ic = {
  scan: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M7 12h10"/><path d="M9 9l-1 6M14 9l1 6"/></svg>),
  swap: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4 3 8l4 4"/><path d="M3 8h14a4 4 0 0 1 0 8h-1"/><path d="M17 20l4-4-4-4"/><path d="M21 16H9"/></svg>),
  check: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>),
  eyeOff: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.4 18.4 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="m2 2 20 20"/></svg>),
  clock: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  churn: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/></svg>),
  grid: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>),
  whatsapp: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.38-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>),
  arrow: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>),
  phone: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>),
  mail: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>),
  bolt: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/></svg>),
  shield: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>),
}

/* ---------- nav ---------- */
export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const links: [string, string][] = [
    ['The Brain', '#features'],
    ['Live demo', '#analogy'],
    ['For directors', '#moat'],
    ['Pilot', '#pilot'],
  ]
  return (
    <header className={'fixed top-0 inset-x-0 z-50 transition-colors duration-300 ' + (scrolled ? 'bg-canvas/80 backdrop-blur-xl border-b border-hairline' : 'border-b border-transparent')}>
      <div className="max-w-content mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <Wordmark />
        <nav className="hidden md:flex items-center gap-1">
          {links.map(([label, href]) => (
            <a key={href} href={href}
              className="px-3 py-2 rounded-lg text-[14px] text-inkSubtle hover:text-ink hover:bg-surface1 transition-colors">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <GhostBtn href="#features" className="hidden sm:inline-flex">See the Brain</GhostBtn>
          <PrimaryBtn href="#pilot">Claim Your Pilot</PrimaryBtn>
        </div>
      </div>
    </header>
  )
}

/* ---------- footer ---------- */
export function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas">
      <div className="max-w-content mx-auto px-5 lg:px-8 py-14">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-4 text-[14px] leading-relaxed text-inkSubtle">
              White-labeled AI tutoring infrastructure for serious IIT-JEE institutes. Your brand on the front. Our brain underneath.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-3">
            {(
              [
                ['Product', ['The Brain', 'Analogy Engine', 'Micro-Test Loop', 'Dashboards']],
                ['Institute', ['4-Week Pilot', 'White-label', 'For directors', 'Security']],
                ['Company', ['About', 'Contact sales', 'Privacy', 'Terms']],
              ] as [string, string[]][]
            ).map(([head, items]) => (
              <div key={head} className="flex flex-col gap-2.5">
                <div className="font-mono text-[11px] tracking-eyebrow uppercase text-inkTertiary">{head}</div>
                {items.map((it) => (
                  <a key={it} href="#" className="text-[14px] text-inkSubtle hover:text-ink transition-colors">{it}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-hairline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-[13px] text-inkTertiary">© 2026 LearningFlux. Built for the next batch.</span>
          <div className="flex items-center gap-2 text-[13px] text-inkSubtle">
            <span className="w-2 h-2 rounded-full bg-success live-dot" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  )
}
