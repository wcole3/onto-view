import { FORMAT_LABELS } from "../rdf/parse";
import {
  removeSource,
  setActiveSource,
  setSourceVisible,
  useAppStore,
} from "../model/store";
import { IconClose, IconEye, IconEyeOff } from "./icons";

/**
 * Sources, their colours, and which one edits target.
 *
 * Hiding a source filters at derivation time rather than hiding graph
 * elements, so the hierarchy, the counts and the inspector all stay consistent
 * with what is on screen.
 */
export function SourceList() {
  const sources = useAppStore((state) => state.sources);
  const activeSourceId = useAppStore((state) => state.activeSourceId);

  if (sources.length === 0) {
    return (
      <p className="panel__empty">No files loaded. Drop one anywhere, or use Load file.</p>
    );
  }

  return (
    <ul className="sources">
      {sources.map((source) => (
        <li className="sources__item" key={source.id}>
          <span className="sources__swatch" style={{ background: source.color }} aria-hidden />

          <label className="sources__name" title={source.name}>
            <input
              type="radio"
              name="active-source"
              className="visually-hidden"
              checked={activeSourceId === source.id}
              onChange={() => setActiveSource(source.id)}
            />
            <span className={activeSourceId === source.id ? "sources__active" : undefined}>
              {source.name}
            </span>
          </label>

          <span className="sources__actions">
            <button
              className="icon-button"
              type="button"
              aria-label={source.visible ? `Hide ${source.name}` : `Show ${source.name}`}
              aria-pressed={!source.visible}
              onClick={() => setSourceVisible(source.id, !source.visible)}
            >
              {source.visible ? <IconEye /> : <IconEyeOff />}
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove ${source.name}`}
              onClick={() => removeSource(source.id)}
            >
              <IconClose />
            </button>
          </span>

          <span className="sources__meta mono">
            {FORMAT_LABELS[source.format]} · {source.quadCount.toLocaleString()} triples
            {activeSourceId === source.id ? " · edit target" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
