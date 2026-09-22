/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  /**
   * Local dev, preview and the end-to-end suite all serve from the root, so
   * that is the default. The Pages workflow sets VITE_BASE to the project
   * page's path, because a project page is served from
   * `https://<user>.github.io/<repo>/` and a build made for `/` requests its
   * assets from the domain root and renders a blank page.
   */
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Unit tests colocate with their code. Without this, Vitest's default
    // globs also collect the Playwright specs in e2e/, which need a browser.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
