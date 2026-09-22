import { expect, test } from "@playwright/test";

import { clickNode, loadSample } from "./helpers";

test("the tree shows the hierarchy and drives the inspector", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "Tree" }).click();

  const tree = page.getByRole("tree", { name: "Class hierarchy" });
  await expect(tree).toBeVisible();

  // Food is a root; Pizza sits under it and is hidden until the branch opens.
  await expect(tree.getByRole("button", { name: "Food", exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "Pizza", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Expand Food" }).click();
  await tree.getByRole("button", { name: "Pizza", exact: true }).click();

  await expect(page.locator(".panel--right")).toContainText("Pizza");
});

test("the tree obeys the same filters as the graph", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "Tree" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();

  const tree = page.getByRole("tree", { name: "Class hierarchy" });
  await expect(tree.getByRole("button", { name: "Margherita", exact: true })).toBeVisible();

  await page.getByLabel("Search labels and IRIs").fill("Margherita");
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(tree.getByRole("button", { name: "Margherita", exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
});

test("switching back to the graph keeps the canvas", async ({ page }) => {
  await loadSample(page);
  await clickNode(page, "Pizza");

  await page.getByRole("button", { name: "Tree" }).click();
  // The branch holding the canvas selection is revealed rather than collapsed.
  await expect(page.locator(".tree__row--selected")).toContainText("Pizza");

  await page.getByRole("button", { name: "Graph" }).click();
  await expect(page.locator(".tree")).toHaveCount(0);
  const selected = await page.evaluate(() =>
    window.__ontoView!.cy.nodes(":selected").map((n) => n.id()),
  );
  expect(selected).toContain("http://example.org/pizza#Pizza");
});
