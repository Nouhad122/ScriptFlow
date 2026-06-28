/**
 * ClientContext is the single source of truth for everything about a client.
 * It maps directly to the Reference Pack provided in the assessment.
 *
 * Every agent that needs client data receives a ClientContext — never raw strings.
 * This prevents agents from having to know where client data is stored.
 */

export interface Avatar {
  name: string;
  pains: string[];
  desires: string[];
}

export interface BrandVoice {
  tone: string;
  speakingStyle: string;
  doNotUse: string[];
  referenceExamples: string[];
}

export interface ProofPoint {
  type: 'result' | 'testimonial' | 'statistic' | 'case_study';
  content: string;
  source: string;
}

export interface OfferMechanics {
  productName: string;
  price: string;
  guarantee: string;
  keyBenefits: string[];
  cta: string;
}

export interface ClientContext {
  id: string;
  name: string;
  niche: string;
  avatars: Avatar[];
  brandVoice: BrandVoice;
  proofBank: ProofPoint[];
  offerMechanics: OfferMechanics;
  portfolioSummary: string;
  referencePackPath: string;
}
