# Contributing

## Requirements

[Bun](https://bun.sh). Nothing else — there is no backend and no container.

## Setup

```sh
bun install
bun run dev
```

## Before opening a pull request

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

All four must pass. `bun run build` runs `tsc --noEmit` first, so a type error
fails the build rather than shipping.

Verify user-facing changes against the **production** build, not the dev
server:

```sh
bun run build && bun run preview
```

Some failures only appear there — Node-shim resolution for the streaming
parsers, and asset paths.

## Branch naming

`feature/<short-description>`, `fix/<short-description>` or
`docs/<short-description>`, off `main`.

## Pull request rules

- Keep pull requests small and focused on one behavior.
- New behavior requires tests. Unit tests colocate with the code they cover
  (`src/**/*.test.ts`).
- Anything that parses or serializes RDF needs a round-trip test: parse, edit,
  serialize, reparse, compare quad sets.
- Do not commit external ontology distributions (for example a full CCO
  checkout). Reference them by path or pinned release.
- Keep test fixtures small and hand-written.

## Design rules

`src/styles/tokens.css` is the only place a colour, space, radius, border width
or font stack is defined. `src/graph/style.ts` resolves the same custom
properties at runtime so the canvas and the DOM chrome cannot drift apart.

**No component should contain a literal hex value.** If you need a new colour,
add a token.

Two palettes exist and they are not interchangeable: the desaturated pastels
are for chrome semantics (errors, warnings, selection), while graph node fills
use a separate categorical palette chosen to stay distinguishable at small node
sizes.
