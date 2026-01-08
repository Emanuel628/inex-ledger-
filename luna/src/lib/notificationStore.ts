import { storageManager } from "../utils/storageManager";
import { buildKey } from "../utils/userStorage";

const NOTIFICATION_STORE_KEY = "notificationStore";
const NOTIFICATION_STORE_EVENT = "notification-store-updated";

export type NotificationType = "PAY_PERIOD_PLAN" | "TIER_CHANGE" | "DRIFT_ALERT" | "MAJOR_EVENT";
export type NotificationTone = "info" | "caution" | "positive" | "neutral";

export interface NotificationPayload {
  planId?: string;
  previousTier?: string;
  newTier?: string;
  driftMagnitude?: number;
  eventContext?: string;
  summaryLine?: string;
  supportiveLine?: string;
  tierAtCreation?: string;
  periodStart?: string;
  periodEnd?: string;
  projectedLeftover?: number;
  currency?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  payload?: NotificationPayload;
  acknowledged: boolean;
  acknowledgedAt?: string;
  tone?: NotificationTone;
}

export interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  payload?: NotificationPayload;
  id?: string;
  createdAt?: string;
  tone?: NotificationTone;
}

export interface NotificationStore {
  notifications: Notification[];
}

const ensureId = (value?: string): string => {
  if (value) return value;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `notification-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

const buildStore = (notifications: Notification[]): NotificationStore => ({
  notifications,
});

const readStore = (): NotificationStore => {
  const stored = storageManager.get(buildKey(NOTIFICATION_STORE_KEY));
  if (!stored || typeof stored !== "object") {
    return buildStore([]);
  }
  const notifications = Array.isArray((stored as NotificationStore).notifications)
    ? (stored as NotificationStore).notifications
    : [];
  return buildStore(notifications);
};

const dispatchStoreUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATION_STORE_EVENT));
};

const persistNotifications = (notifications: Notification[]): NotificationStore => {
  const store = buildStore(notifications);
  storageManager.set(buildKey(NOTIFICATION_STORE_KEY), store);
  dispatchStoreUpdate();
  return store;
};

const normalize = (input: NotificationInput): Notification => ({
  ...input,
  id: ensureId(input.id),
  createdAt: input.createdAt || new Date().toISOString(),
  acknowledged: false,
});

export const getNotificationStore = (): NotificationStore => readStore();

export const getNotifications = (): Notification[] => getNotificationStore().notifications;

export const getUnreadNotifications = (): Notification[] =>
  getNotificationStore().notifications.filter((notification) => !notification.acknowledged);

export const getUnreadCount = (): number => getUnreadNotifications().length;

export const createNotification = (input: NotificationInput): Notification => normalize(input);

export const addNotification = (input: NotificationInput): Notification => {
  const notification = normalize(input);
  const store = getNotificationStore();
  if (store.notifications.some((existing) => existing.id === notification.id)) {
    return store.notifications.find((existing) => existing.id === notification.id)!;
  }
  persistNotifications([notification, ...store.notifications]);
  return notification;
};

export const removeNotification = (id: string): Notification[] => {
  const store = getNotificationStore();
  const next = store.notifications.filter((notification) => notification.id !== id);
  if (next.length === store.notifications.length) {
    return store.notifications;
  }
  persistNotifications(next);
  return next;
};

export const acknowledgeNotification = (id: string): Notification | null => {
  const store = getNotificationStore();
  let updated: Notification | null = null;
  const next = store.notifications.map((notification) => {
    if (notification.id !== id || notification.acknowledged) {
      return notification;
    }
    updated = {
      ...notification,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    };
    return updated;
  });
  if (!updated) return null;
  persistNotifications(next);
  return updated;
};

export const onNotificationStoreUpdate = (listener: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATION_STORE_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATION_STORE_EVENT, listener);
};
