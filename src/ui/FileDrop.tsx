import { useCallback, useRef, useState } from "react";

import { FORMAT_LABELS, parseDocument, sniffFormat } from "../rdf/parse";
import { addSource, nextSourceId, setLoadError } from "../model/store";
import { IconUpload } from "./icons";

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/pizza.ttl`;

async function load(name: string, text: string): Promise<void> {
  const format = sniffFormat(name, text);
  const id = nextSourceId();
  const { quads, prefixes, warnings } = await parseDocument(text, format, id);
  if (quads.length === 0) {
    throw new Error(`${name} parsed as ${FORMAT_LABELS[format]} but contained no triples.`);
  }
  addSource({ id, name, format, quadCount: quads.length, prefixes, warnings }, quads);
}

interface FileDropProps {
  /** Rendered as the toolbar control; the drop zone covers the whole shell. */
  variant: "button" | "zone";
}

export function FileDrop({ variant }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await load(file.name, await file.text());
      }
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadSample = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(SAMPLE_URL);
      if (!response.ok) throw new Error(`Could not fetch the sample (${response.status}).`);
      await load("pizza.ttl", await response.text());
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  if (variant === "zone") {
    return (
      <div className="dropzone">
        <p className="dropzone__title">Drop an ontology here</p>
        <p className="panel__empty">
          Turtle, N-Triples, N-Quads, TriG, RDF/XML or JSON-LD. Everything is
          parsed in this tab; no file is uploaded.
        </p>
        <button className="button" type="button" onClick={loadSample} disabled={busy}>
          Try the sample ontology
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        className="visually-hidden"
        // The visible button is the control; without this the hidden input
        // also surfaces as a "Choose File" button to assistive technology.
        aria-hidden
        tabIndex={-1}
        type="file"
        multiple
        accept=".ttl,.turtle,.n3,.nt,.nq,.trig,.rdf,.owl,.xml,.jsonld,.json"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <button
        className="button button--primary"
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <IconUpload />
        {busy ? "Loading" : "Load file"}
      </button>
    </>
  );
}

/** Wires whole-window drag and drop. Returned handlers go on the shell element. */
export function useWindowDrop() {
  const [over, setOver] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setOver(true);
  }, []);
  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (event.currentTarget === event.target) setOver(false);
  }, []);
  const onDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    const files = Array.from(event.dataTransfer.files);
    try {
      for (const file of files) {
        await load(file.name, await file.text());
      }
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, []);

  return { over, onDragOver, onDragLeave, onDrop: (e: React.DragEvent) => void onDrop(e) };
}
