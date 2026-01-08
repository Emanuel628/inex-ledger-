import React from "react";
import { usePrivacyActions } from "../hooks/usePrivacyActions";
import TopRightControls from "../components/TopRightControls.jsx";
import "./Security.css";

const STATUS_CARDS = [
  {
    title: "Identity Isolation",
    state: "Dual silos",
    detail:
      "Billing identity (email + Stripe) lives in one silo while your encrypted financial vault lives in another. They connect only through an anonymous UUID.",
    icon: "link",
  },
  {
    title: "Cloud-Isolated Vault",
    state: "Encrypted + private",
    detail: "Your money profile is encrypted inside Luna’s vault silo. Only you hold the key to read it.",
    icon: "cloud",
  },
  {
    title: "Zero-Knowledge AI",
    state: "Score-only view",
    detail: "Luna’s AI sees verified snapshots, never your bank credentials or raw tokens.",
    icon: "shield",
  },
];

const SECURITY_DOCS = [
  {
    title: "Security & Privacy Manifest",
    description: "An executive-level story of identity isolation, encryption, and consent-first logging.",
    href: "/docs/security-manifest.md",
  },
  {
    title: "Data Contract",
    description: "A technical breakdown of every schema field, encryption expectation, and storage guarantee.",
    href: "/docs/data-contract.md",
  },
  {
    title: "Score Integrity Notes",
    description: "Why the five-pillar score is local-first and how verified activity fuels Luna’s intelligence.",
    href: "/docs/score-readme.md",
  },
  {
    title: "Swagger API Docs",
    description: "Live interactive documentation for every auth, purge, and hardware key endpoint.",
    href: "/api-docs",
  },
];

const Security = () => {
  const { nuclearWipe } = usePrivacyActions();
  const handleNavigate = (target) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("luna-navigate", { detail: { view: target } }));
  };
  const handleNuclearClick = () => {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(
      "Delete everything? This clears local data and wipes the encrypted vault from the cloud."
    );
    if (confirmed) {
      nuclearWipe();
    }
  };

  return (
    <main className="security-page">
      <section className="security-hero">
        <p className="eyebrow">Luna 1.0</p>
        <div className="security-hero-menu">
          <TopRightControls activePage="security" onNavigate={handleNavigate} />
        </div>
        <h1>Security &amp; Privacy</h1>
        <p className="subtitle">
          The Gatekeeper, Health Brain, and AI chat work because you stay in control. This live scorecard
          shows exactly how Luna protects your data.
        </p>
      </section>

      <section className="manifest-section">
      <p className="manifest-lede">
        Identity Isolation: Your billing identity (email + Stripe) and your encrypted financial vault live in
        two separate silos. They only share a blind UUID so no one can correlate your name with your spending.
      </p>
      <div className="manifest-diagram">
        <div className="diagram-box">
          <strong>Identity silo</strong>
          <p>Email, billing, Stripe IDs</p>
        </div>
        <div className="diagram-connector">
          <span>Blind UUID</span>
        </div>
        <div className="diagram-box">
          <strong>Vault silo</strong>
          <p>Encrypted financial profile</p>
        </div>
      </div>
      <p className="manifest-lede">
        Only you hold the key that decrypts the vault—Luna cannot read it, and Stripe sees no direct match to your spending.
      </p>
      </section>

      <section className="privacy-score">
        <div className="privacy-score-header">
          <h2>Data sovereignty</h2>
          <p>
            Cloud-Isolated: Your money profile stays inside an encrypted vault silo that only you can unlock.
          </p>
        </div>
        <div className="security-status-grid">
          {STATUS_CARDS.map((card) => (
            <article key={card.title} className="security-status-card">
              <div className="status-icon" aria-hidden="true">
                {card.icon}
              </div>
              <div className="status-content">
                <h3>{card.title}</h3>
                <p className="status-state">{card.state}</p>
                <p className="status-detail">{card.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="security-features">
        <h2>Fortress-grade controls</h2>
        <p>
          The layers you enabled—privacy shield, WebAuthn hardware keys, and transparent docs—are all reflected below.
          Security shouldn’t feel scary; it should feel calm, steady, and under your control.
        </p>
        <div className="security-feature-grid">
          <article className="feature-chip">
            <h3>Privacy Shield</h3>
            <p>Automatically blurs sensitive numbers whenever someone might be looking over your shoulder.</p>
            <span className="feature-pill">Opt-in</span>
          </article>
          <article className="feature-chip">
            <h3>Hardware Vault</h3>
            <p>FIDO2/WebAuthn keys guard the vault and require a physical touch before decrypting snapshots.</p>
            <span className="feature-pill">Luna Pro</span>
          </article>
          <article className="feature-chip">
            <h3>Swagger Transparency</h3>
            <p>The API docs expose your purge, hardware registration, and auth flows for auditors.</p>
            <span className="feature-pill">/api-docs</span>
          </article>
          <article className="feature-chip">
            <h3>Consent-first Logging</h3>
            <p>Every nuclear purge emits `[PURGE_EVENT]` and `[PURGE_COMPLETE]` logs so regulators can verify destruction.</p>
            <span className="feature-pill">Full audit trail</span>
          </article>
        </div>
      </section>

      <section className="security-docs">
        <h2>Proof &amp; policies</h2>
        <p>Every assertion on this page is backed by living documentation you can visit at any time.</p>
      <div className="security-doc-grid">
        {SECURITY_DOCS.map((doc) => (
          <a
            key={doc.title}
            className="security-doc-card"
            href={doc.href}
            target="_blank"
            rel="noreferrer"
          >
            <h3>{doc.title}</h3>
            <p>{doc.description}</p>
            <span className="doc-link-label">View document</span>
          </a>
        ))}
      </div>
      <p className="compliance-note">
        Luna delivers modeling insights with traceable docs; it is not providing individualized financial
        advice.
      </p>
      <section className="integrity-report">
        <h2>System Integrity Report</h2>
        <div className="integrity-grid">
          <article>
            <div className="integrity-key">Data Source</div>
            <p>Luna Financial OS (Encrypted Vault). Every export is derived straight from the encrypted snapshot.</p>
          </article>
          <article>
            <div className="integrity-key">Silo Isolation</div>
            <p>This export carries only B-Silo (Business) ledger entries; personal PII and spending remain cryptographically filtered.</p>
          </article>
          <article>
            <div className="integrity-key">Integrity Hash</div>
            <p>A SHA-256 fingerprint is recorded so auditors can verify the file has not been altered since export.</p>
          </article>
          <article>
            <div className="integrity-key">Compliance Note</div>
            <p>Generated via Luna’s deterministic classification logic to support, not replace, professional tax preparation.</p>
          </article>
        </div>
        <p className="helper-note">
          Every export is logged with an [EXPORT_EVENT] and tied to your consent-first audit trail so you can trace what left the vault and when.
        </p>
      </section>
    </section>

      <section className="security-nuclear">
        <h2>Right to be Forgotten</h2>
        <p>
          Tap the button below to wipe every trace of your Luna data locally and on the backend. This
          cannot be undone, so we ask you to confirm that you really want to start over.
        </p>
        <button type="button" className="nuclear-btn" onClick={handleNuclearClick}>
          Nuclear option: Delete my data
        </button>
      </section>
    </main>
  );
};

export default Security;

