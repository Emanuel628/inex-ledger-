## Ticket C: Predictive Pillars — Guardrails & Safety

**Goal:** Keep Luna honest—no hallucinations, no overreach.  
**Deliverables:**  
- Define minimum data rules (≥4 pillar snapshots, limited volatility).  
- Add volatility detector that suppresses predictions when history is erratic.  
- Expire predictions if they become stale (e.g., score snapshot older than 30 days).  
- Ensure business transactions never feed the personal predictions.  
- Provide consistent fallback messaging when the guardrails fire.
