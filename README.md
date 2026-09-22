# onto-view

A browser-only viewer and editor for RDF and OWL ontologies. Load one or more
files, explore them as an interactive graph, edit the common things, and
download the result. There is no server and no build step beyond Vite — the
whole thing is a static bundle.

## Status

Feature-complete for a first version. What works:

- [x] Tool shell, design tokens, Cytoscape renderer with four layouts
- [x] Tree view of the hierarchy, over the same filtered subgraph as the graph
- [x] Load Turtle, N-Triples, N-Quads, TriG, RDF/XML and JSON-LD, by drop or picker
- [x] Multiple sources, each with its own colour and provenance state
- [x] Entity inspector: name, IRI, compact IRI, comment, declaring sources,
      broader/narrower/related neighbours as navigable links
- [x] Search, focus on a neighbourhood, depth limit from the hierarchy roots,
      kind filters, source visibility toggles
- [x] Export to Turtle, N-Triples, N-Quads and JSON-LD, per source or merged
- [x] Editing: create, rename and delete entities; edit labels and comments;
      add and remove `subClassOf`, `domain` and `range`; undo
- [x] Autosave to IndexedDB, restored on reload
- [x] Best-effort RDF/XML export

Tested against real ontologies, not only fixtures: BFO (158 KB RDF/XML, 1,221
triples) and the merged Common Core Ontologies (2 MB Turtle, 13,875 triples,
1,701 classes) both load in the browser with a clean console.

## Navigating something the size of CCO

Drawing 1,701 named classes at once produces texture, not structure, so the
visible subgraph is always narrowed by one of three scopes, and the app reports
which one is in force and how much it hid:

- **Search** — matches on label or IRI, plus one hop of context
- **Focus** — one entity and its neighbourhood, to a chosen number of hops
- **Levels** — the top N levels down from the hierarchy roots

On BFO plus CCO that is the difference between 3,589 elements and 413. Edge
predicate labels also disappear above 120 edges and come back on selection.

The **Graph / Tree** switch in the top bar changes only how that same subgraph
is drawn: the tree is an outline of the `subClassOf` and `subPropertyOf` edges
already on screen, so every filter applies to it unchanged. Branches are walked
lazily, which matters because the hierarchy is a DAG — a term with several
parents is listed under each of them.

## Quick start

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Other scripts: `bun run build`, `bun run preview`, `bun run test`,
`bun run lint`, `bun run typecheck`.

## Format support

| Format | Read | Write |
|---|---|---|
| Turtle | yes | yes |
| N-Triples / N-Quads | yes | yes |
| TriG | yes | read only |
| JSON-LD (local `@context`) | yes | yes |
| JSON-LD (remote `@context`) | fetched if CORS allows | — |
| RDF/XML | yes | best effort |
| OWL in any of the above | yes | as above |

Exports declare only the prefixes a document actually uses, and the provenance
graph term is dropped — except in N-Quads, where asking for the format is
asking to keep the graph column.

No RDF/XML serialiser exists for JavaScript, so the one here is hand-written.
It emits valid, reparseable XML in the striped `rdf:Description` form, but not
the compact idiomatic shape a dedicated tool produces, and a predicate whose
local part is not a valid XML name is reported rather than written. **Turtle is
the recommended export format.**

## How editing behaves

Two rules, applied consistently:

- **Additions** go into the active source, chosen in the Sources panel. Each
  source therefore stays independently exportable.
- **Removals and renames** act wherever the statements actually are, across
  every loaded source, and the app reports which ones it touched. A rename
  confined to one source would leave stale references in the others, and
  deleting a class while leaving the statements that point at it produces
  dangling references — both corrupt the graph rather than editing it.

Every edit is a pure function returning quads to add and remove, so undo is
just those two sets swapped.

## Deliberate non-goals

- No reasoner. No inferred closure, no consistency checking.
- No SPARQL endpoint.
- No `owl:imports` resolution over the network.
- No LinkML support. See [docs/ontology-viewer.md](docs/ontology-viewer.md) for
  why LinkML is a poor canonical representation for arbitrary OWL.
- Blank nodes are not drawn. They carry OWL class expressions and RDF list
  plumbing, which turn a node-link view into a hairball; the axioms that
  reference them stay visible, their anonymous interior does not.
- Named graphs inside a TriG or JSON-LD document are flattened into the file's
  source graph, because the graph term is used to carry provenance.

## Architecture in one paragraph

Quads live in a single `N3.Store` outside React. Every mutation bumps a
revision counter; React re-renders on that counter and rebuilds a derived
`OntologyModel` wholesale, which is cheap because the store is indexed. The
Cytoscape element list is derived from that model and then *diffed and patched*
into the renderer, because replacing elements outright would discard every node
position. Provenance is free: each quad's graph term is its source id, which
drives node colouring and the source toggles.

## Your work is saved in the browser

Edits autosave to IndexedDB shortly after they settle, and the session is
restored on reload — sources, colours, visibility and all. IndexedDB rather
than `localStorage`, which holds about 5 MB of UTF-16: CCO alone serialises to
roughly 2.4 MB of N-Quads and a second source would exceed the quota, and an
editor that loses work to a caught exception is worse than one that never
offered to save.

Nothing leaves the browser. "Discard saved copy" removes it.

## Tests

```sh
bun run test    # 98 unit tests
bun run e2e     # 17 end-to-end tests, against the production build
```

The end-to-end suite builds and serves the production bundle itself, because
several classes of failure appear only there: Node-shim resolution for the
streaming parsers, asset paths, and code-split chunk loading.

## Licence

Not yet chosen.
