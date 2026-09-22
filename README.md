# onto-view

A browser-only viewer and editor for RDF and OWL ontologies. Load one or more
files, explore them as an interactive graph, edit the common things, and
download the result. There is no server and no build step beyond Vite — the
whole thing is a static bundle.

## Status

Under active rewrite. What works today:

- [x] Tool shell, design tokens, Cytoscape renderer with four layouts
- [ ] Load Turtle, N-Triples, JSON-LD and RDF/XML files
- [ ] Multiple sources with per-source colours and visibility toggles
- [ ] Export to Turtle, N-Triples and JSON-LD
- [ ] Entity inspector
- [ ] Editing: classes, properties, labels, comments, `subClassOf`, domain/range
- [ ] Autosave and best-effort RDF/XML export

The graph currently shown is a fixed fragment of the BFO continuant hierarchy,
there to exercise the renderer until file loading lands.

## Quick start

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Other scripts: `bun run build`, `bun run preview`, `bun run test`,
`bun run lint`, `bun run typecheck`.

## Planned format support

| Format | Read | Write |
|---|---|---|
| Turtle | planned | planned |
| N-Triples / N-Quads | planned | planned |
| TriG | planned | planned |
| JSON-LD (local `@context`) | planned | planned |
| JSON-LD (remote `@context`) | fetched if CORS allows | — |
| RDF/XML | planned | best-effort only |
| OWL in any of the above | planned | as above |

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
