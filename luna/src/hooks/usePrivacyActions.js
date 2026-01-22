import { storageFacade } from "../storage/storageFacade";
import { buildApiUrl } from "../lib/api";

const clearIndexedDB = async () => {
  if (typeof window === "undefined" || !window.indexedDB) return;
  if (typeof indexedDB.databases === "function") {
    try {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs.map((db) => {
          if (!db.name) return Promise.resolve();
          return new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(db.name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          });
        })
      );
    } catch (error) {
      console.warn("Unable to enumerate IndexedDB databases", error);
    }
  }
};

const notifyBackend = async (path) => {
  const url = buildApiUrl(path);
  try {
    await fetch(url, { method: "DELETE" });
  } catch (error) {
    console.error(`Failed to call ${url}`, error);
  }
};

export const usePrivacyActions = () => {
  const nuclearWipe = async () => {
    if (typeof window !== "undefined") {
      storageFacade.clearVaultOnly();
      await clearIndexedDB();
    }

    await notifyBackend("/api/user/purge");
    await notifyBackend("/api/user/delete-everything");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("lunaLoggedIn");
      window.sessionStorage.removeItem("lunaLoggedIn");
      window.dispatchEvent(new Event("auth-updated"));
      window.dispatchEvent(new Event("identity-updated"));
      window.location.href = "/login";
    }
  };

  return { nuclearWipe };
};
