import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ProvidersDataProvider } from "./lib/ProvidersDataContext";
import { AuthProvider } from "./lib/auth";
import { initializeTheme } from "./lib/theme";

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProvidersDataProvider>
          <App />
        </ProvidersDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
