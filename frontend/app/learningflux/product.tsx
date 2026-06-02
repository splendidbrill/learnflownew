'use client'

import { useState } from 'react'
import { Ic } from './components'

/* ============ HERO PRODUCT PANEL ============ */
export function HeroPanel() {
  return (
    <div className="card rounded-xl2 p-3 glow-violet">
      <div className="flex items-center justify-between px-2 pt-1 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-azure to-primary flex items-center justify-center text-[12px] font-bold text-white">A</div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink">Aakash Tutor</div>
            <div className="text-[10.5px] text-inkTertiary font-mono">your institute · white-labeled</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-inkSubtle">
          <span className="w-1.5 h-1.5 rounded-full bg-success live-dot" /> online 24×7
        </div>
      </div>

      <div className="rounded-lg bg-canvas border border-hairline p-3.5 flex flex-col gap-3">
        <div className="flex justify-end">
          <div className="max-w-[78%] flex flex-col items-end gap-1.5">
            <div className="rounded-2xl rounded-br-sm bg-surface2 border border-hairline px-3 py-2 text-[13px] text-inkMuted">
              Sir I don&apos;t get this projectile sum 😅
            </div>
            <div className="rounded-lg border border-hairline bg-surface1 p-2 w-[190px]">
              <svg viewBox="0 0 180 80" className="w-full h-[58px]">
                <rect x="0" y="0" width="180" height="80" rx="6" fill="#0c0817" />
                <path d="M14 64 Q70 8 150 30" fill="none" stroke="#6f6790" strokeWidth="1.6" strokeDasharray="4 3" />
                <line x1="14" y1="64" x2="150" y2="64" stroke="#574f73" strokeWidth="1.4" />
                <line x1="14" y1="64" x2="14" y2="20" stroke="#574f73" strokeWidth="1.4" />
                <circle cx="14" cy="64" r="3" fill="#ff3d8b" />
                <path d="M22 56 l14 -10" stroke="#8b84a6" strokeWidth="1.4" markerEnd="url(#ah)" />
                <text x="40" y="44" fill="#7d7699" fontSize="8" fontFamily="monospace">u=20 m/s</text>
                <text x="96" y="20" fill="#7d7699" fontSize="8" fontFamily="monospace">θ=?</text>
                <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6Z" fill="#8b84a6" /></marker></defs>
              </svg>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono text-inkTertiary">
                <Ic.scan width="11" height="11" /> handwritten_note.jpg
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start text-[11px] font-mono">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 border border-hairlineStrong px-2.5 py-1 text-inkMuted">
            <span className="w-1.5 h-1.5 rounded-full bg-azure" /> Diagram parsed · 3 vectors + angle detected
          </span>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[86%] rounded-2xl rounded-bl-sm bg-gradient-to-br from-surface2 to-surface1 border border-hairlineStrong px-3.5 py-2.5">
            <div className="text-[11px] font-mono text-primaryHover mb-1">FLUX · solving</div>
            <p className="text-[13px] leading-relaxed text-ink">
              Got it — your launch angle is missing, so let&apos;s find it. Split <b className="text-primaryHover">u = 20 m/s</b> into Uₓ and U_y. The horizontal part never changes…<span className="caret text-primaryHover">▌</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============ ANALOGY ENGINE ============ */
interface AnalogyData {
  label: string
  line: string
  body: React.ReactNode
  chips: string[]
  diagram: string
}

const ANALOGIES: Record<string, AnalogyData> = {
  cricket: {
    label: 'Cricket',
    line: 'You watch every IPL match — so picture this.',
    body: (
      <>An <b className="text-ink">inswinger</b> curves toward the batsman because the bowler tilts the seam and the spinning ball drags air faster on one side. Lower pressure on that side <b className="text-primaryHover">pulls the ball sideways</b> mid-air. That sideways pull is the Magnus force — the exact same physics in your projectile sum.</>
    ),
    chips: ['Seam angle = spin axis', 'Swing = Magnus force', 'Beats the batsman = net deflection'],
    diagram: 'cricket',
  },
  football: {
    label: 'Football',
    line: 'You bend free-kicks in the ground every evening — same idea.',
    body: (
      <>A <b className="text-ink">banana free-kick</b> bends around the wall because your boot puts spin on the ball. The spin speeds up airflow on one side, drops the pressure, and <b className="text-primaryHover">curls the ball</b> past the keeper. Same Magnus force, just a different pitch.</>
    ),
    chips: ['Boot spin = spin axis', 'Curl = Magnus force', 'Around the wall = net deflection'],
    diagram: 'football',
  },
}

function AnalogyDiagram({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 320 150" className="w-full h-full">
      <defs>
        <linearGradient id="traj" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c5cff" /><stop offset="1" stopColor="#ff3d8b" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="150" rx="10" fill="#0b0717" />
      <line x1="0" y1="128" x2="320" y2="128" stroke="#2a2142" strokeWidth="1.5" />
      <path d="M30 118 Q150 -6 290 70" fill="none" stroke="url(#traj)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="30" cy="118" r="5" fill="#7c5cff" />
      <circle cx="290" cy="70" r="6" fill="#ff3d8b" />
      <path d="M150 40 a14 14 0 1 0 8 4" fill="none" stroke="#a585ff" strokeWidth="1.6" markerEnd="url(#sp)" />
      <text x="172" y="36" fill="#a585ff" fontSize="9" fontFamily="monospace">spin</text>
      <defs><marker id="sp" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6Z" fill="#a585ff" /></marker></defs>
      {kind === 'cricket' ? (
        <g>
          <line x1="288" y1="98" x2="288" y2="118" stroke="#6f6790" strokeWidth="1.6" />
          <line x1="293" y1="98" x2="293" y2="118" stroke="#6f6790" strokeWidth="1.6" />
          <line x1="298" y1="98" x2="298" y2="118" stroke="#6f6790" strokeWidth="1.6" />
          <text x="24" y="142" fill="#6f6790" fontSize="9" fontFamily="monospace">bowler</text>
          <text x="258" y="142" fill="#6f6790" fontSize="9" fontFamily="monospace">stumps</text>
        </g>
      ) : (
        <g>
          <rect x="280" y="86" width="26" height="32" fill="none" stroke="#6f6790" strokeWidth="1.6" />
          <line x1="252" y1="86" x2="252" y2="128" stroke="#574f73" strokeWidth="3" strokeDasharray="2 4" />
          <text x="24" y="142" fill="#6f6790" fontSize="9" fontFamily="monospace">free-kick</text>
          <text x="276" y="142" fill="#6f6790" fontSize="9" fontFamily="monospace">goal</text>
        </g>
      )}
    </svg>
  )
}

export function AnalogyEngine() {
  const [sport, setSport] = useState('cricket')
  const a = ANALOGIES[sport]
  return (
    <div className="card rounded-xl2 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-2 text-[12px] font-mono text-inkSubtle">
          <Ic.swap width="14" height="14" className="text-primaryHover" /> CONCEPT: MAGNUS EFFECT
        </div>
        <div className="inline-flex rounded-full bg-canvas border border-hairline p-0.5">
          {Object.keys(ANALOGIES).map((k) => (
            <button key={k} onClick={() => setSport(k)}
              className={'px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all ' +
                (sport === k ? 'bg-surface2 text-ink shadow-[0_0_0_1px_rgba(139,92,255,0.4)]' : 'text-inkSubtle hover:text-ink')}>
              {ANALOGIES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-0">
        <div className="p-5 flex flex-col">
          <div className="h-[150px] rounded-xl overflow-hidden border border-hairline">
            <AnalogyDiagram kind={a.diagram} />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {a.chips.map((c) => (
              <span key={c} className="text-[11px] font-mono text-inkMuted bg-surface2 border border-hairline rounded-md px-2 py-1">{c}</span>
            ))}
          </div>
        </div>
        <div className="p-5 border-t md:border-t-0 md:border-l border-hairline flex flex-col justify-center bg-gradient-to-br from-surface1 to-canvas">
          <div className="text-[11px] font-mono text-primaryHover mb-2">FLUX · personalised for this student</div>
          <p className="text-[13px] text-inkSubtle italic mb-2">&ldquo;{a.line}&rdquo;</p>
          <p key={sport} className="text-[15px] leading-relaxed text-inkMuted reveal in">{a.body}</p>
        </div>
      </div>
    </div>
  )
}

/* ============ MICRO-TEST LOOP ============ */
const MT_QUESTIONS = [
  {
    q: 'During projectile motion (ignore air), the horizontal velocity…',
    options: ['Keeps increasing', 'Stays constant', 'Drops to zero at the top'],
    correct: 1,
  },
  {
    q: 'What makes the vertical velocity change on the way up?',
    options: ['Air pushing back', 'Gravity (g = 9.8 m/s²)', 'The throwing force still acting'],
    correct: 1,
  },
]

export function MicroTest() {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null])
  const allCorrect = answers.every((a, i) => a === MT_QUESTIONS[i].correct)
  const allAnswered = answers.every((a) => a !== null)

  const pick = (qi: number, oi: number) => {
    setAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n })
  }
  const reset = () => setAnswers([null, null])

  return (
    <div className="card rounded-xl2 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-2 text-[12px] font-mono text-inkSubtle">
          <Ic.check width="14" height="14" className="text-primaryHover" /> COMPREHENSION CHECKPOINT
        </div>
        <span className="text-[11px] font-mono text-inkTertiary">after every 5 ¶</span>
      </div>

      <div className="px-5 pt-4">
        <div className="rounded-lg bg-canvas border border-hairline p-3.5 text-[13px] leading-relaxed text-inkSubtle">
          <span className="text-inkTertiary font-mono text-[11px]">…¶5 </span>
          Split the launch speed into two parts. The <b className="text-inkMuted">horizontal</b> part is left alone the entire flight, while the <b className="text-inkMuted">vertical</b> part is pulled down by gravity. The student can&apos;t move on until they prove they got this.
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {MT_QUESTIONS.map((item, qi) => (
          <div key={qi}>
            <div className="text-[14px] font-medium text-ink mb-2">{qi + 1}. {item.q}</div>
            <div className="grid gap-1.5">
              {item.options.map((opt, oi) => {
                const chosen = answers[qi] === oi
                const isCorrect = oi === item.correct
                let cls = 'border-hairline bg-surface1 text-inkMuted hover:border-hairlineStrong hover:text-ink'
                if (chosen && isCorrect) cls = 'border-success/60 bg-success/10 text-ink'
                else if (chosen && !isCorrect) cls = 'border-magenta/60 bg-magenta/10 text-ink'
                else if (answers[qi] !== null && isCorrect) cls = 'border-success/40 bg-success/5 text-inkMuted'
                return (
                  <button key={oi} onClick={() => pick(qi, oi)}
                    className={'flex items-center justify-between gap-2 text-left text-[13px] rounded-lg border px-3 py-2 transition-all ' + cls}>
                    <span>{opt}</span>
                    {chosen && isCorrect && <Ic.check width="15" height="15" className="text-success" />}
                    {chosen && !isCorrect && <span className="text-magenta text-[16px] leading-none">×</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5">
        {!allAnswered && (
          <div className="rounded-lg border border-hairline bg-surface1 px-4 py-3 text-[13px] text-inkSubtle font-mono">
            ▌ Answer both to unlock the next 5 paragraphs.
          </div>
        )}
        {allAnswered && allCorrect && (
          <div className="rounded-lg border border-success/50 bg-success/10 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-[13px] text-ink">
              <span className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center"><Ic.check width="15" height="15" className="text-success" /></span>
              <span><b>Comprehension confirmed.</b> Unlocking ¶6–10 →</span>
            </div>
            <button onClick={reset} className="text-[12px] font-mono text-inkSubtle hover:text-ink underline underline-offset-2">replay</button>
          </div>
        )}
        {allAnswered && !allCorrect && (
          <div className="rounded-lg border border-magenta/50 bg-magenta/10 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-[13px] text-inkMuted">Not yet — Flux re-teaches the missed idea, then re-tests. No fake progress.</div>
            <button onClick={reset} className="text-[12px] font-mono text-magenta hover:text-ink underline underline-offset-2 whitespace-nowrap">try again</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============ CONFUSION HEATMAP ============ */
const HEAT_ROWS: [string, number[]][] = [
  ['Rotational Motion', [0.9, 0.85, 0.7, 0.95, 0.8, 0.6, 0.88, 0.92, 0.75, 0.83]],
  ['Thermodynamics', [0.2, 0.35, 0.5, 0.15, 0.42, 0.3, 0.25, 0.55, 0.4, 0.22]],
  ['Electrostatics', [0.55, 0.62, 0.4, 0.7, 0.5, 0.65, 0.48, 0.58, 0.6, 0.52]],
  ['Aldehydes & Ketones', [0.78, 0.6, 0.82, 0.7, 0.75, 0.88, 0.65, 0.8, 0.72, 0.85]],
  ['Definite Integration', [0.12, 0.2, 0.08, 0.3, 0.18, 0.1, 0.25, 0.15, 0.22, 0.14]],
]

function heatColor(v: number): string {
  if (v < 0.33) return `rgba(52,217,156,${0.18 + v})`
  if (v < 0.66) return `rgba(139,92,255,${0.25 + (v - 0.33)})`
  return `rgba(255,61,139,${0.3 + (v - 0.66) * 1.1})`
}

export function ConfusionHeatmap() {
  return (
    <div className="card rounded-xl2 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Ic.grid width="15" height="15" className="text-primaryHover" />
          <span className="text-[13px] font-semibold text-ink">Batch 2026 · Confusion Heatmap</span>
        </div>
        <span className="text-[11px] font-mono text-inkTertiary">live · 42 students</span>
      </div>
      <div className="p-5">
        <div className="flex flex-col gap-1.5">
          {HEAT_ROWS.map(([topic, cells]) => (
            <div key={topic} className="flex items-center gap-3">
              <div className="w-[150px] shrink-0 text-[12px] text-inkMuted truncate">{topic}</div>
              <div className="flex gap-1 flex-1">
                {cells.map((v, i) => (
                  <div key={i} className="h-6 flex-1 rounded-[3px] border border-white/5"
                    style={{ background: heatColor(v) }} title={Math.round(v * 100) + '% confusion'} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-magenta/40 bg-magenta/10 px-3.5 py-2.5 flex items-start gap-2.5">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-magenta live-dot shrink-0" />
          <p className="text-[12.5px] text-inkMuted leading-relaxed">
            <b className="text-ink">68% of the batch is stuck</b> on Rotational Motion — specifically the torque sign convention. Flux flagged it Tuesday; you can re-teach it Thursday, before the test.
          </p>
        </div>

        <div className="mt-3 flex items-center gap-4 text-[10.5px] font-mono text-inkTertiary">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: heatColor(0.1) }} /> clear</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: heatColor(0.5) }} /> shaky</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: heatColor(0.9) }} /> confused</span>
        </div>
      </div>
    </div>
  )
}

/* ============ WHATSAPP PARENT REPORT ============ */
export function WhatsAppReport() {
  return (
    <div className="card rounded-xl2 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Ic.whatsapp width="16" height="16" className="text-success" />
          <span className="text-[13px] font-semibold text-ink">Weekly Parent Report</span>
        </div>
        <span className="text-[11px] font-mono text-inkTertiary">auto · Sun 7:00 PM</span>
      </div>

      <div className="p-4" style={{ background: 'repeating-linear-gradient(0deg,#0c0817,#0c0817 2px)' }}>
        <div className="rounded-lg p-3" style={{ background: '#0a1410' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-azure to-primary flex items-center justify-center text-[12px] font-bold text-white">A</div>
            <div className="leading-tight">
              <div className="text-[12.5px] font-semibold text-ink">Aakash Institute</div>
              <div className="text-[10px] text-success font-mono">via LearningFlux · business</div>
            </div>
          </div>
          <div className="max-w-[92%] rounded-xl rounded-tl-sm px-3 py-2.5" style={{ background: '#103126' }}>
            <div className="text-[12.5px] font-semibold text-success mb-1.5">Aarav&apos;s week · Physics + Maths</div>
            <ul className="text-[12.5px] text-inkMuted leading-relaxed flex flex-col gap-1">
              <li>📈 <b className="text-ink">6.4 hrs</b> studied · 11 doubts cleared at home</li>
              <li>✅ Mastered: Kinematics, Work–Energy</li>
              <li>⚠️ Needs a push: <b className="text-ink">Rotational Motion</b></li>
              <li>🎯 On track for the Nov mock test</li>
            </ul>
            <div className="mt-2 text-[10.5px] text-inkTertiary text-right font-mono">Sun 7:02 PM ✓✓</div>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-inkSubtle leading-relaxed px-1">
          Parents who get a Sunday update don&apos;t go silent — and silent parents are the ones who don&apos;t re-admit.
        </p>
      </div>
    </div>
  )
}
