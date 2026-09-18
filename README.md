# Ontology Viewer

A browser-based viewer for RDF, OWL, and LinkML ontologies. Upload one or more
ontology files, and explore them as interactive graphs with full provenance:
every node and edge shows which source document and logical ontology declares
or asserts it.

## Features

- Load RDF/XML, Turtle, N-Triples, N-Quads, TriG, and safe JSON-LD
- Load LinkML schemas (YAML and JSON)
- Multiple simultaneous sources with distinct colors and provenance
- Four views: raw RDF, OWL semantic, LinkML schema, ontology overview
- Shared IRIs merge into one node that records all contributing sources
- Cross-ontology references are highlighted
- Controlled import resolution (already-loaded, explicit mappings, XML
  catalogs, local roots; network disabled by default)
- CCO (Common Core Ontologies) display profile
- WebGL rendering (Sigma.js) with layouts run in Web Workers

## Supported formats

| Input | Version 1 support |
|---|---|
| RDF/XML | Yes |
| Turtle | Yes |
| N-Triples | Yes |
| N-Quads | Yes |
| TriG | Yes |
| JSON-LD with local contexts | Yes |
| JSON-LD requiring remote contexts | Rejected by default |
| OWL encoded in any supported RDF format | Yes |
| LinkML YAML / JSON | Yes |
| OWL Functional Syntax | No (future adapter) |
| Manchester OWL Syntax | No (future adapter) |
| OBO format | No (future adapter) |

## Limitations (version 1)

- The OWL semantic view recognizes common structures (classes, properties,
  subclass/equivalent/disjoint axioms, domain/range, inverse properties,
  restrictions, imports). It is not a reasoner: no inferred closure, no
  consistency checking. Unrecognized structures remain visible in the raw RDF
  view.
- One backend process; parsed data is held in memory and re-parsed lazily
  after a restart.
- Remote import fetching is disabled by default.
- Node, edge, upload, and import limits are configurable and enforced.
- No unrestricted SPARQL endpoint.

## Screenshot

_TODO: add screenshot once the renderer is complete._

## Quick start with Docker

```sh
make docker-up
```

Then open <http://localhost:8080>. Workspace data persists in the `onto-data`
volume. Stop with `make docker-down`.

## Local development

Requires Python 3.11+ and Node.js 24+.

### Backend

```sh
make install-backend   # creates .venv and installs backend[dev]
make dev-backend       # serves http://localhost:8000 (API docs at /docs)
make test-backend      # pytest
make lint-backend      # ruff + mypy
```

### Frontend

```sh
make install-frontend  # npm ci (locked install)
make dev-frontend      # Vite dev server on http://localhost:5173
make test-frontend     # Vitest
make lint-frontend     # ESLint + tsc
```

The Vite dev server proxies `/api` to `http://localhost:8000`, so run both
development servers together.

### Common make commands

Run `make help` for the full list, including `test`, `lint`, `format`, `e2e`,
`docker-up`, `docker-down`, `generate-large`, and `cco-smoke`.

## Architecture summary

A Python/FastAPI backend parses RDF (RDFLib) and LinkML (LinkML Runtime)
sources, preserves each original file and its provenance, and projects both
models into a shared visualization graph served as JSON. A React/TypeScript
frontend renders that graph with Graphology + Sigma.js (WebGL), runs layouts in
Web Workers, and provides source/ontology filtering, search, and a details
panel with raw statements. Parsing, semantic projection, provenance, and
rendering remain separate layers.

See [docs/](docs/) for the research notes and the detailed implementation plan:

- [Research and recommended design](docs/ontology-viewer.md)
- [Detailed implementation plan](docs/ontology-viewer-impl-plan.md)

## Security warnings about network imports

Network import resolution is **disabled by default**. Enabling it
(`ONTOVIEW_NETWORK_IMPORTS_ENABLED=true`) requires a configured host allowlist
and has been reviewed for SSRF risks (private/loopback address rejection,
redirect revalidation, byte and timeout limits). Do not enable it without
reading [SECURITY.md](SECURITY.md).

## Tests

```sh
make test          # backend + frontend unit tests
make e2e           # Playwright end-to-end tests (requires running servers)
```

The CCO smoke test requires a local CCO checkout and is skipped unless
`CCO_PATH` is set:

```sh
CCO_PATH=/path/to/CommonCoreOntologies make cco-smoke
```

## License

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines. This
project is in early development; licensing terms will be finalized before the
first release.
