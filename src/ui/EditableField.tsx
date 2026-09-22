import { useEffect, useState } from "react";

interface EditableFieldProps {
  value: string;
  placeholder: string;
  /** Required: these fields sit in a definition list, which gives no label. */
  label: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}

/**
 * A text field that commits on blur or Enter and reverts on Escape.
 *
 * Committing per keystroke would push one undo entry per character, so the
 * local draft is held here and only handed to the store on commit.
 */
export function EditableField({
  value,
  placeholder,
  label,
  multiline,
  onCommit,
}: EditableFieldProps) {
  const [draft, setDraft] = useState(value);

  // Re-sync when a different entity is selected, or an undo changes the value.
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setDraft(value);
      (event.target as HTMLElement).blur();
    } else if (event.key === "Enter" && !multiline) {
      commit();
    }
  };

  const shared = {
    className: "input",
    value: draft,
    placeholder,
    "aria-label": label,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: commit,
    onKeyDown,
  };

  return multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type="text" />;
}
