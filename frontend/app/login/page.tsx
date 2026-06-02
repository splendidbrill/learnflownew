'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#08060f] flex items-center justify-center px-4">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,92,255,0.18), transparent 65%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c5cff" />
                <stop offset="0.5" stopColor="#c64bdd" />
                <stop offset="1" stopColor="#ff3d8b" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="30" height="30" rx="9" fill="#0f0a1c" stroke="#352a55" />
            <path d="M11 9h11M11 9v14M11 16h8" stroke="url(#lg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.5 19.5l3.5 3.5-3.5 3.5" stroke="url(#lg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          </svg>
          <span className="font-semibold text-[19px] tracking-tight text-[#f5f3fc]">
            Learning<span style={{
              background: 'linear-gradient(100deg, #9d7bff 0%, #d05bf0 45%, #ff5ca0 80%, #54b3ff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>Flux</span>
          </span>
        </div>

        {/* card */}
        <div className="rounded-[20px] border border-[#221a36] bg-[#110c1d] p-8"
          style={{ boxShadow: '0 0 80px -20px rgba(139,92,255,0.25)' }}>
          <h1 className="text-[22px] font-semibold text-[#f5f3fc] mb-1">Welcome back</h1>
          <p className="text-[14px] text-[#8b84a6] mb-7">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#c5bedd] uppercase tracking-wide">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-[10px] border border-[#251d3a] bg-[#08060f] px-3.5 text-[14px] text-[#f5f3fc] placeholder:text-[#5d566f] outline-none focus:border-[#8b5cff] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#c5bedd] uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-[10px] border border-[#251d3a] bg-[#08060f] px-3.5 pr-11 text-[14px] text-[#f5f3fc] placeholder:text-[#5d566f] outline-none focus:border-[#8b5cff] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5d566f] hover:text-[#8b84a6] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.4 18.4 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6"/>
                      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>
                      <path d="m2 2 20 20"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-[#ff3d8b] bg-[#ff3d8b]/10 border border-[#ff3d8b]/30 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 rounded-[10px] font-medium text-[15px] text-white disabled:opacity-60 transition-all"
              style={{
                background: 'linear-gradient(100deg, #7c5cff 0%, #b94bdc 48%, #ff3d8b 100%)',
                boxShadow: '0 10px 30px -8px rgba(139,92,255,0.55)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
