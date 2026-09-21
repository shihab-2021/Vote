import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string;
  dirty: boolean;
  onCommit: (newValue: string) => void;
}

export function EditableCell({ value, dirty, onCommit }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full min-w-[100px] rounded border border-primary bg-background px-1.5 py-0.5 text-xs outline-none"
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn(
        "min-w-[80px] cursor-text truncate rounded px-1.5 py-0.5 text-xs hover:bg-accent",
        dirty && "ring-2 ring-amber-500"
      )}
      title={value}
    >
      {value || <span className="text-muted-foreground">—</span>}
    </div>
  );
}
