import { useId, useState } from "react";

import { displayName } from "../rdf/terms";
import type { OntologyModel } from "../model/types";

interface EntityPickerProps {
  model: OntologyModel;
  exclude: string;
  label: string;
  onPick: (iri: string) => void;
}

/**
 * Picks an existing entity by label or IRI, or accepts a typed IRI for one that
 * does not exist yet. A plain datalist rather than a custom combobox: the
 * browser's own type-ahead handles a few thousand options without help, and it
 * stays keyboard-accessible for free.
 */
export function EntityPicker({ model, exclude, label, onPick }: EntityPickerProps) {
  const listId = useId();
  const [value, setValue] = useState("");

  const options = [...model.entities.values()]
    .filter((entity) => entity.iri !== exclude)
    .slice(0, 2000);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Accept either an IRI or a label that matches exactly one entity.
    const byLabel = options.find(
      (entity) => displayName(entity.iri, entity.label).toLowerCase() === trimmed.toLowerCase(),
    );
    onPick(byLabel?.iri ?? trimmed);
    setValue("");
  };

  return (
    <div className="picker">
      <input
        className="input"
        type="text"
        list={listId}
        aria-label={label}
        placeholder="Label or IRI"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
      />
      <datalist id={listId}>
        {options.map((entity) => (
          <option key={entity.iri} value={displayName(entity.iri, entity.label)}>
            {entity.iri}
          </option>
        ))}
      </datalist>
      <button className="button" type="button" onClick={submit} disabled={!value.trim()}>
        Add
      </button>
    </div>
  );
}
