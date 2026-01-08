# Luna Security & Privacy Manifest

Luna protects sovereignty with transparent controls and verifiable infrastructure:

- **Identity Isolation** – Billing identity (email, Stripe metadata) lives in its own silo and only shares a blind UUID with the encrypted financial vault.
- **Zero-Knowledge Storage** – Tokens and snapshots are encrypted with AES-256-GCM + unique IVs before ever touching the cloud.
- **Hardware Vault** – Luna Pro lets you pair a FIDO2/WebAuthn key or biometric device so the vault unlocks only after a physical touch.
- **Consent-first Logging** – Every `PURGE_EVENT` and `PURGE_COMPLETE` log proves the Delete button ran an atomic wipe of vault, identity, and Stripe data.
- **Transparency Portal** – `/api-docs` exposes the exact purge, hardware registration, and auth endpoints for auditors to inspect.
