import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { m, useInView } from 'motion/react'
import {
  Lightbulb,
  BarChart3,
  UserCheck,
  FileText,
  ShieldCheck,
  ArrowRight,
  Zap,
  Brain,
  Target,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

// ── Floating script fragment canvas ───────────────────────────────────────────

function ScriptCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const fragments = [
      'Hook 1:', 'CTA:', '━━━', 'PROOF', 'STORY', '7 / 10',
      'PASS', '// idea', '→', 'Script Agent', 'HOLD', 'Problem:',
      'Quality Gate', 'ICE Score', 'Brand Voice', '{ }', 'Solution:',
    ]

    type Particle = { x: number; y: number; text: string; opacity: number; speed: number; size: number }

    const particles: Particle[] = Array.from({ length: 24 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      text: fragments[Math.floor(Math.random() * fragments.length)],
      opacity: Math.random() * 0.12 + 0.02,
      speed: Math.random() * 0.25 + 0.08,
      size: Math.random() * 4 + 9,
    }))

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = '#818cf8'
        ctx.font = `${p.size}px monospace`
        ctx.fillText(p.text, p.x, p.y)
        ctx.restore()
        p.y -= p.speed
        if (p.y < -30) {
          p.y = canvas.height + 30
          p.x = Math.random() * canvas.width
          p.text = fragments[Math.floor(Math.random() * fragments.length)]
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" />
}

// ── Typewriter ─────────────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 55) {
  const [out, setOut] = useState('')
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i++
      setOut(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return out
}

// ── Scroll reveal wrapper ──────────────────────────────────────────────────────

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })
  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </m.div>
  )
}

// ── Data ───────────────────────────────────────────────────────────────────────

const pipeline = [
  { icon: Lightbulb,   label: 'Idea Agent',    sub: 'Step 01', color: '#a78bfa' },
  { icon: BarChart3,   label: 'ICE Scoring',   sub: 'Step 02', color: '#818cf8' },
  { icon: UserCheck,   label: 'Human Review',  sub: 'Step 03', color: '#6366f1' },
  { icon: FileText,    label: 'Script Agent',  sub: 'Step 04', color: '#4f46e5' },
  { icon: ShieldCheck, label: 'Quality Gate',  sub: 'Step 05', color: '#4338ca' },
]

