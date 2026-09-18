import { useEffect, useState } from "react";

import { useWorkspace } from "@/hooks/useWorkspace";
import { useAppStore } from "@/state/appStore";

type HealthState = "checking" | "online" | "offline";

const HEALTH_LABELS: Record<HealthState, string> = {
  checking: "Checking backend…",
  online: "Backend online",
  offline: "Backend unreachable",
};

export default function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const { status, error, createNewWorkspace, renameWorkspace, deleteWorkspace } =
    useWorkspace();
  const currentWorkspace = useAppStore((state) => state.currentWorkspace);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/healthz")
      .then((response) => setHealth(response.ok ? "online" : "offline"))
      .catch(() => setHealth("offline"));
  }, []);

  const workspaceId = currentWorkspace?.id;
  useEffect(() => {
    setNameDraft(null);
  }, [workspaceId]);

  if (status === "loading") {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p data-testid="workspace-status">Loading workspace…</p>
        </main>
      </div>
    );
  }

  if (status === "error" || !currentWorkspace) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p data-testid="workspace-error">{error ?? "Failed to load the workspace."}</p>
        </main>
      </div>
    );
  }

  const run = (operation: () => Promise<void>): void => {
    setIsBusy(true);
    void operation().finally(() => setIsBusy(false));
  };

  const handleRenameSave = (): void => {
    if (nameDraft === null) return;
    const name = nameDraft.trim();
    if (!name || name === currentWorkspace.name) {
      setNameDraft(null);
      return;
    }
    run(async () => {
      await renameWorkspace(name);
      setNameDraft(null);
    });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Ontology Viewer</h1>
        <span className={`health-pill health-${health}`} data-testid="backend-health">
          {HEALTH_LABELS[health]}
        </span>
      </header>
      <div className="workspace-bar">
        <input
          aria-label="Workspace name"
          data-testid="workspace-name"
          value={nameDraft ?? currentWorkspace.name}
          disabled={isBusy}
          onChange={(event) => setNameDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleRenameSave();
            }
          }}
        />
        <button
          type="button"
          disabled={isBusy || nameDraft === null}
          onClick={handleRenameSave}
        >
          Save
        </button>
        <button
          type="button"
          data-testid="new-workspace"
          disabled={isBusy}
          onClick={() => run(createNewWorkspace)}
        >
          New workspace
        </button>
        <button
          type="button"
          data-testid="delete-workspace"
          disabled={isBusy}
          onClick={() => {
            if (window.confirm("Delete this workspace? Its sources will be removed.")) {
              run(deleteWorkspace);
            }
          }}
        >
          Delete
        </button>
      </div>
      <main className="app-main">
        <p className="empty-state" data-testid="workspace-status">
          Upload RDF, OWL, or LinkML files to start visualizing ontologies.
        </p>
      </main>
    </div>
  );
}
