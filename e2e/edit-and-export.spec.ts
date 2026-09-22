import { expect, test } from "@playwright/test";

import { clickNode, loadSample, nodeIds, tripleCount } from "./helpers";

test("creates an entity, derives its IRI, and undoes it", async ({ page }) => {
  await loadSample(page);
  const start = await tripleCount(page);

  await page.getByRole("button", { name: "New entity" }).click();
  await page.getByLabel("Entity kind").selectOption("Class");
  await page.getByLabel("Label", { exact: true }).fill("Quattro Formaggi");
  await page.getByRole("button", { name: "Create" }).click();

  // A type declaration and a label.
  expect(await tripleCount(page)).toBe(start + 2);
  await expect(page.locator(".banner--success")).toContainText("Created Class");
  // The IRI comes from the label and the document's own namespace.
  expect(await nodeIds(page)).toContain("http://example.org/pizza#QuattroFormaggi");

  await page.getByRole("button", { name: /Undo/ }).click();
  expect(await tripleCount(page)).toBe(start);
  await expect(page.getByRole("button", { name: /Undo/ })).toBeDisabled();
});

test("editing a label replaces the old value rather than adding one", async ({ page }) => {
  await loadSample(page);
  const start = await tripleCount(page);

  await clickNode(page, "Funghi");
  await page.getByLabel("Label", { exact: true }).fill("Funghi e Prosciutto");
  await page.getByLabel("Label", { exact: true }).blur();

  expect(await tripleCount(page)).toBe(start);
  expect(await nodeIds(page)).toContain("http://example.org/pizza#Funghi");
  await expect(page.locator(".banner--success")).toContainText("Set label");
});

test("a rename rewrites inbound references and leaves nothing dangling", async ({ page }) => {
  await loadSample(page);
  const start = await tripleCount(page);

  await clickNode(page, "Margherita");
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Entity IRI").fill("http://example.org/pizza#MargheritaClassica");
  await page.getByLabel("Entity IRI").press("Enter");

  // A rename adds and removes the same number of statements.
  expect(await tripleCount(page)).toBe(start);
  const ids = await nodeIds(page);
  expect(ids).toContain("http://example.org/pizza#MargheritaClassica");
  expect(ids).not.toContain("http://example.org/pizza#Margherita");

  // The individual that was typed by it followed the rename, which is only
  // visible with individuals shown.
  await page.getByLabel("Hide individuals").uncheck();
  const withIndividuals = await page.evaluate(() =>
    window.__ontoView!.cy.edges().map((e) => `${e.data("source")}->${e.data("target")}`),
  );
  expect(withIndividuals.join(" ")).toContain("MargheritaClassica");
});

test("deleting an entity removes the statements that point at it", async ({ page }) => {
  await loadSample(page);
  await clickNode(page, "Margherita");

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete entity" }).click();

  await expect(page.locator(".banner--success")).toContainText("Deleted");
  expect(await nodeIds(page)).not.toContain("http://example.org/pizza#Margherita");

  // Nothing may still reference the deleted entity.
  const edges = await page.evaluate(() =>
    window.__ontoView!.cy.edges().map((e) => `${e.data("source")} ${e.data("target")}`),
  );
  expect(edges.join(" ")).not.toContain("#Margherita");
});

test("exports every format, and the export reparses to the same triples", async ({ page }) => {
  await loadSample(page);
  const start = await tripleCount(page);

  for (const [format, extension] of [
    ["turtle", "ttl"],
    ["ntriples", "nt"],
    ["jsonld", "jsonld"],
    ["rdfxml", "rdf"],
  ] as const) {
    await page.getByLabel("Export format").selectOption(format);
    const [downloaded] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download/ }).click(),
    ]);
    expect(downloaded.suggestedFilename()).toBe(`pizza.${extension}`);

    const path = await downloaded.path();
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path, "utf8");
    expect(text.length).toBeGreaterThan(100);
    // The internal source id must never reach an exported document.
    expect(text).not.toContain("urn:onto-view:source");

    // Load the export back and confirm it carries the same triples.
    await page.getByRole("button", { name: "Remove pizza.ttl" }).click();
    await page.setInputFiles('input[type="file"]', {
      name: `pizza.${extension}`,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    await page.waitForFunction(() => document.querySelectorAll(".sources__item").length === 1);
    expect(await tripleCount(page)).toBe(start);

    // Reset for the next format.
    await page.getByRole("button", { name: new RegExp(`Remove pizza\\.${extension}`) }).click();
    await loadSample(page);
  }
});

test("warns that RDF/XML export is best effort", async ({ page }) => {
  await loadSample(page);
  await page.getByLabel("Export format").selectOption("rdfxml");
  await expect(page.locator(".autosave__warn")).toContainText("hand-written");
  await expect(page.locator(".autosave__warn")).toContainText("Turtle is the recommended");
});
