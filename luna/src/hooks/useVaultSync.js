import { useContext } from "react";
import { SovereigntyContext } from "../contexts/SovereigntyContext";
import { localDB } from "../lib/db";

export const useVaultSync = () => {
  const { syncMode } = useContext(SovereigntyContext);

  const saveToVault = async (data) => {
    try {
      await localDB.vault.put(data);
    } catch (error) {
      console.warn("Local vault save failed", error);
    }

    if (syncMode === "cloud") {
      try {
        await fetch("/api/vault/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
      } catch (error) {
        console.warn("Cloud vault sync failed", error);
      }
    }
  };

  return { saveToVault };
};
