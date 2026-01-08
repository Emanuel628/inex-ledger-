import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { SovereigntyProvider } from "./contexts/SovereigntyContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PreferencesProvider>
      <SovereigntyProvider>
        <App />
      </SovereigntyProvider>
    </PreferencesProvider>
  </StrictMode>
);
