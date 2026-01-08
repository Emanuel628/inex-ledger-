## Ticket B: Predictive Pillars — UI Rendering

**Goal:** Surface the predictions inside ScoreDetails under a “Where You’re Headed” section without leaking raw math.  
**Deliverables:**  
- Render pillar cards with name, direction badge, strength label, and confidence tone (High/Medium/Low) using the `prediction` object.  
- Show supportive copy per direction/confidence, no numbers, and the optional CTA when direction = softening & confidence ≥ medium.  
- Include fallback copy (“Not enough stability yet”) when `prediction` is null or confidence low.  
- Ensure layout remains responsive and accessible; reuse existing ScoreDetails patterns.
