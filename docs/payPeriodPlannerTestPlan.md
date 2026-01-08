# Pay Period Planner Test Matrix

## 1. Cadence Inference
| Scenario | Trigger | Expectation |
| --- | --- | --- |
| Weekly paychecks detected | Consistent 7-day spacing | `inferPaySchedule` returns `weekly` |
| Biweekly spacing | (~14 day gap) | schedule `biweekly` |
| Monthly cadence | ~30 day gap | schedule `monthly` |
| Erratic payments | Variable intervals | fallback `flex` without throwing |
| Single paycheck ever | First income recorded | returns `flex`, does not crash |
| Late paycheck | Income posted late in cycle | still returns closest cadence, does not regenerate twice |
| Changing cadence | Cadence shifts over time | detection updates without clearing history unexpectedly |

## 2. Tier Allocation Math
| Tier | Key Rules | Edge Cases |
| --- | --- | --- |
| Critical | Essentials equal expenses, buffer caps at ~$300, debt minimal, breathing room ≥$50 | Zero/negative leftover, extremely high leftover |
| Fragile | Buffer trend toward $500, debt weight moderate, breathing room ≥$75 | Over-saving should not starve essentials |
| Steady | Buffer targets $1k, debt weight higher, breathing room ≥$150 | High leftover should allocate proportionally |
| Thriving | Buffer raised to $1.5k+, debt weight high, breathing room ≥$250 | Maintain optimism messaging even when leftover is low |
| Negative leftover | Any tier | Buffer/debt/br-room should clamp at zero, plan remains calm |

## 3. Regeneration Logic
| Change | Condition | Expectation |
| --- | --- | --- |
| New income | New paycheck or transaction detected | `shouldRegeneratePlan` returns `true`, new plan persisted, previous plan marked `superseded` |
| Tier change | `currentStage` key changes | New plan persisted with tier-aware allocation |
| Manual refresh | Provided action triggered | Gate through `shouldRegeneratePlan` to avoid spamming plans |
| No meaningful change | Only minor expense calling rerun | `shouldRegeneratePlan` stays `false`, plan unchanged |
| Plan end passes | Period end date < now | `expirePlansIfNeeded` marks plan `expired` but keeps history |
| History preservation | Several plans generated | `plans[]` length increases; `latestPlanId` updated to newest |

## 4. Schema Safety
| Case | Expectation |
| --- | --- |
| Invalid data (missing fields, wrong types) | `PayPeriodPlanSchema.parse` throws and plan is rejected |
| Partial snapshot (missing income) | Schema still accepts optional fields, system falls back to `null` values without crashing |
| Currency preservation | All plans include `currency` value from preferences |
| Version bump | New plan version remains `1` until schema updates |

## Notes
- Tests should run against the exported planner functions (`inferPaySchedule`, `allocateRecommendation`, `shouldRegeneratePlan`) in isolation and through the `regeneratePlan` flow (via the new hook or controller) to ensure the trigger behavior matches the doc.  
- Once the trigger wiring is in place, add end-to-end coverage that simulates storage persistence (`payPeriodPlannerStore`) so `latestPlanId` and `plans[]` behave as expected across sessions.
