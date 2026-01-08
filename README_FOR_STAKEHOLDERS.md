## Luna 1.0: Privacy-First Financial Intelligence
Luna is built on the belief that financial clarity shouldn’t cost you your privacy. Every insight comes from verified truth, every calculation runs locally, and every sensitive field is encrypted before the cloud ever sees it. Whenever a user generates a compliance export (PDF or CSV), the confirmation statement is appended to their encrypted profile record with only the identity, date, and time—this audit trail stays private unless the owner explicitly exports or shares it.

### 1. Production Readiness Checklist
- **Schema audit:** Ensure `plaid_items`, `user_snapshots`, `user_snapshots_history`, and `transactions` exist in PostgreSQL, matching the purge controller’s SQL transaction.
- **Foreign keys:** Confirm `ON DELETE` behaviors don’t conflict with the manual `DELETE` statements; the controller explicitly removes vault items, snapshots, and transactions before resetting the user row.
- **Env review:** `DATABASE_URL` must point to your managed Postgres host, `ENCRYPTION_KEY` should be a unique 32-character string, and `NODE_ENV=production` enables secure cookies and logging defaults.

### 2. Core Value Props
**Local-First Logic**  
Most of the brain runs in the browser (Local Storage/IndexedDB). The backend exists to persist encrypted snapshots, not to ingest raw behavior.

**5-Pillar Score**  
Liquidity, Savings Rate, Debt-to-Income, Adherence, and Velocity are independent measurements. Together they form a stability model far deeper than a net worth figure.

**Verified Truth**  
The Reconciliation Explorer forces users to “verify” fuzzy transactions, so Luna works with clean data. The AI won’t advise unless a minimum number of verified points exist.

**Zero-Knowledge AI**  
Luna Chat injects only the health score context—never raw credentials—into prompt generation. The privacy nut icon explains this to every user.

**Total Sovereignty**  
The nuclear wipe runs a `BEGIN/COMMIT` on the backend to delete vault records, snapshots, and transactions, then clears local caches/indexedDB before redirecting to onboarding.

### 3. Architecture Summary
- **Encrypted snapshots:** AES-256-CBC scrambles data before it hits PostgreSQL. Docker Compose ensures the same environment from dev to production.
- **Hybrid flow:** Data lives locally; the cloud only stores encrypted backups and fires audited purge requests when users opt out.
- **Security posture:** Practices match regulated fintechs—TLS, vault encryption, zero-knowledge AI, and a documented nuclear option.

### 4. The Launch Hook
Luna isn’t just a budgeting app—it’s a Financial Concierge. Verified truth + zero-knowledge protection delivers what other tools can’t: certainty you can trust.

## Guidance intelligence notes
- _Phase-3 simulation_: Run `node scripts/simulateGuidance.js` to print simulated journeys (fragile build, fragile drift, balanced strength, thriving intentionality) and inspect how tier tone/title/body evolve across 30–90 day timelines.
- _Narrative variation_: Each GPS phase now blends a small pool of variant sentences keyed to buffer/rate/time so repeated renders stay emotionally fresh.
- _Contextual cues_: GPS guidance augments the body with contextual nudges whenever a pay period plan is active—nearby payday, closing period, or drift signals now generate gentle, emotionally aligned reminders so Luna feels situationally aware.
- _Phase-B completion_: Time-in-tier awareness plus milestone/transition narratives now feed the context layer; guidance mentions "settling in/pattern forming/identity forming" plus framed acknowledgments for first cushion months, returns to safety, and thriving stability instead of generic cheer.

## 🧠 Optional polish
If you’d like a celebratory toast for verified syncs or a shareable export, I can draft that component next. Let me know if you want the HUD moment.
