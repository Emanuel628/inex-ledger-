# Notification Store

`notificationStore.ts` lives in `src/lib` and mirrors the `payPeriodPlannerStore` pattern for persisting a history of meaningful alerts.

## Key exports

| Function | Purpose |
| --- | --- |
| `addNotification(input)` | Normalize + persist a new notification; pushes it to the top of the list and recomputes the unread-count metadata. |
| `acknowledgeNotification(id)` | Marks a notification acknowledged, stamps the time, and updates the store without mutating the previous objects. |
| `getNotificationStore()` | Reads the current store, returning `notifications`, `unreadCount`, and `latestUnreadId`. |
| `getUnreadNotifications()` | Convenience filter for rendering unread summaries. |
| `onNotificationStoreUpdate(listener)` | Subscribe to updates for UI wiring (bell, drawer, etc.). |

## Storage contract

The store is kept under the `notificationStore` key via `storageManager`. Each write pushes an immutable snapshot including `_version` metadata, so any consumer can safely call `getNotificationStore()` and stay in sync by listening for the `notification-store-updated` event.

Use `addNotification` when pay-period plans, tier changes, or other significant events complete. Let the UI surface those notifications (bell indicator + briefing) and call `acknowledgeNotification` when the user taps the “I understand” action.

## Notification manager

`notificationManager.ts` wraps the store helpers and provides human-ready defaults for:

- `notifyPayPeriodPlanReady(plan)` (type `PAY_PERIOD_PLAN`)
- `notifyTierChange(previousTier, newTier)` (type `TIER_CHANGE`)
- `notifyDriftAlert(magnitude, context)` (type `DRIFT_ALERT`)
- `notifyMajorEvent(context)` (type `MAJOR_EVENT`)

Wire these helpers into the lifecycle you already have for plans and tiers so the bell never fires unless something meaningful happens.
