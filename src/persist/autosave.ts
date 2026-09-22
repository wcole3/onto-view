import { clear, get, set } from "idb-keyval";
import type * as RDF from "@rdfjs/types";

import { parseDocument } from "../rdf/parse";
import { serialize } from "../rdf/serialize";
import type { Source } from "../model/types";

const KEY = "onto-view:snapshot:v1";

/**
 * Autosave uses IndexedDB, not localStorage.
 *
 * localStorage is about 5 MB per origin and holds UTF-16, so the practical
 * ceiling is around five million characters. The merged Common Core Ontologies
 * alone serialise to roughly 2.4 MB of N-Quads, and a second source would blow
 * it. Exceeding the quota throws, and an editor that loses the user's work to a
 * caught exception is worse than one that never offered to save it.
 *
 * A cap is still enforced below, because IndexedDB quotas are large but not
 * unlimited, and a failure is reported rather than swallowed.
 */
const MAX_SNAPSHOT_BYTES = 24 * 1024 * 1024;

const DEBOUNCE_MS = 1200;

interface Snapshot {
  savedAt: number;
  /** N-Quads, which keeps the graph term that carries provenance. */
  nquads: string;
  sources: Source[];
}

export interface RestoredSnapshot {
  savedAt: number;
  sources: Source[];
  quads: RDF.Quad[];
}

export type SaveState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "too-large"; bytes: number }
  | { status: "failed"; message: string };

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Queues a snapshot. Calls collapse, so a burst of edits writes once.
 *
 * N-Quads is the serialisation because it is the only format that keeps the
 * graph term, which is where provenance lives. Restoring from Turtle would
 * silently merge every source into one.
 */
export function queueSnapshot(
  quads: readonly RDF.Quad[],
  sources: readonly Source[],
  onState: (state: SaveState) => void,
): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    void writeSnapshot(quads, sources).then(onState);
  }, DEBOUNCE_MS);
}

async function writeSnapshot(
  quads: readonly RDF.Quad[],
  sources: readonly Source[],
): Promise<SaveState> {
  try {
    if (sources.length === 0) {
      await clear();
      return { status: "idle" };
    }

    const nquads = await serialize(quads, "nquads");
    const bytes = new Blob([nquads]).size;
    if (bytes > MAX_SNAPSHOT_BYTES) {
      return { status: "too-large", bytes };
    }

    const snapshot: Snapshot = { savedAt: Date.now(), nquads, sources: [...sources] };
    await set(KEY, snapshot);
    return { status: "saved", at: snapshot.savedAt };
  } catch (error) {
    // Reported rather than swallowed: silent data loss is the worst outcome.
    return { status: "failed", message: (error as Error).message };
  }
}

/** Reads back the last snapshot, or null when there is nothing to restore. */
export async function readSnapshot(): Promise<RestoredSnapshot | null> {
  try {
    const snapshot = await get<Snapshot>(KEY);
    if (!snapshot?.nquads || !snapshot.sources?.length) return null;

    // The graph terms in the N-Quads already carry the source ids, so the
    // source id passed here is only a fallback for quads that somehow lack one.
    const { quads } = await parseDocument(snapshot.nquads, "nquads", snapshot.sources[0].id);
    return { savedAt: snapshot.savedAt, sources: snapshot.sources, quads };
  } catch {
    // A snapshot that cannot be read is not worth blocking startup over.
    return null;
  }
}

export async function discardSnapshot(): Promise<void> {
  try {
    await clear();
  } catch {
    // Nothing useful to do if the store cannot be cleared.
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
