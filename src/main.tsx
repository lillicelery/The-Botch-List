import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ProvidersDataProvider } from "./lib/ProvidersDataContext";
import { AuthProvider } from "./lib/auth";
import { CompareSelectionProvider } from "./lib/CompareSelectionProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProvidersDataProvider>
          <CompareSelectionProvider>
            <App />
          </CompareSelectionProvider>
        </ProvidersDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
