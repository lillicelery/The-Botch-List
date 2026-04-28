import { Route, Routes } from "react-router-dom";
import Compare from "./pages/Compare";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ProviderDashboard from "./pages/ProviderDashboard";
import ResetPassword from "./pages/ResetPassword";
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
        <Route path="/provider/:slug" element={<ProviderDashboard />} />
      </Routes>
      <CompareBar />
    </>
  );
}
