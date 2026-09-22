import { displayName, iriToCurie } from "../rdf/terms";
import { DEFAULT_PREFIXES } from "../rdf/vocab";
import { setFilters, setSelectedIri, useAppStore } from "../model/store";
import { neighboursOf } from "../graph/subgraph";
import type { OntologyModel, Rel } from "../model/types";
import { IconFocus } from "./icons";

interface InspectorProps {
  model: OntologyModel;
}

export function Inspector({ model }: InspectorProps) {
  const sources = useAppStore((state) => state.sources);
  const selectedIri = useAppStore((state) => state.selectedIri);
  const filters = useAppStore((state) => state.filters);

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

  const name = (iri: string) =>
    displayName(iri, model.entities.get(iri)?.label);

  const link = (iri: string, label: string) => (
    <button className="link" type="button" onClick={() => setSelectedIri(iri)}>
      {label}
    </button>
  );

  const group = (title: string, rels: Rel[], end: (rel: Rel) => string) =>
    rels.length === 0 ? null : (
      <>
        <dt>{title}</dt>
        <dd>
          <ul className="neighbours">
            {dedupe(rels, end).map(([iri, kinds]) => (
              <li key={iri}>
                {link(iri, name(iri))}
                {kinds.length > 0 ? <span className="mono neighbours__kind">{kinds}</span> : null}
              </li>
            ))}
          </ul>
        </dd>
      </>
    );

  return (
    <>
      <dl className="details">
        <dt>Name</dt>
        <dd>{displayName(entity.iri, entity.label)}</dd>

        <dt>IRI</dt>
        <dd className="mono details__iri">{entity.iri}</dd>

        <dt>Compact</dt>
        <dd className="mono">{iriToCurie(entity.iri, prefixes)}</dd>

        {entity.comment ? (
          <>
            <dt>Comment</dt>
            <dd>{entity.comment}</dd>
          </>
        ) : null}

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

        {group("Broader", parents, (rel) => rel.to)}
        {group("Narrower", children, (rel) => rel.from)}
        {group("Related", related, (rel) => (rel.from === entity.iri ? rel.to : rel.from))}
      </dl>

      <button
        className={`button${focused ? "" : " button--primary"} inspector__focus`}
        type="button"
        onClick={() =>
          setFilters({ focusIri: focused ? null : entity.iri, search: "", rootDepth: null })
        }
      >
        <IconFocus />
        {focused ? "Clear focus" : "Focus on this"}
      </button>
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
