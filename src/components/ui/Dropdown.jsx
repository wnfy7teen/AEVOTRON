import { useEffect, useId, useRef, useState } from "react";

export function Dropdown({ value, onChange, options = [], disabled = false, id, className = "", "aria-label": ariaLabel, name }) {
  const generatedId = useId();
  const menuId = id ? `${id}-menu` : `av-dropdown-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  const selectedIndex = Math.max(0, normalized.findIndex((option) => String(option.value) === String(value)));
  const selected = normalized[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onWindowKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onWindowKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const enabledIndexes = normalized.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
  const move = (direction) => {
    if (!enabledIndexes.length) return;
    const current = enabledIndexes.indexOf(activeIndex);
    const next = current < 0 ? 0 : (current + direction + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[next]);
  };
  const choose = (option) => {
    if (option.disabled) return;
    onChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const openAt = (index = selectedIndex) => {
    const firstEnabled = enabledIndexes[0] ?? 0;
    setActiveIndex(normalized[index] && !normalized[index].disabled ? index : firstEnabled);
    setOpen(true);
  };
  const onTriggerKeyDown = (event) => {
    if (disabled) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) openAt(event.key === "ArrowUp" ? enabledIndexes.at(-1) : selectedIndex);
      else move(event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };
  const onMenuKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? (enabledIndexes[0] ?? 0) : (enabledIndexes.at(-1) ?? 0));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (normalized[activeIndex]) choose(normalized[activeIndex]);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const nextQuery = (typeaheadRef.current + event.key).toLocaleLowerCase();
      typeaheadRef.current = nextQuery;
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 650);
      const start = Math.max(0, enabledIndexes.indexOf(activeIndex));
      const ordered = [...enabledIndexes.slice(start), ...enabledIndexes.slice(0, start)];
      const match = ordered.find((index) => String(normalized[index].label).toLocaleLowerCase().startsWith(nextQuery));
      if (match !== undefined) {
        event.preventDefault();
        setActiveIndex(match);
      }
    }
  };

  return (
    <div ref={rootRef} className={`av-dropdown ${className}`} data-open={open ? "true" : "false"}>
      <button ref={triggerRef} id={id ? `${id}-trigger` : undefined} type="button" name={name} className="av-dropdown-trigger"
        aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId}
        disabled={disabled} onClick={() => open ? setOpen(false) : openAt()}
        onKeyDown={onTriggerKeyDown}>
        <span className="av-dropdown-value">{selected?.label ?? String(value ?? "Select an option")}</span>
        <svg className="av-dropdown-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>
      </button>
      {open && <div id={menuId} className="av-dropdown-menu" role="listbox" aria-label={ariaLabel || "Options"} onKeyDown={onMenuKeyDown}>
        {normalized.map((option, index) => <button key={String(option.value)} ref={(node) => { optionRefs.current[index] = node; }}
          type="button" role="option" aria-selected={String(option.value) === String(value)}
          disabled={option.disabled} tabIndex={-1} className={`av-dropdown-option ${String(option.value) === String(value) ? "is-selected" : ""} ${activeIndex === index ? "is-active" : ""}`}
          onMouseEnter={() => !option.disabled && setActiveIndex(index)} onClick={() => choose(option)}>
          <span>{option.label}</span>{String(option.value) === String(value) && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.5"/></svg>}
        </button>)}
      </div>}
    </div>
  );
}
