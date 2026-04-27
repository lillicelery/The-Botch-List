import { FormEvent } from "react";
import "./SearchBar.css";

export interface SearchBarProps {
  query: string;
  location: string;
  onQueryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  queryPlaceholder?: string;
  locationPlaceholder?: string;
  dataName?: string;
  dataNodeId?: string;
}

export default function SearchBar({
  query,
  location,
  onQueryChange,
  onLocationChange,
  onSubmit,
  queryPlaceholder = "Condition, procedure, clinic, or doctor name",
  locationPlaceholder = "City, state, or zip code",
  dataName = "Search Component",
  dataNodeId,
}: SearchBarProps) {
  return (
    <form
      className="search-bar-form"
      onSubmit={onSubmit}
      data-name={dataName}
      {...(dataNodeId ? { "data-node-id": dataNodeId } : {})}
    >
      <div className="search-bar-form__field">
        <span className="search-bar-form__icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          className="search-bar-form__input"
          placeholder={queryPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={queryPlaceholder}
        />
      </div>
      <div className="search-bar-form__divider" aria-hidden />
      <div className="search-bar-form__field">
        <span className="search-bar-form__icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9 8 14.5 8 14.5C8 14.5 12.5 9 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
        <input
          type="text"
          className="search-bar-form__input"
          placeholder={locationPlaceholder}
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          aria-label={locationPlaceholder}
        />
      </div>
      <button type="submit" className="search-bar-form__submit">
        Search
      </button>
    </form>
  );
}
