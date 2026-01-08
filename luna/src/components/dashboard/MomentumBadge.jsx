import React from "react";
import { Crown, Shield, Zap, Target } from "lucide-react";

const LEVEL_CONFIG = {
  1: { label: "Standard", icon: Target },
  2: { label: "Sentry", icon: Zap },
  3: { label: "Guardian", icon: Shield },
  4: { label: "Fortress", icon: Crown },
};

export const MomentumBadge = ({ level = 1 }) => {
  const normalized = Math.min(Math.max(Number(level) || 1, 1), 4);
  const { label, icon: Icon } = LEVEL_CONFIG[normalized];

  return (
    <div className={`momentum-badge momentum-badge--level${normalized}`}>
      <Icon size={14} />
      <span>Level: {label}</span>
    </div>
  );
};
