# Security

## Reporting vulnerabilities

Report security issues privately to the repository maintainer (wcole) via
GitHub private vulnerability reporting or direct email. Do not open public
issues for vulnerabilities.

## Threat model

onto-view is a static client-side application. There is no server, no
database, no authentication and no user data leaving the browser except where
noted below. Files you load are parsed in the tab and never uploaded.

That removes most of the usual surface, and leaves these:

- **Untrusted input files.** Parsed RDF is treated strictly as data. Labels,
  comments and IRIs are rendered as text, never as markup, so a crafted
  ontology cannot inject script. Graph and element counts are bounded before
  rendering so a large file degrades into a warning rather than a hung tab.
- **XML entity expansion.** RDF/XML is parsed by
  `rdfxml-streaming-parser`, which does not process external entities. Do not
  replace it with a parser that resolves `DOCTYPE` declarations.
- **Remote JSON-LD contexts.** A JSON-LD file whose `@context` is a URL causes
  the parser to fetch that URL from the browser. This is subject to CORS and is
  surfaced as a parse warning when it fails. Treat it as the one outbound
  request the app can make on a file's behalf.
- **Browser storage.** Autosaved work is held in IndexedDB under the page's
  origin. It is not encrypted and is readable by anything else running on that
  origin. Do not load ontologies containing secrets.

## Not applicable

Earlier revisions of this document described SSRF protections, upload
sanitization, path-traversal defences, zip-bomb limits and server-side query
limits. Those described a backend service that no longer exists.

## No `owl:imports` resolution

Imports are not followed. An `owl:imports` triple is displayed as an edge and
nothing is fetched. If import resolution is ever added, it needs an explicit
security review first — a remote-fetching import resolver reintroduces the
entire SSRF surface.

## Supported release policy

Only the latest release receives fixes. Development builds are unsupported.
