# onto-view

A browser-only viewer and editor for RDF and OWL ontologies. Load one or more
files, explore them as an interactive graph, edit the common things, and
download the result. There is no server and no build step beyond Vite — the
whole thing is a static bundle.

## Status

Under active rewrite. What works today:

- [x] Tool shell, design tokens, Cytoscape renderer with four layouts
- [x] Load Turtle, N-Triples, N-Quads, TriG, RDF/XML and JSON-LD, by drop or picker
- [x] Multiple sources, each with its own colour and provenance state
- [x] Entity inspector: name, IRI, compact IRI, comment, declaring sources
- [ ] Source visibility toggles and export
- [ ] Search, hierarchy filters, layout tuning
- [ ] Editing: classes, properties, labels, comments, `subClassOf`, domain/range
- [ ] Autosave and best-effort RDF/XML export

Tested against real ontologies, not only fixtures: BFO (158 KB RDF/XML, 1,221
triples) and the merged Common Core Ontologies (2 MB Turtle, 13,875 triples,
1,701 classes) both load in the browser with a clean console.

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
| Turtle | yes | planned |
| N-Triples / N-Quads | yes | planned |
| TriG | yes | planned |
| JSON-LD (local `@context`) | yes | planned |
| JSON-LD (remote `@context`) | fetched if CORS allows | — |
| RDF/XML | yes | best-effort only |
| OWL in any of the above | yes | as above |

RDF/XML is read-only in practice: no RDF/XML serializer exists for JavaScript,
so writing it means a hand-rolled best-effort emitter that covers the striped
`rdf:Description` form and nothing more. **Turtle is the recommended export
format.**

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

## Licence

Not yet chosen.
