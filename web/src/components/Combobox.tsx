import React, { useRef, useEffect, useState, CSSProperties } from 'react';
import { useCombobox } from '../hooks/useCombobox';

interface Props<T> {
  /** Wired to the input's `id` so an external `<label htmlFor>` still associates correctly. */
  id?: string;
  /** Label rendered inside the component above the input. Omit when the parent form renders its own label. */
  label?: string;
  options: T[];
  /** Selected value — the string itself for free-text fields, or an option's _id for id-based fields. */
  value: string;
  onChange: (value: string) => void;
  getOptionLabel: (o: T) => string;
  getOptionValue: (o: T) => string;
  /**
   * Called when the user clicks "Add / Use" on an unmatched query.
   * Return the value (or new _id) to select.
   * For free-text fields pass `async q => q` to confirm the typed text.
   * For id-based fields POST to the backend and return the new _id.
   */
  onAdd?: (query: string) => Promise<string | undefined>;
  /** Label for the "add" row. Defaults to "Add". Use "Use" for free-text fields. */
  addingText?: string;
  placeholder?: string;
  required?: boolean;
  /** Highlights the input border red; error text is rendered by the parent. */
  error?: string;
  /** Push the typed query through onChange on every keystroke (free-text fields). */
  propagateQueryOnChange?: boolean;
}

export default function Combobox<T>({
  id,
  label,
  options,
  value,
  onChange,
  getOptionLabel,
  getOptionValue,
  onAdd,
  addingText = 'Add',
  placeholder = 'Search...',
  required = false,
  error,
  propagateQueryOnChange = false,
}: Props<T>) {
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  const {
    query,
    isOpen,
    setIsOpen,
    activeIdx,
    filtered,
    containerRef,
    selectOption,
    handleInputChange,
    handleKeyDown,
  } = useCombobox<T>({
    value,
    options,
    getOptionLabel,
    getOptionValue,
    onChange,
    propagateQueryOnChange,
  });

  const showAddOption = React.useMemo(() => {
    if (!onAdd || !query.trim()) return false;
    const q = query.trim().toLowerCase();
    return !options.some((o) => getOptionLabel(o).toLowerCase() === q);
  }, [query, options, onAdd, getOptionLabel]);

  const handleAddNew = async () => {
    if (!onAdd || !query.trim()) return;
    setIsOpen(false);
    const newValue = await onAdd(query.trim());
    if (newValue) onChange(newValue);
  };

  // Compute fixed-position coords so the dropdown escapes overflow:auto scroll containers
  // (e.g. the drawer body). Recalculates on scroll / resize while open.
  useEffect(() => {
    if (!isOpen || !inputWrapRef.current) return;

    const update = () => {
      if (!inputWrapRef.current) return;
      const rect = inputWrapRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  return (
    <div className="ftrack-field-group ftrack-searchable-select" ref={containerRef}>
      {label && (
        <label className="ftrack-label" htmlFor={id}>
          {label}{required && ' *'}
        </label>
      )}

      <div className="ftrack-searchable-input-wrap" ref={inputWrapRef}>
        <input
          id={id}
          type="text"
          className={`ftrack-input ftrack-searchable-input${error ? ' ftrack-input--error' : ''}`}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          required={required && !value}
          aria-invalid={!!error}
          autoComplete="off"
        />
        <span className="ftrack-searchable-chevron" aria-hidden="true">▾</span>
      </div>

      {isOpen && (
        <ul className="ftrack-searchable-dropdown" style={dropdownStyle}>
          {filtered.map((opt, idx) => {
            const optValue = getOptionValue(opt);
            return (
              <li
                key={optValue}
                className={`ftrack-searchable-option${optValue === value ? ' ftrack-searchable-option--selected' : ''}${idx === activeIdx ? ' ftrack-searchable-option--active' : ''}`}
                onClick={() => selectOption(opt)}
              >
                {getOptionLabel(opt)}
              </li>
            );
          })}

          {showAddOption && (
            <li
              className="ftrack-searchable-option ftrack-searchable-option--add"
              onClick={handleAddNew}
            >
              + {addingText} "{query.trim()}"
            </li>
          )}

          {filtered.length === 0 && !showAddOption && (
            <li className="ftrack-searchable-no-results">No matches found</li>
          )}
        </ul>
      )}
    </div>
  );
}
