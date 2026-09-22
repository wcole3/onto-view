import { useEffect, useRef, useState } from "react";

import {
  discardSnapshot,
  formatBytes,
  queueSnapshot,
  readSnapshot,
  type SaveState,
} from "../persist/autosave";
import { quadStore, restoreSources, useAppStore } from "../model/store";

/**
 * Saves the session to IndexedDB after edits settle, and restores it on load.
 *
 * Restoring happens automatically rather than behind a prompt, because the
 * point is that closing the tab does not lose work. The panel still says what
 * was restored and offers to discard it.
 */
export function Autosave() {
  const sources = useAppStore((state) => state.sources);
  const revision = useAppStore((state) => state.revision);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [restored, setRestored] = useState<number | null>(null);
  const restoreAttempted = useRef(false);

  useEffect(() => {
    // React runs effects twice in development; a second restore would double
    // every quad's source entry.
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;

    void readSnapshot().then((snapshot) => {
      if (!snapshot) return;
      if (useAppStore.getState().sources.length > 0) return;
      restoreSources(snapshot.sources, snapshot.quads);
      setRestored(snapshot.savedAt);
    });
  }, []);

  useEffect(() => {
    // Revision 0 with no sources is the initial state; saving it would clear a
    // snapshot before the restore above has had a chance to read it.
    if (revision === 0) return;
    queueSnapshot(
      quadStore().getQuads(null, null, null, null) as unknown as never[],
      sources,
      setState,
    );
  }, [revision, sources]);

  if (sources.length === 0) return null;

  return (
    <div className="autosave">
      {state.status === "too-large" ? (
        <p className="autosave__warn">
          Too large to autosave ({formatBytes(state.bytes)}). Download your work
          to keep it.
        </p>
      ) : state.status === "failed" ? (
        <p className="autosave__warn">Autosave failed: {state.message}</p>
      ) : (
        <p className="autosave__note">
          {state.status === "saved"
            ? `Saved in this browser at ${time(state.at)}`
            : "Autosaves to this browser"}
          {restored ? ` · restored from ${time(restored)}` : ""}
        </p>
      )}

      <button
        className="link"
        type="button"
        onClick={() => {
          void discardSnapshot();
          setRestored(null);
          setState({ status: "idle" });
        }}
      >
        Discard saved copy
      </button>
    </div>
  );
}

function time(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
