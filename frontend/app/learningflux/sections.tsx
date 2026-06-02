'use client'

import { useState } from 'react'
import { Eyebrow, GradText, PrimaryBtn, GhostBtn, Ic, Reveal } from './components'
import { HeroPanel, AnalogyEngine, MicroTest, ConfusionHeatmap, WhatsAppReport } from './product'

interface SectionHeadProps {
  eyebrow: string
  title: React.ReactNode
  sub?: string
  center?: boolean
}

function SectionHead({ eyebrow, title, sub, center }: SectionHeadProps) {
  return (
    <div className={center ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}>
      <Eyebrow className={center ? 'justify-center' : ''}>{eyebrow}</Eyebrow>
      <h2 className="font-display text-[clamp(30px,4.4vw,46px)] font-semibold text-ink mt-4" style={{ textWrap: 'balance' } as React.CSSProperties}>{title}</h2>
      {sub && <p className="mt-4 text-[17px] leading-relaxed text-inkSubtle">{sub}</p>}
    </div>
  )
}

/* ===================== HERO ===================== */
export function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 overflow-hidden">
      <div className="mesh" style={{ width: 560, height: 560, top: -160, left: '50%', marginLeft: -280, background: 'radial-gradient(circle, #7c5cff, transparent 65%)' }} />
      <div className="mesh" style={{ width: 420, height: 420, top: 40, left: '12%', background: 'radial-gradient(circle, #ff3d8b, transparent 70%)', opacity: 0.28 }} />
      <div className="mesh" style={{ width: 460, height: 460, top: 20, right: '8%', background: 'radial-gradient(circle, #3aa3ff, transparent 70%)', opacity: 0.26 }} />
      <div className="absolute inset-0 dotgrid opacity-40" style={{ maskImage: 'radial-gradient(ellipse 70% 55% at 50% 30%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 30%, #000 30%, transparent 75%)' } as React.CSSProperties} />

      <div className="relative max-w-content mx-auto px-5 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <Reveal>
            <a href="#pilot" className="inline-flex items-center gap-2 rounded-full border border-hairlineStrong bg-surface1 pl-1.5 pr-3 py-1.5 text-[12.5px] text-inkMuted hover:border-primary/50 transition-colors">
              <span className="rounded-full btn-grad px-2 py-0.5 text-[11px] font-medium">NEW</span>
              4-week pilot now open for the next batch
              <Ic.arrow width="13" height="13" />
            </a>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="font-display text-[clamp(38px,6.6vw,72px)] font-semibold text-ink mt-6" style={{ textWrap: 'balance' } as React.CSSProperties}>
              Your brand on the app.<br /><GradText>Our brain</GradText> behind every doubt.
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-[18px] leading-relaxed text-inkSubtle max-w-2xl mx-auto">
              LearningFlux is white-labeled AI tutoring infrastructure that mid-sized IIT-JEE institutes ship as their own. Your logo, your syllabus, your students—backed by a proprietary AI Tutor that explains any subject in any analogy, clears 2 AM doubts, and automatically sends weekly progress reports to parents so you never lose an admission.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryBtn href="#pilot" large>Claim Your Pilot <Ic.arrow width="16" height="16" /></PrimaryBtn>
              <GhostBtn href="#features" large>See the Brain</GhostBtn>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12.5px] font-mono text-inkTertiary">
              <span className="flex items-center gap-1.5"><Ic.bolt width="13" height="13" className="text-primaryHover" /> Live in 7 days</span>
              <span className="flex items-center gap-1.5"><Ic.shield width="13" height="13" className="text-primaryHover" /> Zero engineers required</span>
              <span className="flex items-center gap-1.5"><Ic.whatsapp width="13" height="13" className="text-primaryHover" /> Automated Parent Reporting</span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120} className="mt-16 max-w-2xl mx-auto">
          <HeroPanel />
        </Reveal>
      </div>
    </section>
  )
}

