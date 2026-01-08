## UI Ticket: Predictive Pillars (Forecast UX Integration)

**Goal**  
Surface predictive financial pillar trajectories so users can see where they are headed, not just where they are. This increases emotional engagement and coaching depth without overpromising precision.

### Placement  
**Primary Location** – Score Details  
- Add a new section titled **“Where You’re Headed”**  
- Subtext: “Based on your recent progress, here’s what your financial momentum looks like…”

Each pillar card should show:  
- Pillar name (Buffer / Stability / Freedom)  
- Direction badge (Improving / Softening / Flat)  
- Strength indicator (Gentle / Solid / Strong)  
- Confidence indicator (High 🌟 / Medium 🙂 / Low ⚠️ softly faded)  
- Forecast copy (supportive tone, no raw numbers, no guarantees)

Examples (tone focused):  
- **Improving:** “Trending upward. If you keep this pace, your cushion may feel noticeably stronger in about 3 periods.”  
- **Flat:** “Fairly steady right now. If things continue like this, your situation should feel about the same a few periods from now.”  
- **Softening:** “Progress looks like it may slow soon. Nothing is broken, but let’s keep an eye on this.”  
- **Low confidence:** “Luna needs a little more consistent data before I can predict this reliably.”

**Confidence copy** should read like:  
“Confidence: Medium — trends are visible, but not perfectly consistent yet.”

**Optional CTA** – only display when direction = softening AND confidence ≥ medium:  
“Want help staying on track?” → opens Money Coach with a targeted plan.

**Dashboard Mini Forecast Chip (Phase 2)**  
- Secondary chip under the score trend: “Forecast: Improving 💫” that links to Score Details.

### Behavior Rules  
- Requires at least 4 historical pillar snapshots with low volatility; otherwise show “not enough stability to predict yet.”  
- Auto-refresh when financialHealthScore, moneyProfile, or debt data updates (re-use existing storage listeners).  
- Cache predictions per snapshot to avoid recalculating on each render.

### Data Contract  
- Consume `predictFinancialPillars.js`’s `buildPredictionContext()` which returns:  
```
{
  buffer: { direction, strength, confidence, projected3, projected6 },
  stability: {...},
  freedom: {...}
}
```  
- Handle missing data gracefully (fallback messaging, disabled CTA).

### Acceptance Criteria  
- Section only shows when a valid score exists.  
- Presents safe messaging when history is unavailable or volatile.  
- Tone remains supportive, never technical.  
- Forecast copy matches the direction/confidence combination.  
- No raw projected values or dollar math surfaces.  
- ScoreDetails layout survives the addition without regression.  
- Predictions use cached snapshots to avoid re-render recompute.

### QA Checklist  
1. Add income entries → Buffer projection updates.  
2. Add debt payment → Freedom trajectory updates.  
3. Remove data → UI falls back to “Need more history.”  
4. Business transactions do not affect personal predictions.  
5. Increase volatility → confidence badge shifts to Low.
