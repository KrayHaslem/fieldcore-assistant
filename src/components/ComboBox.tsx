import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface ComboBoxOption {
  id: string;
  label: string;
  [key: string]: unknown;
}

interface ComboBoxProps<T extends ComboBoxOption> {
  value: T | null;
  onChange: (value: T | null) => void;
  onSearch: (query: string) => Promise<T[]>;
  onCreateNew?: (query: string) => void;
  allowCreate?: boolean;
  createLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  renderOption?: (option: T) => ReactNode;
}

export function ComboBox<T extends ComboBoxOption>({
  value,
  onChange,
  onSearch,
  onCreateNew,
  allowCreate = false,
  createLabel = "Create new",
  placeholder = "Search...",
  disabled = false,
  renderOption,
}: ComboBoxProps<T>) {
  const [inputValue, setInputValue] = useState(value?.label || "");
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setInputValue(value?.label || "");
  }, [value]);

  const handleBlurLogic = useCallback(() => {
    setIsOpen(false);
    if (!inputValue.trim()) {
      if (value) setInputValue(value.label);
      return;
    }
    if (value && inputValue.trim().toLowerCase() === value.label.toLowerCase()) return;
    // If typed something that doesn't match selection, try to find exact match
    const exactMatch = options.find(
      (o) => o.label.toLowerCase() === inputValue.trim().toLowerCase()
    );
    if (exactMatch) {
      onChange(exactMatch);
    } else if (value) {
      setInputValue(value.label);
    } else {
      setInputValue("");
    }
  }, [inputValue, value, options, onChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleBlurLogic();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleBlurLogic]);

  const doSearch = useCallback(
    async (query: string) => {
      setIsLoading(true);
      try {
        const results = await onSearch(query);
        setOptions(results);
        setHighlightedIndex(-1);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = (option: T) => {
    onChange(option);
    setInputValue(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = options.length + (allowCreate && inputValue.trim() ? 1 : 0);
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        doSearch(inputValue);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleSelect(options[highlightedIndex]);
        } else if (
          allowCreate &&
          inputValue.trim() &&
          highlightedIndex === options.length
        ) {
          onCreateNew?.(inputValue.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        handleBlurLogic();
        break;
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    doSearch(inputValue);
  };

  const showCreate = allowCreate && inputValue.trim() && !options.some(
    (o) => o.label.toLowerCase() === inputValue.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {value && inputValue && !disabled && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
          onClick={() => {
            onChange(null);
            setInputValue("");
            inputRef.current?.focus();
          }}
        >
          ×
        </button>
      )}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
          )}
          {!isLoading && options.length === 0 && !showCreate && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {inputValue.trim() ? `No results for "${inputValue.trim()}"` : "No results found"}
            </div>
          )}
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                index === highlightedIndex
                  ? "bg-accent/10 text-accent-foreground"
                  : "hover:bg-muted"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm border-t transition-colors text-primary font-medium",
                highlightedIndex === options.length
                  ? "bg-primary/10"
                  : "hover:bg-muted"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onCreateNew?.(inputValue.trim())}
              onMouseEnter={() => setHighlightedIndex(options.length)}
            >
              + {createLabel}: "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
