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
