import { useCallback, useEffect, useState } from "react";

const ASSET_KEY = "assetProfile";

const defaultProfile = {
  assets: [],
};

const safeParseProfile = () => {
  if (typeof window === "undefined") return defaultProfile;
  try {
    const stored = localStorage.getItem(ASSET_KEY);
    if (!stored) return defaultProfile;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return defaultProfile;
    const assets = Array.isArray(parsed.assets) ? parsed.assets : [];
    return { assets };
  } catch (e) {
    return defaultProfile;
  }
};

export const useAssetProfile = () => {
  const [profile, setProfile] = useState(safeParseProfile);

  const refreshProfile = useCallback(() => {
    setProfile(safeParseProfile());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleStorage = (event) => {
      if (!event.key || event.key === ASSET_KEY) {
        refreshProfile();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("asset-updated", refreshProfile);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("asset-updated", refreshProfile);
    };
  }, [refreshProfile]);

  return { profile, refreshProfile };
};
