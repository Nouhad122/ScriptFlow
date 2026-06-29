import type { ClientContext } from '@/types'

export const MOCK_CLIENTS: ClientContext[] = [
  {
    id: 'marcus-vane-001',
    name: 'Marcus Vane',
    niche: 'high-ticket fitness coaching for busy executives',
    avatars: [
      {
        name: 'Overworked Executive',
        pains: ['No time to work out', 'Low energy all day', 'Gaining weight despite good intentions'],
        desires: ['Visible results in 60 days', 'Sustainable system that fits a packed calendar', 'Confidence in the boardroom'],
      },
    ],
    brandVoice: {
      tone: 'direct, no-fluff, results-driven',
      speakingStyle: 'conversational authority',
      doNotUse: ['try', 'maybe', 'sort of', 'kind of'],
      referenceExamples: [],
    },
    proofBank: [
      {
        type: 'result',
        content: 'CEO went from 29% body fat to 18% in 90 days without missing a single board meeting',
        source: 'James T. Case Study',
      },
      {
        type: 'testimonial',
        content: 'I finally have energy for my family after work. The 30-minute system changed everything.',
        source: 'Daniel R., CFO',
      },
    ],
    offerMechanics: {
      productName: 'Executive Edge Program',
      price: '$5,000',
      guarantee: '60-day visible results guarantee or full refund',
      keyBenefits: ['Custom 30-min workouts', 'Nutrition plan for travel', '1-on-1 weekly coaching calls'],
      cta: 'Book a free strategy call at marcusvane.com/start',
    },
    portfolioSummary: 'Helped 150+ C-suite executives get in the best shape of their careers without sacrificing performance.',
    referencePackPath: '',
  },
  {
    id: 'freedom-coach-001',
    name: 'Freedom Coach',
    niche: 'high-ticket online business coaching for aspiring entrepreneurs',
    avatars: [
      {
        name: 'Stuck 9-to-5er',
        pains: ['Trading time for money', 'Zero control over schedule', 'Underpaid for their skills'],
        desires: ['Quit job within 90 days', '$10K/month from home', 'Full control of their time'],
      },
    ],
    brandVoice: {
      tone: 'empowering and direct',
      speakingStyle: 'conversational, real-talk',
      doNotUse: ['maybe', 'perhaps', 'might'],
      referenceExamples: [],
    },
    proofBank: [
      {
        type: 'result',
        content: 'Client went from $3K/month salary to $22K/month online business in 90 days',
        source: 'Marcus Vane Client Case Study',
      },
      {
        type: 'testimonial',
        content: 'I replaced my salary in 8 weeks. The system actually works.',
        source: 'Sarah M.',
      },
    ],
    offerMechanics: {
      productName: 'Freedom Business Accelerator',
      price: '$3,000',
      guarantee: '30-day money-back guarantee',
      keyBenefits: ['1-on-1 coaching', 'Done-for-you lead generation', 'Private community access'],
      cta: 'Book your free strategy call at freedomcoach.com',
    },
    portfolioSummary: 'Helped 200+ entrepreneurs replace their 9-to-5 income within 90 days.',
    referencePackPath: '',
  },
  {
    id: 'scale-labs-001',
    name: 'Scale Labs',
    niche: 'B2B SaaS growth consulting for early-stage startups',
    avatars: [
      {
        name: 'Stalled Founder',
        pains: ['Plateaued at $20K MRR for 6 months', 'Burning cash with no clear growth path', 'Overwhelmed by conflicting growth advice'],
        desires: ['Reach $100K MRR in 12 months', 'Repeatable sales motion', 'Investor-ready traction metrics'],
      },
    ],
    brandVoice: {
      tone: 'analytical and precise',
      speakingStyle: 'data-backed, no buzzwords',
      doNotUse: ['synergy', 'disrupt', 'game-changer', 'revolutionary'],
      referenceExamples: [],
    },
    proofBank: [
      {
        type: 'result',
        content: 'Took a B2B SaaS from $18K MRR to $110K MRR in 11 months using our three-pillar growth system',
        source: 'Revamp.io Case Study',
      },
      {
        type: 'statistic',
        content: '87% of our clients hit their 12-month MRR target',
        source: 'Scale Labs 2024 Cohort Data',
      },
    ],
    offerMechanics: {
      productName: 'SaaS Growth Sprint',
      price: '$8,000',
      guarantee: 'Milestone-based — you pay only when you hit 30% MRR growth',
      keyBenefits: ['Full GTM audit', 'ICP refinement', 'Outbound system build', 'Monthly board-level reporting'],
      cta: 'Schedule a growth audit at scalelabs.io',
    },
    portfolioSummary: 'Worked with 40+ early-stage B2B SaaS teams across North America and Europe.',
    referencePackPath: '',
  },
]
