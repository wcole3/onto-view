import { useState } from "react";

import { createEntity } from "../model/edits";
import { applyEdit, quadStore, setLoadError, setSelectedIri, useAppStore } from "../model/store";
import type { EntityKind } from "../model/types";
import { IconPlus } from "./icons";

const KINDS: EntityKind[] = [
  "Class",
  "ObjectProperty",
  "DatatypeProperty",
  "AnnotationProperty",
  "Individual",
];

/**
 * Declares a new entity in the active source.
 *
 * The IRI is prefilled from the active source's own namespace when it has one,
 * because typing a full IRI by hand is the most tedious part of adding a term.
 */
export function NewEntity() {
  const sources = useAppStore((state) => state.sources);
  const activeSourceId = useAppStore((state) => state.activeSourceId);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EntityKind>("Class");
  const [label, setLabel] = useState("");
  const [iri, setIri] = useState("");

  const active = sources.find((source) => source.id === activeSourceId);
  if (!active) return null;

  const namespace = guessNamespace(active.prefixes);

  const submit = () => {
    try {
      const full = iri.trim() || `${namespace}${toLocalName(label)}`;
      applyEdit(createEntity(quadStore(), full, kind, label, active.id));
      setSelectedIri(full);
      setLabel("");
      setIri("");
      setOpen(false);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  };

  if (!open) {
    return (
      <button className="button" type="button" onClick={() => setOpen(true)}>
        <IconPlus />
        New entity
      </button>
    );
  }

  return (
    <div className="checks checks--export">
      <span className="panel__title">New entity in {active.name}</span>

      <label className="field field--stacked">
        <span className="field__label">Kind</span>
        <select
          className="button"
          aria-label="Entity kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as EntityKind)}
        >
          {KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="field field--stacked">
        <span className="field__label">Label</span>
        <input
          className="input"
          type="text"
          value={label}
          placeholder="Stuffed crust"
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </label>

      <label className="field field--stacked">
        <span className="field__label">IRI</span>
        <input
          className="input mono"
          type="text"
          value={iri}
          placeholder={namespace ? `${namespace}${toLocalName(label) || "Term"}` : "Absolute IRI"}
          onChange={(event) => setIri(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </label>

      <button
        className="button button--primary"
        type="button"
        onClick={submit}
        disabled={!label.trim() && !iri.trim()}
      >
        Create
      </button>
      <button className="button" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

/**
 * The namespace a document's own terms live in. The empty prefix is the usual
 * convention for it; otherwise take the longest declared namespace, which is
 * almost always the document's own rather than an imported vocabulary.
 */
function guessNamespace(prefixes: Record<string, string>): string {
  if (prefixes[""]) return prefixes[""];
  const own = Object.entries(prefixes)
    .filter(([, namespace]) => !namespace.includes("w3.org"))
    .sort((a, b) => b[1].length - a[1].length)[0];
  return own?.[1] ?? "";
}

/** CamelCase local name from a label, since IRIs cannot contain spaces. */
function toLocalName(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
