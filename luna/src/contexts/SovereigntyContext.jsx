import React, { createContext, useContext, useEffect, useState } from "react";
import { initDB, clearCloudSync } from "../lib/db";

const SYNC_MODE_KEY = "luna_sync_mode";

export const SovereigntyContext = createContext({
  syncMode: "local",
  toggleSyncMode: () => {},
});

const getInitialMode = () => {
  if (typeof window === "undefined") return "local";
  return localStorage.getItem(SYNC_MODE_KEY) || "local";
};

export const SovereigntyProvider = ({ children }) => {
  const [syncMode, setSyncMode] = useState(getInitialMode);

  useEffect(() => {
    initDB();
  }, []);

  const toggleSyncMode = async () => {
    const nextMode = syncMode === "local" ? "cloud" : "local";
    if (nextMode === "local") {
      await clearCloudSync();
      console.info("Cloud Vault purged. Data now exists only on this device.");
    }
    localStorage.setItem(SYNC_MODE_KEY, nextMode);
    setSyncMode(nextMode);
  };

  return (
    <SovereigntyContext.Provider value={{ syncMode, toggleSyncMode }}>
      {children}
    </SovereigntyContext.Provider>
  );
};

export const useSovereignty = () => {
  const context = useContext(SovereigntyContext);
  if (!context) {
    throw new Error("useSovereignty must be used within a SovereigntyProvider");
  }
  return context;
};
