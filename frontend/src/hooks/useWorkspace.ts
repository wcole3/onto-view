import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "@/api/client";
import type { Workspace } from "@/api/types";
import { useAppStore } from "@/state/appStore";

const WORKSPACE_STORAGE_KEY = "ontoview.workspaceId";

export type WorkspaceStatus = "loading" | "ready" | "error";

function readStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistWorkspaceId(workspaceId: string): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // Storage unavailable (e.g. private mode); the URL param still carries it.
  }
}

function clearStoredWorkspaceId(): void {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Ignore: nothing else to clear.
  }
}

function readUrlWorkspaceId(): string | null {
  return new URLSearchParams(window.location.search).get("workspace");
}

function setUrlWorkspaceId(workspaceId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("workspace", workspaceId);
  window.history.replaceState(null, "", url.toString());
}

async function createDefaultWorkspace(): Promise<Workspace> {
  const workspace = await api.createWorkspace({ name: "" });
  persistWorkspaceId(workspace.id);
  setUrlWorkspaceId(workspace.id);
  return workspace;
}

// Deduplicates concurrent startup resolutions (e.g. StrictMode double effect)
// so a default workspace is created at most once per navigation.
let startupInFlight: Promise<Workspace> | null = null;

function startWorkspaceResolution(): Promise<Workspace> {
  if (!startupInFlight) {
    startupInFlight = (async () => {
      const candidate = readUrlWorkspaceId() ?? readStoredWorkspaceId();
      if (candidate) {
        try {
          const workspace = await api.getWorkspace(candidate);
          persistWorkspaceId(workspace.id);
          setUrlWorkspaceId(workspace.id);
          return workspace;
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) {
            throw error;
          }
          // Stored workspace no longer exists: fall through and create a new one.
        }
      }
      return createDefaultWorkspace();
    })().finally(() => {
      startupInFlight = null;
    });
  }
  return startupInFlight;
}

export function useWorkspace() {
  const [status, setStatus] = useState<WorkspaceStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const {
      setCapabilities,
      setCurrentWorkspace,
      setInitializing,
      setInitializationError,
    } = useAppStore.getState();

    (async () => {
      try {
        const capabilities = await api.getCapabilities();
        if (cancelled) return;
        setCapabilities(capabilities);
        const workspace = await startWorkspaceResolution();
        if (cancelled) return;
        setCurrentWorkspace(workspace);
        setInitializing(false);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to initialize the workspace.";
        setInitializationError(message);
        setInitializing(false);
        setError(message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const createNewWorkspace = useCallback(async (): Promise<void> => {
    const workspace = await createDefaultWorkspace();
    useAppStore.getState().setCurrentWorkspace(workspace);
  }, []);

  const renameWorkspace = useCallback(async (name: string): Promise<void> => {
    const current = useAppStore.getState().currentWorkspace;
    if (!current) return;
    const updated = await api.updateWorkspace(current.id, { name });
    // Stale-response guard: a newer workspace may have replaced `current`.
    if (useAppStore.getState().currentWorkspace?.id === current.id) {
      useAppStore.getState().setCurrentWorkspace(updated);
    }
  }, []);

  const deleteWorkspace = useCallback(async (): Promise<void> => {
    const current = useAppStore.getState().currentWorkspace;
    if (!current) return;
    await api.deleteWorkspace(current.id);
    clearStoredWorkspaceId();
    const workspace = await createDefaultWorkspace();
    useAppStore.getState().setCurrentWorkspace(workspace);
  }, []);

  return { status, error, createNewWorkspace, renameWorkspace, deleteWorkspace };
}
