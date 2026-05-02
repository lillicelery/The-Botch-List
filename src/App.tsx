import { Route, Routes } from "react-router-dom";
import Compare from "./pages/Compare";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ClaimBusiness from "./pages/ClaimBusiness";
import ClaimVerified from "./pages/ClaimVerified";
import ForgotPassword from "./pages/ForgotPassword";
import ProviderDashboard from "./pages/ProviderDashboard";
import ProviderPortal from "./pages/ProviderPortal";
import ResetPassword from "./pages/ResetPassword";
import SavedProviders from "./pages/SavedProviders";
import SearchResults from "./pages/SearchResults";
import CompareBar from "./components/CompareBar";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/saved" element={<SavedProviders />} />
        <Route path="/provider/:slug" element={<ProviderDashboard />} />
        <Route path="/claim/:slug" element={<ClaimBusiness />} />
        <Route path="/claim-verified" element={<ClaimVerified />} />
        <Route path="/provider-portal/:slug" element={<ProviderPortal />} />
      </Routes>
      <CompareBar />
    </>
  );
}
