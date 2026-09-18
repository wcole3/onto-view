import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/api/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses successful JSON responses against /api/v1", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ id: "w1", name: "A", created_at: "", updated_at: "", schema_version: 1 }),
    );

    const workspace = await api.getWorkspace("w1");

    expect(workspace.name).toBe("A");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/w1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends JSON bodies with the content type header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: "w2", name: "B" }));

    await api.createWorkspace({ name: "B" });

    const init = vi.mocked(fetch).mock.calls[0][1];
    expect(init?.body).toBe(JSON.stringify({ name: "B" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("throws ApiError carrying the backend error body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { error: { code: "not_found", message: "Workspace not found.", details: {} } },
        404,
      ),
    );

    await expect(api.getWorkspace("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "not_found",
      message: "Workspace not found.",
    });
  });

  it("falls back to a generic message for non-JSON error bodies", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("boom", { status: 500, headers: { "Content-Type": "text/plain" } }),
    );

    const error = await api.listWorkspaces().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).code).toBe("http_error");
  });

  it("throws a network ApiError when fetch rejects", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("failed to fetch"));

    const error = await api.listWorkspaces().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "network_error" });
  });

  it("rethrows abort errors untouched", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    vi.mocked(fetch).mockRejectedValueOnce(abort);

    await expect(api.listWorkspaces()).rejects.toBe(abort);
  });

  it("returns undefined for 204 responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.deleteWorkspace("w1")).resolves.toBeUndefined();
  });
});
