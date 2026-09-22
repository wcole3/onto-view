import { DataFactory, Parser as N3Parser } from "n3";
import type * as RDF from "@rdfjs/types";

const { namedNode, quad: makeQuad } = DataFactory;

export type Format = "turtle" | "ntriples" | "nquads" | "trig" | "rdfxml" | "jsonld";

export interface ParseResult {
  quads: RDF.Quad[];
  prefixes: Record<string, string>;
  warnings: string[];
}

export const FORMAT_LABELS: Record<Format, string> = {
  turtle: "Turtle",
  ntriples: "N-Triples",
  nquads: "N-Quads",
  trig: "TriG",
  rdfxml: "RDF/XML",
  jsonld: "JSON-LD",
};

const EXTENSIONS: Record<string, Format> = {
  ttl: "turtle",
  turtle: "turtle",
  n3: "turtle",
  nt: "ntriples",
  ntriples: "ntriples",
  nq: "nquads",
  nquads: "nquads",
  trig: "trig",
  rdf: "rdfxml",
  owl: "rdfxml",
  xml: "rdfxml",
  rdfxml: "rdfxml",
  jsonld: "jsonld",
  json: "jsonld",
};

/**
 * Picks a format from the filename, falling back to the content. The extension
 * is trusted first because `.owl` is RDF/XML far more often than not, while the
 * content sniff only has to separate the obvious cases.
 */
export function sniffFormat(filename: string, text: string): Format {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const byExtension = EXTENSIONS[extension];
  if (byExtension) return byExtension;

  const head = text.slice(0, 2048).trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<rdf:RDF") || head.startsWith("<!--")) {
    return "rdfxml";
  }
  if (head.startsWith("{") || head.startsWith("[")) return "jsonld";
  if (/^@prefix|^@base|^PREFIX|^BASE/im.test(head)) return "turtle";
  if (/^\s*(GRAPH|\{)/im.test(head)) return "trig";
  return "turtle";
}

/** N3.js handles these four synchronously; no streams are involved. */
const N3_FORMATS: Partial<Record<Format, string>> = {
  turtle: "Turtle",
  ntriples: "N-Triples",
  nquads: "N-Quads",
  trig: "TriG",
};

/**
 * Parses one document into quads tagged with `sourceId` as their graph term.
 *
 * Provenance rides on the graph term throughout the application, so every
 * parser's output is re-wrapped here rather than relying on the one parser that
 * happens to accept a `defaultGraph` option. The cost is that named graphs
 * inside a TriG or JSON-LD `@graph` document are flattened into the file's
 * source graph, which is the right trade for an ontology editor.
 *
 * The RDF/XML and JSON-LD parsers are imported lazily so that their bundles,
 * and the Node stream shims they depend on, are never fetched by someone who
 * only opens Turtle files.
 */
export async function parseDocument(
  text: string,
  format: Format,
  sourceId: string,
): Promise<ParseResult> {
  const graph = namedNode(sourceId);
  const retag = (quads: RDF.Quad[]) =>
    quads.map((q) => makeQuad(q.subject, q.predicate, q.object, graph));

  const n3Format = N3_FORMATS[format];
  if (n3Format) {
    const prefixes: Record<string, string> = {};
    const parser = new N3Parser({ format: n3Format });
    const quads = parser.parse(text, null, (prefix, iri) => {
      prefixes[prefix] = iri.value;
    }) as unknown as RDF.Quad[];
    return { quads: retag(quads), prefixes, warnings: [] };
  }

  if (format === "rdfxml") {
    const { RdfXmlParser } = await import("rdfxml-streaming-parser");
    const parser = new RdfXmlParser({ defaultGraph: graph });
    return collect(parser, text);
  }

  const { JsonLdParser } = await import("jsonld-streaming-parser");
  const parser = new JsonLdParser();
  const result = await collect(parser, text);
  return { ...result, quads: retag(result.quads) };
}

/**
 * Drives an RDFJS streaming parser. Both parsers extend `Transform`, so writing
 * the whole document and ending the stream is the entire integration — there is
 * no source stream to construct.
 */
function collect(
  parser: RDF.Stream & {
    write: (chunk: string) => void;
    end: () => void;
    on: (event: string, handler: (arg?: unknown) => void) => unknown;
  },
  text: string,
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const quads: RDF.Quad[] = [];
    const prefixes: Record<string, string> = {};
    const warnings: string[] = [];

    parser.on("data", (quad) => quads.push(quad as RDF.Quad));
    parser.on("prefix", ((prefix: string, iri: RDF.NamedNode) => {
      prefixes[prefix] = iri.value;
    }) as (arg?: unknown) => void);
    parser.on("error", (error) => reject(error as Error));
    parser.on("end", () => resolve({ quads, prefixes, warnings }));

    try {
      parser.write(text);
      parser.end();
    } catch (error) {
      reject(error as Error);
    }
  });
}
