import { useState } from "react";
import type * as RDF from "@rdfjs/types";

import {
  serialize,
  WRITE_FORMAT_EXTENSIONS,
  WRITE_FORMAT_LABELS,
  type WriteFormat,
} from "../rdf/serialize";
import { download, MIME_TYPES } from "../persist/download";
import { quadStore, setLoadError, useAppStore } from "../model/store";
import { IconDownload } from "./icons";

const FORMATS: WriteFormat[] = ["turtle", "ntriples", "nquads", "jsonld"];

/** "all visible sources merged", or one source's id. */
type Scope = "visible" | string;

export function Export() {
  const sources = useAppStore((state) => state.sources);
  const [format, setFormat] = useState<WriteFormat>("turtle");
  const [scope, setScope] = useState<Scope>("visible");
  const [busy, setBusy] = useState(false);

  const visible = sources.filter((source) => source.visible);
  if (sources.length === 0) return null;

  const run = async () => {
    setBusy(true);
    try {
      const chosen = scope === "visible" ? visible : sources.filter((s) => s.id === scope);
      if (chosen.length === 0) {
        throw new Error("Nothing to export: every source is hidden.");
      }

      const store = quadStore();
      const quads: RDF.Quad[] = [];
      const prefixes: Record<string, string> = {};
      for (const source of chosen) {
        quads.push(...(store.getQuads(null, null, null, source.id) as unknown as RDF.Quad[]));
        Object.assign(prefixes, source.prefixes);
      }

      const text = await serialize(quads, format, prefixes);
      const stem =
        chosen.length === 1
          ? chosen[0].name.replace(/\.[^.]+$/, "")
          : "onto-view-export";
      download(
        `${stem}.${WRITE_FORMAT_EXTENSIONS[format]}`,
        text,
        MIME_TYPES[format] ?? "text/plain",
      );
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="checks checks--export">
      <span className="panel__title">Export</span>

      <label className="field field--stacked">
        <span className="field__label">Sources</span>
        <select
          className="button"
          aria-label="Sources to export"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="visible">
            All visible ({visible.length})
          </option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field field--stacked">
        <span className="field__label">Format</span>
        <select
          className="button"
          aria-label="Export format"
          value={format}
          onChange={(event) => setFormat(event.target.value as WriteFormat)}
        >
          {FORMATS.map((name) => (
            <option key={name} value={name}>
              {WRITE_FORMAT_LABELS[name]}
            </option>
          ))}
        </select>
      </label>

      <button className="button button--primary" type="button" onClick={run} disabled={busy}>
        <IconDownload />
        {busy ? "Preparing" : "Download"}
      </button>

      <p className="panel__empty">
        {format === "nquads"
          ? "N-Quads keeps the graph column, which holds the internal source id."
          : "Provenance lives in each quad's graph term and is dropped on export."}
      </p>
    </div>
  );
}
