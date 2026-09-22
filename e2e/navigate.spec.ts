import { expect, test } from "@playwright/test";

import { clickNode, elementCount, loadSample } from "./helpers";

test("search narrows the graph and says so", async ({ page }) => {
  await loadSample(page);
  const before = await elementCount(page);

  await page.getByLabel("Search labels and IRIs").fill("Margherita");
  await expect(page.locator(".banner")).toContainText("Search matches");
  expect(await elementCount(page)).toBeLessThan(before);

  await page.getByRole("button", { name: "Show all" }).click();
  expect(await elementCount(page)).toBe(before);
});

test("a depth limit keeps only the top of the hierarchy", async ({ page }) => {
  await loadSample(page);

  await page.getByLabel("Levels from the hierarchy roots").selectOption("1");
  await expect(page.locator(".banner")).toContainText("top levels");

  const ids = await page.evaluate(() => window.__ontoView!.cy.nodes().map((n) => n.id()));
  expect(ids).toContain("http://example.org/pizza#Food");
  // Two levels below a root.
  expect(ids).not.toContain("http://example.org/pizza#Margherita");
});

test("focus scopes the graph to one entity's neighbourhood", async ({ page }) => {
  await loadSample(page);
  await clickNode(page, "Pizza");

  await page.getByRole("button", { name: "Focus on this" }).click();
  await expect(page.locator(".banner")).toContainText("Focused on one entity");

  const ids = await page.evaluate(() => window.__ontoView!.cy.nodes().map((n) => n.id()));
  expect(ids).toContain("http://example.org/pizza#Pizza");
  expect(ids).toContain("http://example.org/pizza#Food");

  await page.getByRole("button", { name: "Clear focus" }).click();
  await expect(page.locator(".banner")).toHaveCount(0);
});

test("the inspector's neighbour links walk the graph", async ({ page }) => {
  await loadSample(page);
  await clickNode(page, "Margherita");
  await expect(page.locator(".details__iri")).toHaveText(
    "http://example.org/pizza#Margherita",
  );

  // Margherita's broader class is Pizza.
  await page.locator(".neighbours .link").first().click();
  await expect(page.locator(".details__iri")).toHaveText("http://example.org/pizza#Pizza");
});

test("hiding a source removes its contribution", async ({ page }) => {
  await loadSample(page);
  expect(await elementCount(page)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Hide pizza.ttl" }).click();
  expect(await elementCount(page)).toBe(0);

  await page.getByRole("button", { name: "Show pizza.ttl" }).click();
  expect(await elementCount(page)).toBeGreaterThan(0);
});
