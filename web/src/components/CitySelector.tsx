import { useMemo, useState } from 'react';

export interface CityOption {
  city: string;
  isBase?: boolean;  // current city — blue ring, always visible via parent filter
  isPref?: boolean;  // preferred city — accented border when not selected
}

interface CitySelectorProps {
  cities: CityOption[];
  selected: Set<string>;             // lowercase city keys
  onToggle: (city: string) => void;  // receives lowercase key
  onSelectAll?: () => void;          // shows "Select all" button when provided
  onClear: () => void;
  clearLabel?: string;               // default "Clear"
  showSearch?: boolean;              // default false
  totalCount?: number;               // shows "X / N selected" when provided
}

export default function CitySelector({
  cities,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  clearLabel = 'Clear',
  showSearch = false,
  totalCount,
}: CitySelectorProps) {
  const [search, setSearch] = useState('');

  const visibleCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? cities.filter((c) => c.city.toLowerCase().includes(q)) : cities;
  }, [cities, search]);

  const showToolbar = showSearch || onSelectAll !== undefined || totalCount !== undefined;

  return (
    <div className="cs-root">
      {showToolbar && (
        <div className="cs-toolbar">
          {showSearch && (
            <input
              className="cs-search"
              type="search"
              placeholder="Filter cities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter cities"
            />
          )}
          <div className="cs-actions">
            {onSelectAll && (
              <button className="cs-action-btn" type="button" onClick={onSelectAll}>
                Select all
              </button>
            )}
            <button className="cs-action-btn" type="button" onClick={onClear}>
              {clearLabel}
            </button>
            {totalCount !== undefined && (
              <span className="cs-count">{selected.size} / {totalCount} selected</span>
            )}
          </div>
        </div>
      )}
      <div className="cs-chips" role="group" aria-label="City selection">
        {visibleCities.map((c) => {
          const key      = c.city.toLowerCase();
          const isActive = selected.has(key);
          return (
            <button
              key={c.city}
              type="button"
              className={[
                'cs-chip',
                isActive                   ? 'cs-chip--active' : '',
                c.isBase                   ? 'cs-chip--base'   : '',
                c.isPref && !isActive      ? 'cs-chip--pref'   : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onToggle(key)}
              aria-pressed={isActive}
            >
              {c.city}
            </button>
          );
        })}
      </div>
    </div>
  );
}
