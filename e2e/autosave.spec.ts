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

  await expect(page.getByRole("button", { name: "Try the sample ontology" })).toBeVisible({timeout: 15_000});
  await expect(page.locator(".sources__item")).toHaveCount(0);
});

test("restores several sources without merging them into the first", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', [
    {
      name: "a.ttl",
      mimeType: "text/turtle",
      buffer: Buffer.from(
        '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<http://x/A> a owl:Class .',
      ),
    },
    {
      name: "b.ttl",
      mimeType: "text/turtle",
      buffer: Buffer.from(
        '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<http://x/B> a owl:Class .\n<http://x/B2> a owl:Class .',
      ),
    },
  ]);
  await page.waitForFunction(() => document.querySelectorAll(".sources__item").length === 2);
  await expect(page.locator(".autosave__note")).toContainText("Saved in this browser", {
    timeout: 10_000,
  });

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".sources__item").length === 2);
  await expect(page.locator(".autosave__note")).toContainText("restored from");

  // Each source keeps its own triples rather than the second coming back empty.
  await expect(page.locator(".sources__meta").nth(0)).toContainText("1 triples");
  await expect(page.locator(".sources__meta").nth(1)).toContainText("2 triples");

  // And its own colour, which is read from the graph term the quads carry.
  const colours = await page.evaluate(() =>
    window.__ontoView!.cy.nodes().map((n) => `${n.id()}=${String(n.data("color"))}`),
  );
  const colourOf = (iri: string) =>
    colours.find((entry) => entry.startsWith(`${iri}=`))?.split("=")[1];
  expect(colourOf("http://x/A")).toBeTruthy();
  expect(colourOf("http://x/B")).not.toBe(colourOf("http://x/A"));
  expect(colourOf("http://x/B2")).toBe(colourOf("http://x/B"));
});