/* ===================== AGITATION ===================== */
export function Agitation() {
  const cols = [
    { icon: Ic.eyeOff, tag: 'SILENT FAILURES', title: 'The student who nods, then quietly falls behind.', body: "They look fine in class. They struggle in silence. You find out at the mock test — too late to fix the marks, and too late to keep the parent calm." },
    { icon: Ic.clock, tag: 'THE 2 AM BOTTLENECK', title: "Doubts pile up where your faculty can't reach.", body: "Your best teachers can't be on WhatsApp at midnight for 200 students. So the doubt waits, momentum breaks, and the syllabus quietly outruns the batch." },
    { icon: Ic.churn, tag: 'PARENT CHURN', title: 'Parents go quiet weeks before they leave.', body: "No update, no engagement, no warning. By re-admission season the decision is already made — and a competitor's banner is already up." },
  ]

  return (
    <section className="relative py-24 border-t border-hairline">
      <div className="max-w-content mx-auto px-5 lg:px-8">
        <Reveal>
          <SectionHead
            eyebrow="THE OPERATIONAL BLEED"
            title={<>You&apos;re not losing students at the test.<br /><span className="text-inkSubtle">You&apos;re losing them at 2 AM.</span></>}
            sub="Three leaks every director feels in the gut but can't staff their way out of. They don't show up on a P&L — until admissions do." />
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {cols.map((c, i) => (
            <Reveal key={c.tag} delay={i * 90}>
              <div className="card card-hover rounded-xl2 p-6 h-full flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-surface2 border border-hairlineStrong flex items-center justify-center text-magenta">
                  <c.icon width="20" height="20" />
                </div>
                <div className="mt-5 font-mono text-[11px] tracking-eyebrow text-inkTertiary">{c.tag}</div>
                <h3 className="mt-2 text-[20px] font-semibold text-ink leading-snug">{c.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-inkSubtle">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <p className="mt-10 text-center text-[15px] text-inkSubtle">
            Every leak above has the same root cause: <b className="text-ink">attention doesn&apos;t scale.</b> Until now.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ===================== FEATURES ===================== */
interface FeatureCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  tag: string
  title: string
  body: string
}

function FeatureCard({ icon: Icon, tag, title, body }: FeatureCardProps) {
  return (
    <div className="card card-hover rounded-xl2 p-6 h-full flex flex-col">
      <div className="w-11 h-11 rounded-xl bg-surface2 border border-hairlineStrong flex items-center justify-center text-primaryHover">
        <Icon width="20" height="20" />
      </div>
      <div className="mt-5 font-mono text-[11px] tracking-eyebrow text-inkTertiary">{tag}</div>
      <h3 className="mt-2 text-[19px] font-semibold text-ink leading-snug">{title}</h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-inkSubtle">{body}</p>
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="relative py-24 border-t border-hairline">
      <div className="mesh" style={{ width: 500, height: 500, top: 120, left: '50%', marginLeft: -250, background: 'radial-gradient(circle, #7c5cff, transparent 70%)', opacity: 0.16 }} />
      <div className="relative max-w-content mx-auto px-5 lg:px-8">
        <Reveal>
          <SectionHead center
            eyebrow="THE BRAIN"
            title={<>One brain. Three things your faculty <GradText>can&apos;t do at scale.</GradText></>}
            sub="Not a chatbot bolted onto a PDF. A tutor engineered for the exact way JEE students actually learn — and the exact way they actually fail." />
        </Reveal>

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          <Reveal delay={0}><FeatureCard icon={Ic.scan} tag="DEEP OCR" title="It reads the messy stuff." body="Crumpled handwritten sums, hand-drawn free-body diagrams, smudged subscripts — the OCR brain ingests them flawlessly and solves from what the student actually wrote." /></Reveal>
          <Reveal delay={90}><FeatureCard icon={Ic.swap} tag="ANALOGY ENGINE" title="It explains in their language." body="It knows the student loves cricket, so it teaches the Magnus effect through swing bowling. Concepts stick because they land in a world the student already lives in." /></Reveal>
          <Reveal delay={180}><FeatureCard icon={Ic.check} tag="MICRO-TEST LOOP" title="It refuses to fake progress." body="Every 5 paragraphs it forces a 2-question check. Get it wrong and it re-teaches before moving on. No more nodding-along that collapses on test day." /></Reveal>
        </div>

        <div id="analogy" className="mt-20 grid lg:grid-cols-5 gap-8 items-center">
          <Reveal className="lg:col-span-2">
            <Eyebrow>INTERACTIVE · ANALOGY ENGINE</Eyebrow>
            <h3 className="font-display text-[30px] font-semibold text-ink mt-4 leading-tight">Same concept. Taught in the language your student already dreams in.</h3>
            <p className="mt-4 text-[15.5px] leading-relaxed text-inkSubtle">A funded app gives every kid the same textbook paragraph. Flux gives the cricket kid swing bowling and the football kid a banana free-kick — the same physics, retold until it clicks.</p>
            <p className="mt-3 text-[14px] text-inkTertiary font-mono">↓ flip the lens — watch the explanation change.</p>
          </Reveal>
          <Reveal delay={120} className="lg:col-span-3">
            <AnalogyEngine />
          </Reveal>
        </div>

        <div className="mt-20 grid lg:grid-cols-5 gap-8 items-center">
          <Reveal delay={120} className="lg:col-span-3 order-2 lg:order-1">
            <MicroTest />
          </Reveal>
          <Reveal className="lg:col-span-2 order-1 lg:order-2">
            <Eyebrow>INTERACTIVE · MICRO-TEST LOOP</Eyebrow>
            <h3 className="font-display text-[30px] font-semibold text-ink mt-4 leading-tight">Comprehension, guaranteed — or the lesson doesn&apos;t move.</h3>
            <p className="mt-4 text-[15.5px] leading-relaxed text-inkSubtle">The deadliest failure in coaching is the silent one: a student who feels like they&apos;re learning but isn&apos;t. The micro-test loop makes that impossible — progress is earned, never assumed.</p>
            <p className="mt-3 text-[14px] text-inkTertiary font-mono">↓ answer both — try getting one wrong.</p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ===================== MOAT ===================== */
export function Moat() {
  return (
    <section id="moat" className="relative py-24 border-t border-hairline">
      <div className="max-w-content mx-auto px-5 lg:px-8">
        <Reveal>
          <SectionHead
            eyebrow="THE MOAT"
            title={<>Students are the product they use.<br /><GradText>Retention</GradText> is the product you buy.</>}
            sub="The tutor wins the student. These two dashboards win the director — by turning learning data into the two things that decide your year: classroom intervention and parent trust." />
        </Reveal>

        <div className="mt-14 grid lg:grid-cols-2 gap-5">
          <Reveal>
            <div className="flex flex-col gap-4 h-full">
              <ConfusionHeatmap />
              <div className="px-1">
                <div className="font-mono text-[11px] tracking-eyebrow text-inkTertiary">FOR YOUR TEACHERS</div>
                <h3 className="mt-1.5 text-[19px] font-semibold text-ink">Walk into class already knowing where the batch broke.</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-inkSubtle">No more teaching blind. The Confusion Heatmap surfaces the exact concept tripping the batch — so revision is aimed, faculty time is spent where it moves marks, and burnout from re-explaining everything to everyone ends.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex flex-col gap-4 h-full">
              <WhatsAppReport />
              <div className="px-1">
                <div className="font-mono text-[11px] tracking-eyebrow text-inkTertiary">FOR THE PARENTS</div>
                <h3 className="mt-1.5 text-[19px] font-semibold text-ink">The weekly WhatsApp that kills churn before it starts.</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-inkSubtle">Every Sunday, each parent gets an automated, on-brand progress report — hours, mastery, weak spots, trajectory. Engaged parents re-admit. This is your retention engine, running on autopilot.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ===================== FINAL CTA ===================== */
function ContactReveal() {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <PrimaryBtn href="#" large onClick={(e) => { e.preventDefault(); setOpen(true) }}>
        Talk to Sales <Ic.arrow width="16" height="16" />
      </PrimaryBtn>
    )
  }
  return (
    <div className="reveal in flex flex-col sm:flex-row gap-3">
      <a href="tel:+919873535273" className="btn-ghost inline-flex items-center gap-3 rounded-[12px] px-5 h-14 group">
        <span className="w-9 h-9 rounded-lg bg-surface2 border border-hairlineStrong flex items-center justify-center text-primaryHover"><Ic.phone width="17" height="17" /></span>
        <span className="text-left leading-tight">
          <span className="block text-[10.5px] font-mono tracking-eyebrow text-inkTertiary">CALL SHOBIT</span>
          <span className="block text-[15px] font-medium text-ink">+91 98735 35273</span>
        </span>
      </a>
      <a href="mailto:shobit@learningflux.com?subject=4-Week%20Pilot%20Enquiry" className="btn-ghost inline-flex items-center gap-3 rounded-[12px] px-5 h-14">
        <span className="w-9 h-9 rounded-lg bg-surface2 border border-hairlineStrong flex items-center justify-center text-primaryHover"><Ic.mail width="17" height="17" /></span>
        <span className="text-left leading-tight">
          <span className="block text-[10.5px] font-mono tracking-eyebrow text-inkTertiary">EMAIL US</span>
          <span className="block text-[15px] font-medium text-ink">shobit@learningflux.com</span>
        </span>
      </a>
    </div>
  )
}

export function FinalCTA() {
  const incl = [
    'Your institute fully white-labeled — logo, name, domain',
    'Deep-OCR tutor live for one full batch',
    'Confusion Heatmap for every teacher',
    'Automated weekly WhatsApp reports to every parent',
    'Retention & doubt-resolution baseline you actually measure',
  ]

  return (
    <section id="pilot" className="relative py-24 border-t border-hairline overflow-hidden">
      <div className="mesh" style={{ width: 620, height: 620, bottom: -200, left: '50%', marginLeft: -310, background: 'radial-gradient(circle, #b94bdc, transparent 65%)', opacity: 0.3 }} />
      <div className="relative max-w-content mx-auto px-5 lg:px-8">
        <div className="card rounded-xl2 overflow-hidden glow-violet">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 lg:p-12">
              <Eyebrow>4-WEEK NEXT BATCH PILOT</Eyebrow>
              <h2 className="font-display text-[clamp(30px,4vw,44px)] font-semibold text-ink mt-4 leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>
                Run it with your next batch. <GradText>Keep it if retention moves.</GradText>
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-inkSubtle">
                No year-long contract to gamble on. We white-label LearningFlux as your own, deploy it to one batch, and put the dashboards in your teachers&apos; and parents&apos; hands. Four weeks later, you look at the retention numbers and decide. The funded apps want you watching from the sidelines — don&apos;t.
              </p>
              <div className="mt-8 flex flex-col gap-2">
                <ContactReveal />
                <p className="text-[12.5px] text-inkTertiary font-mono mt-1">Limited pilots per city to protect institute exclusivity.</p>
              </div>
            </div>
            <div className="p-8 lg:p-12 border-t lg:border-t-0 lg:border-l border-hairline bg-gradient-to-br from-surface1 to-canvas">
              <div className="font-mono text-[11px] tracking-eyebrow text-inkTertiary">WHAT THE PILOT INCLUDES</div>
              <ul className="mt-5 flex flex-col gap-3.5">
                {incl.map((it) => (
                  <li key={it} className="flex items-start gap-3 text-[15px] text-inkMuted">
                    <span className="mt-0.5 w-5 h-5 shrink-0 rounded-md bg-success/15 border border-success/40 flex items-center justify-center text-success">
                      <Ic.check width="12" height="12" />
                    </span>
                    {it}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-6 border-t border-hairline flex items-center gap-3 text-[13px] text-inkSubtle">
                <span className="w-2 h-2 rounded-full bg-success live-dot" />
                Setup handled by us — your team teaches, we run the brain.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
