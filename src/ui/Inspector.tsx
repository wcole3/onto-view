import { useState } from "react";

import { displayName, iriToCurie } from "../rdf/terms";
import { DEFAULT_PREFIXES } from "../rdf/vocab";
import {
  applyEdit,
  quadStore,
  setFilters,
  setLoadError,
  setSelectedIri,
  useAppStore,
} from "../model/store";
import {
  addRelation,
  deleteEntity,
  removeRelation,
  renameEntity,
  setComment,
  setLabel,
} from "../model/edits";
import { neighboursOf } from "../graph/subgraph";
import type { OntologyModel, Rel, RelKind } from "../model/types";
import { EditableField } from "./EditableField";
import { EntityPicker } from "./EntityPicker";
import { IconClose, IconFocus } from "./icons";

interface InspectorProps {
  model: OntologyModel;
}

/** Relationship kinds that can be added from the inspector. */
const ADDABLE: Array<{ kind: RelKind; title: string; picker: string }> = [
  { kind: "subClassOf", title: "Broader", picker: "Add a broader entity" },
  { kind: "domain", title: "Domain", picker: "Add a domain" },
  { kind: "range", title: "Range", picker: "Add a range" },
];

export function Inspector({ model }: InspectorProps) {
  const sources = useAppStore((state) => state.sources);
  const selectedIri = useAppStore((state) => state.selectedIri);
  const activeSourceId = useAppStore((state) => state.activeSourceId);
  const filters = useAppStore((state) => state.filters);
  const [renaming, setRenaming] = useState(false);

  const entity = selectedIri ? model.entities.get(selectedIri) : undefined;
  if (!entity) {
    return <p className="panel__empty">Select a node to see its details.</p>;
  }

  const prefixes = Object.assign(
    {},
    DEFAULT_PREFIXES,
    ...sources.map((source) => source.prefixes),
  ) as Record<string, string>;

  const { parents, children, related } = neighboursOf(model, entity.iri);
  const focused = filters.focusIri === entity.iri;
  const store = quadStore();

  /** Edits are refused rather than silently dropped when no source can hold them. */
  const guarded = (run: () => void) => {
    if (!activeSourceId) {
      setLoadError("No active source. Pick one in the Sources panel first.");
      return;
    }
    try {
      run();
    } catch (error) {
      setLoadError((error as Error).message);
    }
  };

  const name = (iri: string) => displayName(iri, model.entities.get(iri)?.label);

  /**
   * `kind` is passed only for lists whose statements have this entity as their
   * subject, since those are the ones this entity can add to or remove. A
   * narrower entity's subClassOf belongs to that entity, not this one.
   */
  const neighbourList = (
    title: string,
    rels: Rel[],
    end: (rel: Rel) => string,
    kind?: RelKind,
  ) => (
    <>
      <dt>{title}</dt>
      <dd>
        {rels.length > 0 ? (
          <ul className="neighbours">
            {dedupe(rels, end).map(([iri, kinds]) => (
              <li key={iri}>
                <button className="link" type="button" onClick={() => setSelectedIri(iri)}>
                  {name(iri)}
                </button>
                {kinds ? <span className="mono neighbours__kind">{kinds}</span> : null}
                {kind ? (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Remove ${kind} ${name(iri)}`}
                    onClick={() =>
                      guarded(() => applyEdit(removeRelation(store, entity.iri, iri, kind)))
                    }
                  >
                    <IconClose />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {kind ? (
          <EntityPicker
            model={model}
            exclude={entity.iri}
            label={ADDABLE.find((candidate) => candidate.kind === kind)!.picker}
            onPick={(iri) =>
              guarded(() => applyEdit(addRelation(entity.iri, iri, kind, activeSourceId!)))
            }
          />
        ) : null}
      </dd>
    </>
  );

  return (
    <>
      <dl className="details">
        <dt>Label</dt>
        <dd>
          <EditableField
            label="Label"
            value={entity.label ?? ""}
            placeholder={`No label · shown as ${displayName(entity.iri)}`}
            onCommit={(value) =>
              guarded(() => applyEdit(setLabel(store, entity.iri, value, activeSourceId!)))
            }
          />
        </dd>

        <dt>Comment</dt>
        <dd>
          <EditableField
            label="Comment"
            value={entity.comment ?? ""}
            placeholder="No comment"
            multiline
            onCommit={(value) =>
              guarded(() => applyEdit(setComment(store, entity.iri, value, activeSourceId!)))
            }
          />
        </dd>

        <dt>IRI</dt>
        <dd>
          {renaming ? (
            <EditableField
              label="Entity IRI"
              value={entity.iri}
              placeholder="Absolute IRI"
              onCommit={(value) => {
                setRenaming(false);
                guarded(() => {
                  applyEdit(renameEntity(store, entity.iri, value));
                  setSelectedIri(value);
                });
              }}
            />
          ) : (
            <span className="details__row">
              <span className="mono details__iri">{entity.iri}</span>
              <button className="link" type="button" onClick={() => setRenaming(true)}>
                Rename
              </button>
            </span>
          )}
        </dd>

        <dt>Compact</dt>
        <dd className="mono">{iriToCurie(entity.iri, prefixes)}</dd>

        <dt>Declared in</dt>
        <dd>
          {entity.declaredIn.length === 0 ? (
            <span className="panel__empty">
              Referenced but not declared in anything loaded. Its own ontology is
              probably imported rather than open.
            </span>
          ) : (
            <span className="chips">
              {entity.declaredIn.map((id) => {
                const source = sources.find((candidate) => candidate.id === id);
                return (
                  <span className="chip" key={id}>
                    <span
                      className="sources__swatch"
                      style={{ background: source?.color }}
                      aria-hidden
                    />
                    {source?.name ?? id}
                  </span>
                );
              })}
            </span>
          )}
        </dd>

        {neighbourList("Broader", parents, (rel) => rel.to, "subClassOf")}
        {children.length > 0
          ? neighbourList("Narrower", children, (rel) => rel.from)
          : null}
        {related.length > 0
          ? neighbourList("Related", related, (rel) =>
              rel.from === entity.iri ? rel.to : rel.from,
            )
          : null}
      </dl>

      <div className="inspector__actions">
        <button
          className={`button${focused ? "" : " button--primary"}`}
          type="button"
          onClick={() =>
            setFilters({ focusIri: focused ? null : entity.iri, search: "", rootDepth: null })
          }
        >
          <IconFocus />
          {focused ? "Clear focus" : "Focus on this"}
        </button>

        <button
          className="button button--danger"
          type="button"
          onClick={() => {
            const edit = deleteEntity(store, entity.iri);
            if (
              !window.confirm(
                `Delete ${displayName(entity.iri, entity.label)} and ${edit.remove.length} statements about it? This can be undone.`,
              )
            ) {
              return;
            }
            applyEdit(edit);
            setSelectedIri(null);
          }}
        >
          Delete entity
        </button>
      </div>
    </>
  );
}

/**
 * One row per neighbour, listing the relationships that connect it. The same
 * pair can be joined by several axioms, and a list of duplicate names would
 * read as a bug.
 */
function dedupe(rels: Rel[], end: (rel: Rel) => string): Array<[string, string]> {
  const kinds = new Map<string, Set<string>>();
  for (const rel of rels) {
    const iri = end(rel);
    let set = kinds.get(iri);
    if (!set) kinds.set(iri, (set = new Set()));
    set.add(rel.kind);
  }
  return [...kinds].map(([iri, set]) => [
    iri,
    [...set].filter((kind) => kind !== "subClassOf" && kind !== "subPropertyOf").join(" "),
  ]);
}
