# Security

## Reporting vulnerabilities

Report security issues privately to the repository maintainer (wcole) via
GitHub private vulnerability reporting or direct email. Do not open public
issues for vulnerabilities.

## Main threat areas

This application processes untrusted structured files. The main threat areas
are:

- **Untrusted uploads** — parsed content must never be executed or served as
  executable HTML.
- **XML entities** — RDF/XML and XML catalogs are parsed with protections
  against entity expansion; `DOCTYPE` declarations are rejected in uploaded
  RDF/XML.
- **Remote JSON-LD contexts** — JSON-LD documents that reference remote
  contexts are rejected by default.
- **SSRF through imports** — network import resolution (disabled by default)
  restricts schemes to HTTP/HTTPS, rejects credentials and private/loopback
  addresses, revalidates every redirect, and applies host allowlists, byte
  limits, and timeouts.
- **Path traversal** — uploaded filenames are sanitized; stored files live
  under generated IDs; all path joins are confined to the data directory.
- **Zip bombs** — archives are not accepted in version 1; if added later they
  must enforce compression-ratio limits.
- **Expensive graph queries** — node, edge, depth, and evidence limits are
  enforced server-side regardless of client requests.

## Network imports are disabled by default

`ONTOVIEW_NETWORK_IMPORTS_ENABLED` defaults to `false`. Import resolution uses
already-loaded sources, explicit IRI-to-file mappings, XML catalogs, and local
import roots only. Enabling network imports requires a security review.

## Arbitrary file:// imports are rejected

Local import resolution only searches configured import roots. Clients cannot
request arbitrary filesystem paths through the API.

## Upload and graph limits

Configurable limits (see `.env.example`) bound per-file upload size, total
workspace size, source counts, import depth and count, returned graph nodes
and edges, and embedded evidence entries. Limits are enforced while streaming
uploads, not after the fact.

## Supported release policy

Only the latest released version receives security fixes. Development builds
are unsupported.

## No unrestricted SPARQL

Version 1 does not expose a SPARQL endpoint. Querying is limited to the
controlled graph-projection and entity-statement endpoints with server-side
limits.
