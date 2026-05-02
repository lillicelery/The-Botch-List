import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import "./SaveButton.css";

interface SaveButtonProps {
  providerSlug: string;
}

export default function SaveButton({ providerSlug }: SaveButtonProps) {
  const { status, savedProviders, saveProvider, unsaveProvider } = useAuth();
  const navigate = useNavigate();
  const isSaved = savedProviders.includes(providerSlug);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "authenticated") {
      navigate("/auth");
      return;
    }
    if (isSaved) {
      unsaveProvider(providerSlug);
    } else {
      saveProvider(providerSlug);
    }
  }

  return (
    <button
      type="button"
      className={`save-btn${isSaved ? " save-btn--saved" : ""}`}
      onClick={handleClick}
      title={isSaved ? "Remove from saved" : "Save provider"}
      aria-label={isSaved ? "Remove from saved" : "Save provider"}
      aria-pressed={isSaved}
    >
      {isSaved ? "♥" : "♡"}
    </button>
  );
}
