import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface UseComboboxProps<T> {
  value: string; // The active selected value (either string name or _id)
  options: T[];
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => string;
  onChange: (value: string) => void;
  propagateQueryOnChange?: boolean; // Set true for text-based fields (Company/City combobox)
}

export function useCombobox<T>({
  value,
  options,
  getOptionLabel,
  getOptionValue,
  onChange,
  propagateQueryOnChange = false,
}: UseComboboxProps<T>) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display query with selected option when value or options change
  const selectedOption = useMemo(() => {
    return options.find((o) => getOptionValue(o) === value);
  }, [options, value, getOptionValue]);

  useEffect(() => {
    if (selectedOption) {
      setQuery(getOptionLabel(selectedOption));
    } else if (!value) {
      setQuery('');
    } else if (propagateQueryOnChange) {
      // In text-based combo, value itself is the query
      setQuery(value);
    }
  }, [selectedOption, value, getOptionLabel, propagateQueryOnChange]);

  // Click outside detection
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIdx(-1);
        // Reset query to active selection name on blur
        if (selectedOption) {
          setQuery(getOptionLabel(selectedOption));
        } else if (propagateQueryOnChange) {
          setQuery(value);
        } else {
          setQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, value, getOptionLabel, propagateQueryOnChange]);

  // Filter options based on input
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => getOptionLabel(o).toLowerCase().includes(q));
  }, [query, options, getOptionLabel]);

  const selectOption = useCallback((option: T) => {
    const val = getOptionValue(option);
    onChange(val);
    setQuery(getOptionLabel(option));
    setIsOpen(false);
    setActiveIdx(-1);
  }, [onChange, getOptionLabel, getOptionValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setActiveIdx(-1);
    if (propagateQueryOnChange) {
      onChange(val);
    }
  }, [onChange, propagateQueryOnChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) {
        selectOption(filtered[activeIdx]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIdx(-1);
    }
  }, [isOpen, filtered, activeIdx, selectOption]);

  return {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    activeIdx,
    setActiveIdx,
    filtered,
    containerRef,
    selectOption,
    handleInputChange,
    handleKeyDown,
  };
}
