# Ontology Viewer: Research and Recommended Design

**Research snapshot: September 17, 2026**

## 1. Format research

### RDF

RDF’s underlying model is a directed, labeled graph:

- **Subject**: IRI or blank node
- **Predicate**: IRI
- **Object**: IRI, blank node, or literal
- An RDF dataset can also contain named graphs, effectively producing quads.

RDF may be serialized as RDF/XML, Turtle, N-Triples, N-Quads, TriG, or JSON-LD. Consequently, the viewer should normalize every RDF syntax into a common internal dataset rather than building visualization logic around a particular serialization. ([w3.org](https://www.w3.org/TR/rdf11-concepts/))

### OWL

OWL 2 is layered on RDF but adds ontology-level semantics, including:

- Classes and individuals
- Object, data, and annotation properties
- Subclass and equivalence axioms
- Domain and range axioms
- Disjointness
- Cardinality and value restrictions
- Property chains
- Inverse, transitive, symmetric, and functional properties
- Imports
- Anonymous class expressions represented using blank nodes and RDF lists

A raw RDF visualization can display every OWL triple, but it will often produce an unreadable network of blank nodes and list structures. A useful viewer therefore needs both a **raw triple view** and an **OWL-aware semantic view**. ([w3.org](https://www.w3.org/TR/owl2-overview/))

### LinkML

LinkML primarily represents structured schemas using elements such as:

- Classes
- Slots
- Types
- Enumerations
- Subsets
- Prefixes and URI mappings
- Inheritance through `is_a`
- Mixins
- Slot ranges, cardinalities, and constraints
- Schema imports

LinkML schemas are commonly written in YAML or JSON. LinkML also provides generators for RDF and OWL-related representations. ([linkml.io](https://linkml.io/linkml/))

### Important modeling conclusion

**LinkML should not be the canonical intermediate representation for arbitrary OWL.**

This is an architectural inference from the differences between the models: many OWL constructs—anonymous class expressions, unrestricted RDF graphs, property chains, punning, and arbitrary axioms—do not map cleanly or losslessly into a LinkML schema.

The application should instead:

1. Preserve RDF/OWL as a canonical RDF dataset.
2. Preserve LinkML schemas in their native schema model.
3. Convert both into a shared **visualization graph**.
4. Retain references back to the original triples or LinkML elements.

This prevents information loss while allowing OWL and LinkML content to appear in the same viewer.

## 2. Common Core Ontology considerations

The Common Core Ontologies, or CCO, are a modular ontology suite grounded in Basic Formal Ontology. The official project distributes the ontologies as OWL artifacts and maintains them as related modules. ([github.com](https://github.com/CommonCoreOntology/CommonCoreOntologies))

CCO makes several features especially important:

- Recursive `owl:imports` resolution
- Loading multiple ontology modules together
- Shared terms referenced from several source files
- BFO and relation-ontology dependencies
- Human-readable labels separated from opaque IRIs
- Distinguishing the ontology that declares a term from ontologies that reference it
- Filtering annotation axioms that would otherwise dominate the display

The CCO support should be a **configuration profile**, not a hard-coded parser. The viewer must continue to support arbitrary RDF and OWL.

Recommended CCO defaults:

- Prefer `rdfs:label` and `skos:prefLabel` for display names.
- Display compact IRIs using source prefix maps.
- Resolve local imports before attempting network retrieval.
- Support XML catalogs and explicit IRI-to-file mappings.
- Hide annotation assertions initially.
- Group nodes by declaring ontology.
- Highlight references crossing CCO modules, BFO, and external ontologies.

---

# 3. Recommended implementation

## Technology choice

I recommend a **Python backend with a TypeScript web frontend**.

| Component | Technology | Reason |
|---|---|---|
| API and ingestion | Python + FastAPI | Strong RDF and LinkML ecosystem |
| RDF parsing | RDFLib initially | Broad serialization support and mature APIs |
| Large RDF storage | Optional PyOxigraph | Faster native storage and SPARQL for larger datasets |
| LinkML parsing | `linkml-runtime` | Native LinkML schema loading and inspection |
| User interface | React + TypeScript | Maintainable interactive web UI |
| Graph data structure | Graphology | Efficient client-side graph model |
| Rendering | Sigma.js | WebGL-based graph rendering |
| Layout | Web Worker | Prevent layout calculation from freezing the UI |
| Persistence | SQLite metadata + Oxigraph dataset | Optional saved workspaces |

RDFLib provides the broad input compatibility needed for an initial implementation, while LinkML Runtime handles native LinkML structures. PyOxigraph can be introduced for larger datasets without changing the frontend graph model. ([rdflib.readthedocs.io](https://rdflib.readthedocs.io/en/stable/))

Sigma.js renders Graphology graphs using WebGL, making it a strong choice for thousands of visible nodes and relationships without creating one DOM element per entity. ([sigmajs.org](https://www.sigmajs.org/))

### Why not make it TypeScript-only?

A TypeScript-only implementation is possible, but format support is more fragmented, particularly for RDF/XML, OWL normalization, and LinkML schema semantics.

### Why not start with Rust?

Rust is attractive for parsing and graph processing, but Python currently provides the most direct integration between RDF/OWL and LinkML. Rust can later replace performance-sensitive ingestion or layout components through a native service or WebAssembly module.

---

# 4. Application architecture

```dot
digraph OntologyViewer {
    rankdir=LR;
    node [shape=box, style="rounded"];

    Upload [label="Files, URLs, or directories"];
    Detect [label="Format detection"];
    RDF [label="RDF/OWL parser\nRDFLib or Oxigraph"];
    LinkML [label="LinkML parser\nLinkML Runtime"];
    Imports [label="Import resolver\nLocal catalog / optional network"];
    Dataset [label="Canonical RDF dataset"];
    Schema [label="Native LinkML schema model"];
    Normalize [label="Semantic normalization"];
    Graph [label="Provenance-aware\nvisualization graph"];
    API [label="FastAPI graph API"];
    Client [label="Graphology client model"];
    Layout [label="Web Worker layouts"];
    Render [label="Sigma.js WebGL renderer"];
    Details [label="Raw triples and details panel"];

    Upload -> Detect;
    Detect -> RDF [label="RDF/OWL"];
    Detect -> LinkML [label="YAML/JSON LinkML"];
    RDF -> Imports;
    Imports -> Dataset;
    LinkML -> Schema;
    Dataset -> Normalize;
    Schema -> Normalize;
    Normalize -> Graph;
    Graph -> API;
    API -> Client;
    Client -> Layout;
    Layout -> Render;
    Client -> Details;
}
```

---

# 5. Internal graph model

Every visualization object needs explicit provenance.

```python
from typing import Any, Literal
from pydantic import BaseModel


class SourceReference(BaseModel):
    source_id: str
    source_name: str
    ontology_iri: str | None = None
    document_uri: str | None = None
    element_id: str | None = None
    triple_ids: list[str] = []


class VisualNode(BaseModel):
    id: str
    iri: str | None = None
    label: str
    kind: Literal[
        "ontology",
        "class",
        "individual",
        "object_property",
        "data_property",
        "annotation_property",
        "datatype",
        "restriction",
        "blank_node",
        "literal",
        "linkml_class",
        "linkml_slot",
        "linkml_enum",
        "linkml_type",
    ]
    source_ids: list[str]
    references: list[SourceReference]
    attributes: dict[str, Any] = {}
    declared_in: list[str] = []
    referenced_by: list[str] = []


class VisualEdge(BaseModel):
    id: str
    source: str
    target: str
    predicate: str
    label: str
    kind: str
    source_ids: list[str]
    references: list[SourceReference]
    inferred: bool = False
    cross_ontology: bool = False
    attributes: dict[str, Any] = {}
```

## Shared-IRI behavior

If several ontologies use the same IRI:

- Create one visual node.
- Attach all contributing `source_ids`.
- Record which source declares it.
- Record which sources merely reference it.
- Allow the user to expand the provenance list.
- Give multi-source nodes a striped, segmented, or ring-style appearance.

This is preferable to duplicating the entity, because duplication hides genuine cross-ontology connections.

---

# 6. Required view modes

## Raw RDF view

Displays:

- Every subject, predicate, and object
- Blank nodes
- Literals
- Named graphs
- RDF lists
- Reified axioms
- Source document provenance

This mode guarantees that arbitrary valid RDF can be rendered, even when no OWL-specific interpretation is available.

## OWL semantic view

Displays named ontology concepts and converts RDF encodings into readable constructs:

- `rdfs:subClassOf`
- `owl:equivalentClass`
- `owl:disjointWith`
- Property domain and range
- Inverse properties
- Individuals and class assertions
- OWL restrictions
- Imports
- Property characteristics
- Property chains

Anonymous restrictions should appear as compact intermediate nodes, for example:

```text
Vehicle
  └── subclass of
      └── restriction:
          property = has_part
          some values from = Engine
```

Users should be able to expand the restriction into its underlying RDF triples.

## LinkML schema view

Displays:

- Classes as primary nodes
- Slots as nodes or labeled edges
- `is_a` inheritance
- Mixins
- Slot ranges
- Enumerations and permissible values
- Types
- Class-to-slot ownership
- Schema imports

The UI should support two representations of slots:

1. **Edge mode:** a slot appears as a labeled relationship between its domain class and range.
2. **Node mode:** the slot appears as a first-class node with its own metadata.

## Ontology overview

A summarized graph with one node per ontology or LinkML schema:

- `owl:imports`
- LinkML imports
- Cross-ontology references
- Count of classes, properties, individuals, and axioms
- Namespace and prefix overlap

This view is especially useful when loading the CCO suite.

---

# 7. Source distinction and provenance

Each loaded source receives:

- Stable identifier
- User-selectable color
- Display name
- Document URI
- Ontology IRI
- Version IRI, when available
- Prefix map
- Import status

Recommended visual rules:

| Element | Source indication |
|---|---|
| Node declared by one source | Solid source color |
| Node declared or used by several sources | Segmented border or outer rings |
| Relationship from one source | Source-colored edge |
| Same relationship asserted by multiple sources | Wider edge with provenance badge |
| Cross-ontology reference | Dashed or highlighted edge |
| Inferred relationship | Dotted edge |
| Imported ontology | Muted background until explicitly expanded |
| Blank node | Small diamond |
| Literal | Rounded rectangle |
| OWL restriction | Hexagon |

Users should be able to isolate one source while keeping neighboring cross-source entities visible in a faded state.

---

# 8. Performance strategy

The renderer should not simply load all triples into one force-directed graph and enable every label.

## Backend

- Parse uploaded files concurrently where safe.
- Stream large RDF serializations when the parser supports it.
- Deduplicate IRIs and literals during ingestion.
- Store raw triples separately from the visualization projection.
- Generate graph projections on demand.
- Cache normalized restrictions and adjacency lists.
- Return compact JSON or MessagePack.
- Introduce PyOxigraph when datasets exceed comfortable in-memory RDFLib operation.

## Frontend

- Use WebGL rendering.
- Run layouts in a Web Worker.
- Batch graph updates instead of inserting one element at a time.
- Hide most labels until zoom or hover.
- Use viewport and zoom-level culling.
- Disable edges during active panning when necessary.
- Cache node positions between filters and sessions.
- Avoid React components for individual nodes and edges.
- Virtualize search results and property tables.

## Level of detail

The application should initially show:

- Named classes
- Named properties
- Important semantic relationships
- Cross-ontology relationships

It should initially collapse or hide:

- Annotation assertions
- Axiom metadata
- RDF collection plumbing
- Blank-node subgraphs
- Literal nodes
- Imported ontology internals

Users can expand those structures on demand. This is the most important measure for keeping complex OWL ontologies understandable.

## Layouts

Provide several layouts because no single layout works for every ontology:

- Hierarchical layout for subclass trees
- ForceAtlas2-style layout for general relationships
- Radial layout centered on a selected entity
- Ontology-grouped layout
- Fixed or previously cached positions
- Neighborhood-only layout for exploration

The benchmark suite should include graphs around:

- 1,000 nodes and 5,000 edges
- 5,000 nodes and 25,000 edges
- 10,000 nodes and 50,000 edges

These should be treated as engineering targets, not guaranteed limits.

---

# 9. Import handling

Import resolution needs explicit controls:

```text
Import resolution:
1. Already loaded ontology IRI
2. User-provided IRI-to-file mapping
3. Local XML catalog or catalog file
4. Directory search
5. Application cache
6. Optional network retrieval
```

Network imports should be disabled or restricted by default because they introduce:

- Unpredictable loading times
- Server-side request forgery risks
- Very large import closures
- Reproducibility problems
- Remote content changes

The UI should offer:

- No imports
- Direct imports only
- Recursive import closure
- Local-only resolution
- Network-enabled resolution
- Maximum depth and file count

---

# 10. Suggested repository structure

```text
ontology-viewer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── workspaces.py
│   │   │   ├── sources.py
│   │   │   ├── graph.py
│   │   │   └── entities.py
│   │   ├── ingestion/
│   │   │   ├── detect.py
│   │   │   ├── rdf_parser.py
│   │   │   ├── linkml_parser.py
│   │   │   └── imports.py
│   │   ├── normalization/
│   │   │   ├── rdf_projection.py
│   │   │   ├── owl_projection.py
│   │   │   ├── linkml_projection.py
│   │   │   └── provenance.py
│   │   ├── models/
│   │   │   ├── source.py
│   │   │   └── visual_graph.py
│   │   └── main.py
│   ├── tests/
│   │   ├── fixtures/
│   │   ├── test_rdf.py
│   │   ├── test_owl.py
│   │   ├── test_linkml.py
│   │   └── test_cco.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── graph/
│   │   │   ├── renderer.ts
│   │   │   ├── styles.ts
│   │   │   ├── projection.ts
│   │   │   └── layout.worker.ts
│   │   ├── components/
│   │   ├── state/
│   │   ├── api/
│   │   └── App.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

# 11. Initial API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/workspaces` | Create a visualization workspace |
| `POST` | `/api/workspaces/{id}/sources` | Upload RDF, OWL, or LinkML |
| `POST` | `/api/workspaces/{id}/imports/resolve` | Resolve imports |
| `GET` | `/api/workspaces/{id}/ontologies` | Get ontology-level overview |
| `GET` | `/api/workspaces/{id}/graph` | Retrieve a filtered graph projection |
| `GET` | `/api/workspaces/{id}/entities/{entity_id}` | Retrieve entity details and provenance |
| `GET` | `/api/workspaces/{id}/entities/{entity_id}/neighbors` | Expand a neighborhood |
| `GET` | `/api/workspaces/{id}/triples` | Query raw triples |
| `POST` | `/api/workspaces/{id}/query` | Execute a restricted SPARQL query |

Graph retrieval should accept parameters such as:

```text
view=raw|owl|linkml|ontologies
sources=cco-core,cco-agent,bfo
include_annotations=false
include_literals=false
include_blank_nodes=false
depth=2
root=<entity IRI>
limit=10000
```

---

# 12. Implementation sequence

## Phase 1: Functional MVP

- RDF/XML, Turtle, N-Triples, TriG, N-Quads, and JSON-LD loading
- LinkML YAML and JSON schema loading
- Multiple simultaneous sources
- Source colors and provenance
- Raw RDF view
- Basic OWL class/property view
- Search by label, IRI, and prefix
- Sigma.js visualization
- Details and raw-triples panel

## Phase 2: CCO and OWL support

- Recursive imports and local catalogs
- OWL restrictions
- Equivalent and disjoint classes
- Property characteristics
- CCO-oriented default filters
- Ontology overview graph
- Cross-ontology reference analysis
- Saved workspaces and layout caching

## Phase 3: Scale and advanced analysis

- Oxigraph-backed storage
- Incremental graph projection
- MessagePack transport
- Neighborhood and query-driven loading
- SPARQL console
- Optional inference layer
- PNG, SVG, JSON, and GraphML exports
- Performance regression benchmarks

## Recommended final direction

Build the application as a **Python/FastAPI ontology-processing service with a React, Graphology, and Sigma.js frontend**. Preserve RDF and LinkML independently, project them into a provenance-aware visualization model, and provide separate raw, OWL-semantic, LinkML, and ontology-overview modes.

This design directly addresses the two hardest requirements: **retaining arbitrary ontology information without lossy conversion** and **rendering large, multi-ontology graphs while clearly showing where every entity and relationship originated**.

**Sources**
- [www.w3.org](https://www.w3.org/TR/rdf11-concepts/)
- [www.w3.org](https://www.w3.org/TR/owl2-overview/)
- [linkml.io](https://linkml.io/linkml/)
- [github.com](https://github.com/CommonCoreOntology/CommonCoreOntologies)
- [rdflib.readthedocs.io](https://rdflib.readthedocs.io/en/stable/)
- [www.sigmajs.org](https://www.sigmajs.org/)