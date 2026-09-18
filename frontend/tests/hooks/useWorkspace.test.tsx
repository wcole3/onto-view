import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/api/client";
import type { Capabilities, Workspace } from "@/api/types";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAppStore } from "@/state/appStore";

const CAPABILITIES: Capabilities = {
  version: "0.1.0",
  rdf_formats: ["turtle", "trig"],
  linkml_formats: ["yaml", "json"],
  max_upload_bytes: 52428800,
  max_graph_nodes: 20000,
  max_graph_edges: 100000,
  network_imports_enabled: false,
  profiles: ["generic"],
};

const STORED_WORKSPACE: Workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Stored workspace",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  schema_version: 1,
};

const CREATED_WORKSPACE: Workspace = {
  ...STORED_WORKSPACE,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Untitled workspace",
};

function resetEnvironment(): void {
  window.localStorage.clear();
  window.history.pushState(null, "", "/");
  useAppStore.setState({
    capabilities: null,
    currentWorkspace: null,
    isInitializing: true,
    initializationError: null,
  });
}

beforeEach(resetEnvironment);
afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWorkspace", () => {
  it("creates a default workspace when none is stored", async () => {
    vi.spyOn(api, "getCapabilities").mockResolvedValue(CAPABILITIES);
    const createWorkspace = vi
      .spyOn(api, "createWorkspace")
      .mockResolvedValue(CREATED_WORKSPACE);

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(createWorkspace).toHaveBeenCalledWith({ name: "" });
    expect(useAppStore.getState().currentWorkspace?.id).toBe(CREATED_WORKSPACE.id);
    expect(window.localStorage.getItem("ontoview.workspaceId")).toBe(CREATED_WORKSPACE.id);
    expect(new URLSearchParams(window.location.search).get("workspace")).toBe(
      CREATED_WORKSPACE.id,
    );
  });

  it("restores the workspace referenced by the URL", async () => {
    window.history.pushState(null, "", `/?workspace=${STORED_WORKSPACE.id}`);
    vi.spyOn(api, "getCapabilities").mockResolvedValue(CAPABILITIES);
    const getWorkspace = vi.spyOn(api, "getWorkspace").mockResolvedValue(STORED_WORKSPACE);
    const createWorkspace = vi.spyOn(api, "createWorkspace");

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getWorkspace).toHaveBeenCalledWith(STORED_WORKSPACE.id);
    expect(createWorkspace).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentWorkspace?.name).toBe("Stored workspace");
  });

  it("creates a new workspace when the stored one no longer exists", async () => {
    window.localStorage.setItem("ontoview.workspaceId", STORED_WORKSPACE.id);
    vi.spyOn(api, "getCapabilities").mockResolvedValue(CAPABILITIES);
    vi.spyOn(api, "getWorkspace").mockRejectedValue(
      new ApiError(404, "not_found", "Workspace not found."),
    );
    const createWorkspace = vi
      .spyOn(api, "createWorkspace")
      .mockResolvedValue(CREATED_WORKSPACE);

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(createWorkspace).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().currentWorkspace?.id).toBe(CREATED_WORKSPACE.id);
  });

  it("surfaces initialization errors", async () => {
    vi.spyOn(api, "getCapabilities").mockRejectedValue(
      new ApiError(0, "network_error", "Network request failed."),
    );

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Network request failed.");
    expect(useAppStore.getState().initializationError).toBe("Network request failed.");
  });
});
