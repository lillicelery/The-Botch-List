import { Route, Routes } from "react-router-dom";
import Compare from "./pages/Compare";
import Landing from "./pages/Landing";
import ProviderDashboard from "./pages/ProviderDashboard";
import SearchResults from "./pages/SearchResults";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/provider/:slug" element={<ProviderDashboard />} />
    </Routes>
  );
}
