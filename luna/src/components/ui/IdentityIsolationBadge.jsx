import React from "react";
import { Database, Link2Off, ShieldCheck } from "lucide-react";

export const IdentityIsolationBadge = () => {
  return (
    <section className="identity-badge identity-badge--calm">
      <div className="identity-badge__header">
        <ShieldCheck size={18} />
        <span>Dual-Silo security enabled</span>
      </div>
      <p className="identity-badge__description">
        Billing identity and your financial vault stay in separate encrypted silos connected only by an
        anonymous Blind UUID. Even Luna can’t match your name to your transaction history.
      </p>
      <div className="identity-badge__line">
        <div className="identity-badge__tag">
          <Database size={14} />
          <span>Identity silo</span>
        </div>
        <Link2Off size={14} />
        <div className="identity-badge__tag">
          <ShieldCheck size={14} />
          <span>Financial vault</span>
        </div>
      </div>
    </section>
  );
};
