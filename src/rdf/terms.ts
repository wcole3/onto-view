import type * as RDF from "@rdfjs/types";

import { DEFAULT_PREFIXES } from "./vocab";

/**
 * The local part of an IRI: whatever follows the last `#` or `/`, or for a
 * CURIE, whatever follows the colon.
 *
 * The colon is only treated as a separator when the string contains no slash.
 * Otherwise a namespace IRI that ends in its separator, such as
 * `http://example.org/pizza#`, would fall through to the colon of the URI
 * scheme and yield `//example.org/pizza#`.
 */
export function localName(iri: string): string {
  const cut = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
  if (cut >= 0 && cut < iri.length - 1) return iri.slice(cut + 1);
  if (!iri.includes("/")) {
    const colon = iri.lastIndexOf(":");
    if (colon >= 0 && colon < iri.length - 1) return iri.slice(colon + 1);
  }
  return iri;
}

/**
 * Shortens an IRI to a CURIE using the longest matching prefix, or returns it
 * unchanged when nothing matches.
 */
export function iriToCurie(iri: string, prefixes: Record<string, string> = DEFAULT_PREFIXES): string {
  let bestPrefix = "";
  let bestNamespace = "";
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace) && namespace.length > bestNamespace.length) {
      bestPrefix = prefix;
      bestNamespace = namespace;
    }
  }
  if (!bestNamespace) return iri;
  return `${bestPrefix}:${iri.slice(bestNamespace.length)}`;
}

/**
 * The display name for an entity: an explicit label if one was asserted,
 * otherwise the local name, which is almost always more readable than the full
 * IRI and far more readable than an opaque OBO-style identifier's IRI.
 */
export function displayName(iri: string, label?: string): string {
  if (label && label.trim()) return label.trim();
  return localName(iri);
}

/** A stable key for a term, used for element ids and map lookups. */
export function termKey(term: RDF.Term): string {
  if (term.termType === "BlankNode") return `_:${term.value}`;
  if (term.termType === "Literal") {
    const language = term.language ? `@${term.language}` : "";
    const datatype = !term.language && term.datatype ? `^^${term.datatype.value}` : "";
    return `"${term.value}"${language}${datatype}`;
  }
  return term.value;
}

/**
 * Picks the best literal for a display field from a list of candidates,
 * preferring the configured languages in order, then a plain literal, then
 * whatever came first.
 */
export function pickLiteral(
  literals: RDF.Literal[],
  preferredLanguages: readonly string[] = ["en"],
): string | undefined {
  if (literals.length === 0) return undefined;
  for (const language of preferredLanguages) {
    const match = literals.find((literal) => literal.language === language);
    if (match) return match.value;
  }
  const plain = literals.find((literal) => !literal.language);
  return (plain ?? literals[0]).value;
}
