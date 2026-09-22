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

## Note on scope

This document originally continued for another ~480 lines, specifying a Python/FastAPI
backend, a REST API, a 14-kind visual node model, a striped/segmented provenance grammar,
Oxigraph, MessagePack, and a SPARQL console. None of it was built, and that scope was
abandoned in favour of a single static browser app. Those sections are in git history
(`b278fc0`) if the reasoning is ever wanted.

What survives above is the part that still guides the implementation: the format research
and the CCO display defaults.
