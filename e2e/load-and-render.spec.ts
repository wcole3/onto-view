import { expect, test } from "@playwright/test";

import { clickNode, elementCount, loadSample, nodeIds } from "./helpers";

test("loads the sample ontology and renders its hierarchy", async ({ page }) => {
  await loadSample(page);

  await expect(page.locator(".sources__meta").first()).toContainText("Turtle");
  await expect(page.locator(".sources__meta").first()).toContainText("58 triples");
  expect(await elementCount(page)).toBeGreaterThan(20);

  const ids = await nodeIds(page);
  expect(ids).toContain("http://example.org/pizza#Margherita");
  // Individuals are hidden by default.
  expect(ids).not.toContain("http://example.org/pizza#margheritaAtLuigis");
});

test("selecting a node fills the inspector", async ({ page }) => {
  await loadSample(page);
  await clickNode(page, "Pizza");

  await expect(page.getByLabel("Label", { exact: true })).toHaveValue("Pizza");
  await expect(page.locator(".details__iri")).toHaveText("http://example.org/pizza#Pizza");
  await expect(page.locator(".panel--right .tag")).toHaveText("Class");
  await expect(page.locator(".chip")).toContainText("pizza.ttl");
});

test("reads a file the user drops in, in every supported syntax", async ({ page }) => {
  await page.goto("/");

  const documents = [
    {
      name: "a.ttl",
      mimeType: "text/turtle",
      buffer: Buffer.from(
        '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<http://x/A> a owl:Class .',
      ),
    },
    {
      name: "b.rdf",
      mimeType: "application/rdf+xml",
      buffer: Buffer.from(
        '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#"><owl:Class rdf:about="http://x/B"/></rdf:RDF>',
      ),
    },
    {
      name: "c.jsonld",
      mimeType: "application/ld+json",
      buffer: Buffer.from(
        JSON.stringify({
          "@context": { owl: "http://www.w3.org/2002/07/owl#" },
          "@id": "http://x/C",
          "@type": "owl:Class",
        }),
      ),
    },
  ];

  await page.setInputFiles('input[type="file"]', documents);
  await page.waitForFunction(() => document.querySelectorAll(".sources__item").length === 3);

  await expect(page.locator(".sources__meta").nth(0)).toContainText("Turtle");
  await expect(page.locator(".sources__meta").nth(1)).toContainText("RDF/XML");
  await expect(page.locator(".sources__meta").nth(2)).toContainText("JSON-LD");

  const ids = await nodeIds(page);
  expect(ids).toEqual(expect.arrayContaining(["http://x/A", "http://x/B", "http://x/C"]));
});

test("reports a malformed file instead of failing silently", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "broken.ttl",
    mimeType: "text/turtle",
    buffer: Buffer.from("this is not turtle {{{"),
  });

  await expect(page.locator(".banner--error")).toBeVisible({timeout: 15_000});
  await expect(page.locator(".sources__item")).toHaveCount(0);
});
