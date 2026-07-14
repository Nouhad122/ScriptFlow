/**
 * Calibration reference injected into the quality review prompt.
 *
 * WHY THIS EXISTS:
 *   Without concrete score anchors, the reviewing model drifts toward the 7–8 range
 *   regardless of actual quality — producing uniform scores and near-universal PASS.
 *   These examples pin what each score level actually looks like in the high-ticket
 *   coaching niche, and what fabrication failure looks like in practice.
 *
 *   The distribution note is intentionally absent: PASS/HOLD is determined by individual
 *   criterion thresholds, not by the overall score. Providing a "good scripts score X–Y"
 *   table would anchor per-criterion scores incorrectly.
 */

export const QUALITY_CALIBRATION = `
━━━ CALIBRATION REFERENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCORE SCALE FOR INDIVIDUAL CRITERIA (1–10):
  1–3:  Fundamental failure — the section is missing, incoherent, or completely wrong.
  4–5:  Real problem — the section exists but has an identifiable flaw worth calling out.
  6–7:  Competent — the section does what it needs to do. 6 is adequate; 7 is solid.
  8–9:  Strong — noticeably above average; hard to fault this section specifically.
  10:   Exceptional — reserve for genuinely outstanding examples; should be rare.

A well-written AI-generated script will score 6–8 on most criteria.
If all your scores are 9 or above, reconsider whether you have been rigorous enough.
If all your scores are 5 or below, reconsider whether you are being too harsh.

── hookStrength score anchors (pass threshold: 7 — higher than other criteria) ──

hookStrength requires a score of 7 or above to pass:true. A score of 6 is competent
but not scroll-stopping — the viewer can keep scrolling without feeling they're
missing something irreplaceable. Only a genuine pattern interrupt passes:
a reframe that challenges an assumption, a scene so specific the viewer
recognises themselves before they can scroll, or a claim that creates
immediate curiosity that cannot be deferred.

Score 2  (pass:false)
  "Are you working too hard in your business?"
  → Generic. No specificity. No emotional trigger. Could apply to anyone in any niche.

Score 5  (pass:false)
  "If you're a coach putting in 50-hour weeks and still not hitting consistent months, listen up."
  → Addresses the pain but no pattern interrupt. A viewer can keep scrolling without missing anything.

Score 6  (pass:false — does not clear the 7-threshold)
  "Most React developers never learn this, and it's costing them senior-level opportunities."
  → Identifies the audience and hints at value. But "never learn this" is a well-worn content
  formula. The curiosity is mild and deferrable — the viewer has seen this format before and
  can scroll without anxiety. Competent. Not compelling.

Score 7  (pass:true)
  "Most coaches think they need more clients to scale. They don't."
  → Counterintuitive claim creates immediate curiosity. Specific enough to feel targeted.
  The reframe is the hook — the viewer has to know what they actually need instead.

Score 9  (pass:true)
  "You've got a full calendar, your clients are getting results, and you're still making less than your 9-to-5 paid. That's not a client problem — that's a leverage problem."
  → The viewer recognises their exact situation immediately. The reframe lands before they can scroll.

── proofAccuracy examples — what fabrication looks like ───────

FAIL — modified timeframe:
  Proof bank: "Marcus went from $3K to $22K/month in 90 days"
  Script says: "Marcus went from $3K to $22K in 60 days"
  → The timeframe changed. This is fabrication. proofAccuracy: pass:false, score ≤ 5.

FAIL — specific claim not in proof bank:
  Proof bank: "helped dozens of coaches cross six figures"
  Script says: "23 coaches have crossed six figures using this system"
  → A specific number invented from a vague source. pass:false.

PASS — direct and accurate:
  Proof bank: "Sarah 3x'd her monthly revenue in one quarter"
  Script says: "One of our clients — Sarah — tripled her monthly revenue in a single quarter"
  → Meaning preserved exactly. Paraphrasing words is fine; changing substance is not.

── What a HOLD decision looks like ────────────────────────────

A script is held when ANY single criterion fails — not when most criteria fail.
"Good overall" does not override a single broken gate.

Example HOLD (fabrication gate):
  All scored criteria pass at 7+, but fabrication fails because the script
  cites "23 clients" when the proof bank only says "dozens of clients."
  → overallDecision: HOLD regardless of other scores.

Example HOLD (hookStrength gate):
  hookStrength scores 5 — the hook is too generic to stop a scroll.
  All other nine criteria pass.
  → overallDecision: HOLD. A weak hook means the script will not perform.
`;
