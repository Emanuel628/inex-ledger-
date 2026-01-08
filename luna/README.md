# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## 🛡️ Security & Data Sovereignty
Luna is built on a “Verify, Don't Trust” architecture. We believe that since we don’t need to see your data to help you manage it, we shouldn’t have the technical ability to see it at all.

1. **Zero-Knowledge Vault (AES-256-GCM)**
   - Financial credentials and bank tokens are encrypted at the application layer before they ever touch our database.
   - We generate a unique Initialization Vector (IV) for every record so that even a full server-side compromise only yields undecipherable noise.

2. **Physical Vault Bond (WebAuthn / FIDO2)**
   - You can opt to tether your Luna profile to a physical USB security key (YubiKey) or device biometrics (Windows Hello/TouchID).
   - Once enabled, the local vault cannot be decrypted without that hardware signature—your “Financial Brain” stays in your pocket.

3. **The “Nuclear Option” (Atomic Purge)**
   - Clicking the “Nuclear Delete” button triggers an atomic SQL transaction that issues destructive `DELETE` statements across every table, cache layer, and session store.
   - Audit the purge logic yourself via the interactive API documentation at `/api-docs`.

4. **Privacy Shield (Context-Aware Blurring)**
   - This opt-in layer watches for window blur events. The moment you look away (Alt-Tab or switch apps), sensitive numbers blur instantly so no one can shoulder-surf.

### 🔍 API Transparency Portal
Luna is an “Open Box.” Swagger exposes the exact structure of our encryption, authentication, and purge endpoints. Visit `/api-docs` on your local instance to verify every claim.

### Handover Checklist
- **Smoke test**: Run `scripts/smoke-test-purge.js` to confirm the atomic purge empties the vault.
- **Deployment**: Lock down your production secrets, especially `WEBAUTHN_RP_ID` and `ENCRYPTION_KEY`.

Luna 1.0 is now officially "Fortress-Grade."
