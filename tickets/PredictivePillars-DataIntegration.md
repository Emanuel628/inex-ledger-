## Ticket A: Predictive Pillars — Data Integration

**Goal:** Hook `predictFinancialPillars.js` into the `financialHealthScore` pipeline so each snapshot stores a `prediction` object.  
**Deliverables:**  
- Extend the score runner to append `prediction` to `financialHealthScore` (cached per snapshot).  
- Pull the last 6 pillar snapshots, call `getPillarPredictions`, and store direction/confidence.  
- Enforce confidence gating (needs ≥4 pillar entries and stability); if gating fails, store `prediction: null`.  
- Recompute only when `financialHealthScore`, `moneyProfile`, or `debt` changes.
