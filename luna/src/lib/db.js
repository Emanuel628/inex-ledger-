import { buildApiUrl } from "./api";

const SYNC_STORAGE_KEY = "luna_sync_mode";
const defaultStore = new Map();

export const initDB = async () => {
  if (typeof window === "undefined") return;
  if (!window.indexedDB) {
    console.warn("IndexedDB unavailable, local vault will use memory-only store.");
    return;
  }
  // Placeholder: real IndexedDB implementation can be wired here.
};

export const localDB = {
  vault: {
    put: async (data) => {
      if (!data || typeof data !== "object") return;
      const key = data.id || `${SYNC_STORAGE_KEY}-${Date.now()}`;
      defaultStore.set(key, { ...data, updatedAt: new Date().toISOString() });
      return Promise.resolve();
    },
  },
};

export const clearCloudSync = async () => {
  if (typeof window === "undefined") return;
  try {
      await fetch(buildApiUrl("/api/user/purge-vault"), { method: "POST" });
  } catch (error) {
    console.warn("Cloud vault purge request failed", error);
  }
};
