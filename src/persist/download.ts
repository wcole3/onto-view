/** Hands the browser a file to save. */
export function download(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers, so let the
  // current task finish first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const MIME_TYPES: Record<string, string> = {
  turtle: "text/turtle",
  ntriples: "application/n-triples",
  nquads: "application/n-quads",
  jsonld: "application/ld+json",
  rdfxml: "application/rdf+xml",
};
