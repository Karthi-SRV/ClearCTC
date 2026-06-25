import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCities } from '../context/CitiesContext';

interface Props {
  id: string;
  value: string;
  onChange: (city: string) => void;
  error?: string;
  placeholder?: string;
}

export default function CityCombobox({
  id,
  value,
  onChange,
  error,
  placeholder = 'e.g. Bangalore',
}: Props) {
  const { cities } = useCities();

  const [query, setQuery]         = useState(value);
  const [open, setOpen]           = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Keep query in sync when value changes externally (e.g. auto-fill from profile)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cities.filter((c) => c.toLowerCase().includes(q)) : cities;
  }, [query, cities]);

  const select = useCallback((city: string) => {
    setQuery(city);
    onChange(city);
    setOpen(false);
    setActiveIdx(-1);
  }, [onChange]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setOpen(true);
    setActiveIdx(-1);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) select(filtered[activeIdx]);
      else setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, filtered, activeIdx, select]);


  return (
    <div
      className="city-combo"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-owns={`${id}-list`}
    >
      <div className="p1-form__input-wrap">
        <input
          id={id}
          className={`p1-form__input${error ? ' p1-form__input--error' : ''}`}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          aria-activedescendant={activeIdx >= 0 ? `${id}-opt-${activeIdx}` : undefined}
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
        />
        <span className="city-combo__chevron" aria-hidden="true">▾</span>
      </div>

      {open && filtered.length > 0 && (
        <ul
          id={`${id}-list`}
          className="city-combo__list"
          role="listbox"
          aria-label="Cities"
        >
          {filtered.map((city, i) => (
            <li
              key={city}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={city === value}
              className={[
                'city-combo__option',
                i === activeIdx ? 'city-combo__option--active' : '',
                city === value ? 'city-combo__option--selected' : '',
              ].filter(Boolean).join(' ')}
              onMouseDown={() => select(city)}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