const features = [
  {
    icon: Brain,
    title: 'Idea Intelligence',
    tag: 'AI-Powered',
    body: 'Generates high-impact content ideas tailored to your client\'s avatar, pain points, and approved proof bank.',
  },
  {
    icon: BarChart3,
    title: 'ICE Scoring',
    tag: 'Data-Driven',
    body: 'Every idea is scored by Impact, Confidence, and Ease before it reaches a human — no gut-feeling guesswork.',
  },
  {
    icon: FileText,
    title: 'Script Generation',
    tag: 'Production-Ready',
    body: 'Approved ideas become full video scripts: three hooks, problem, story, solution, proof, CTA. Choose your target duration.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Gate',
    tag: '10 Checkpoints',
    body: 'A dedicated agent evaluates every script across 10 criteria — fabrication, hook strength, brand voice, structure, and more.',
  },
  {
    icon: Target,
    title: 'Client Context',
    tag: 'Personalized',
    body: 'Every script is grounded in real client data: proof bank, brand voice, offer mechanics, and customer avatar pains.',
  },
  {
    icon: Zap,
    title: 'Full Pipeline',
    tag: 'End-to-End',
    body: 'From idea to quality-reviewed script in minutes. Run the entire creative production workflow from one dashboard.',
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export function HomePage() {
  const tagline = useTypewriter('Write scripts that convert.', 58)

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: '#0a0a0a', color: '#f5f5f5', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif' }}
    >

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <ScriptCanvas />

        {/* ambient glow */}
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: 480, height: 480, background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '25%', right: '18%', width: 320, height: 320, background: 'radial-gradient(circle, rgba(79,70,229,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

          {/* badge */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.07)', padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#818cf8', marginBottom: 36, letterSpacing: '0.04em' }}
          >
            <Sparkles style={{ width: 12, height: 12 }} />
            Multi-Agent AI Content Pipeline
          </m.div>

          {/* wordmark */}
          <m.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 'clamp(72px, 10vw, 112px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 28 }}
          >
            Script<span style={{ color: '#6366f1' }}>Flow</span>
          </m.div>

          {/* typewriter */}
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            style={{ fontSize: 22, fontWeight: 500, fontFamily: 'monospace', color: '#e5e5e5', marginBottom: 18, minHeight: 32 }}
          >
            {tagline}
            <m.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ display: 'inline-block', width: 2, height: '1em', background: '#6366f1', marginLeft: 2, verticalAlign: 'text-bottom' }}
            />
          </m.p>

          {/* subtitle */}
          <m.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.05 }}
            style={{ color: '#737373', fontSize: 15, lineHeight: 1.75, maxWidth: 480, margin: '0 auto 40px' }}
          >
            From client brief to quality-reviewed video script in minutes.
            Five AI agents working in sequence so you don't have to.
          </m.p>

          {/* CTA */}
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.3 }}
          >
            <Link
              to="/app"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 10, background: '#6366f1', padding: '14px 28px', fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', transition: 'background 0.18s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#4f46e5' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#6366f1' }}
            >
              Enter App
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </m.div>
        </div>

        {/* scroll nudge */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.8 }}
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <span style={{ fontSize: 9, letterSpacing: '0.18em', color: '#3f3f3f', textTransform: 'uppercase' }}>Scroll</span>
          <m.div
            animate={{ y: [0, 7, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            style={{ width: 1, height: 20, background: 'linear-gradient(to bottom, #3f3f3f, transparent)' }}
          />
        </m.div>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 12 }}>
              How It Works
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 72 }}>
              Five agents. One pipeline.
            </h2>
          </Reveal>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            {pipeline.map((step, i) => (
              <Reveal key={step.label} delay={i * 0.1}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 8px' }}>
                    <m.div
                      whileHover={{ scale: 1.08, y: -3 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                      style={{ width: 56, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: `1px solid ${step.color}30`, background: `${step.color}10` }}
                    >
                      <step.icon style={{ width: 22, height: 22, color: step.color }} />
                    </m.div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f5' }}>{step.label}</span>
                    <span style={{ fontSize: 10, color: '#404040', marginTop: 4, fontFamily: 'monospace' }}>{step.sub}</span>
                  </div>
                  {i < pipeline.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20, flexShrink: 0, width: 32 }}>
                      <ArrowRight style={{ width: 14, height: 14, color: '#2a2a2a' }} />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 12 }}>
              Capabilities
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>
              Built for serious content teams
            </h2>
            <p style={{ textAlign: 'center', color: '#737373', fontSize: 14, maxWidth: 440, margin: '0 auto 64px', lineHeight: 1.7 }}>
              Every feature is designed around the real workflow of high-ticket coaching content — from brief to delivery.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.07}>
                <m.div
                  whileHover={{ y: -4, borderColor: 'rgba(99,102,241,0.35)' }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  style={{ borderRadius: 14, border: '1px solid #1f1f1f', background: '#0f0f0f', padding: 24, cursor: 'default', height: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <f.icon style={{ width: 16, height: 16, color: '#6366f1' }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(99,102,241,0.6)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 999, padding: '3px 8px' }}>
                      {f.tag}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f5', marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: 12, lineHeight: 1.7, color: '#5a5a5a' }}>{f.body}</p>
                </m.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '112px 24px', borderTop: '1px solid #1a1a1a', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)', padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#818cf8', marginBottom: 28, letterSpacing: '0.04em' }}>
              <CheckCircle2 style={{ width: 12, height: 12 }} />
              Ready to produce
            </div>

            <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 20 }}>
              Start producing<br />
              <span style={{ color: '#6366f1' }}>better scripts.</span>
            </h2>

            <p style={{ color: '#737373', fontSize: 14, lineHeight: 1.75, marginBottom: 40 }}>
              Your AI content pipeline is live. Run your first pipeline,
              approve ideas, and get quality-reviewed scripts in minutes.
            </p>

            <Link
              to="/app"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 10, background: '#6366f1', padding: '16px 36px', fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', transition: 'background 0.18s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#4f46e5' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#6366f1' }}
            >
              Open ScriptFlow
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* footer */}
      <div style={{ borderTop: '1px solid #141414', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#333' }}>ScriptFlow — AI Content Pipeline</p>
      </div>
    </div>
  )
}
