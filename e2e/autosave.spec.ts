import { expect, test } from "@playwright/test";

import { loadSample, nodeIds, tripleCount } from "./helpers";

test("restores the session, including unsaved edits, after a reload", async ({ page }) => {
  await loadSample(page);

  await page.getByRole("button", { name: "New entity" }).click();
  await page.getByLabel("Label", { exact: true }).fill("Stuffed Crust");
  await page.getByRole("button", { name: "Create" }).click();
  const before = await tripleCount(page);

  // Past the autosave debounce.
  await expect(page.locator(".autosave__note")).toContainText("Saved in this browser", {
    timeout: 10_000,
  });

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".sources__item").length === 1);

  await expect(page.locator(".autosave__note")).toContainText("restored from");
  expect(await tripleCount(page)).toBe(before);
  expect(await nodeIds(page)).toContain("http://example.org/pizza#StuffedCrust");
  await expect(page.locator(".sources__name")).toContainText("pizza.ttl");
});

test("discarding the saved copy stops it coming back", async ({ page }) => {
  await loadSample(page);
  await expect(page.locator(".autosave__note")).toContainText("Saved in this browser", {
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Discard saved copy" }).click();
  await page.reload();

  await expect(page.getByRole("button", { name: "Try the sample ontology" })).toBeVisible();
  await expect(page.locator(".sources__item")).toHaveCount(0);
});
