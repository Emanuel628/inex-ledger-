import React, { useEffect, useMemo, useState } from "react";
import { storageManager } from "../utils/storageManager";
import { buildKey } from "../utils/userStorage";
import "./SyncStatus.css";

const STATUS_LABELS = {
  localOnly: "Standalone Mode",
  syncing: "Pushing changes",
  synced: "Cloud synced",
  collision: "New data available",
};

const STATUS_CLASSES = {
  localOnly: "local-only",
  syncing: "syncing",
  synced: "synced",
  collision: "collision",
};

const formatTimestamp = (value) => {
  if (!value) return "No timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return `Updated ${parsed.toLocaleTimeString()}`;
};

const SyncStatus = () => {
  const [status, setStatus] = useState(storageManager.getState());
  const [lastSync, setLastSync] = useState(
    storageManager.get(buildKey("moneyProfile"))?._lastUpdated
  );
  const [hasCollision, setHasCollision] = useState(false);

  const label = useMemo(() => STATUS_LABELS[status] || "Unknown", [status]);

  useEffect(() => {
    const refresh = () => {
      setStatus(storageManager.getState());
      setLastSync(storageManager.get(buildKey("moneyProfile"))?._lastUpdated);
    };

    const collisionHandler = () => {
      setHasCollision(true);
      setStatus("collision");
    };

    const unsubscribe = storageManager.onStateChange(() => {
      refresh();
      setHasCollision(false);
    });

    window.addEventListener("storage-collision", collisionHandler);
    window.addEventListener("profile-updated", refresh);
    window.addEventListener("live-budget-updated", refresh);

    return () => {
      unsubscribe();
      window.removeEventListener("storage-collision", collisionHandler);
      window.removeEventListener("profile-updated", refresh);
      window.removeEventListener("live-budget-updated", refresh);
    };
  }, []);

  if (status === "localOnly") return null;

  return (
    <div className={`sync-widget ${STATUS_CLASSES[status] || ""}`}>
      <div className="status-indicator">
        {status === "syncing" && <span className="spinner" aria-hidden="true" />}
        <span className="dot" />
        <span className="label-text">{label}</span>
      </div>
      <div className="last-sync">{formatTimestamp(lastSync)}</div>
      {hasCollision && (
        <button
          type="button"
          className="sync-rebase"
          onClick={() => window.location.reload()}
        >
          Merge Updates
        </button>
      )}
    </div>
  );
};

export default SyncStatus;
