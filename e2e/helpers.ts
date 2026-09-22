import type { Page } from "@playwright/test";

/**
 * Cytoscape renders to a canvas, so its nodes cannot be addressed by selector.
 * The application exposes its instance for exactly this reason; see
 * src/graph/useCytoscape.ts.
 */
export async function clickNode(page: Page, label: string): Promise<void> {
  const box = await page.locator(".graph").boundingBox();
  if (!box) throw new Error("graph canvas has no box");

  const position = await page.evaluate((wanted) => {
    const api = window.__ontoView;
    if (!api) throw new Error("test hook missing");
    const node = api.cy.nodes().filter((n) => String(n.data("label")) === wanted)[0];
    if (!node) throw new Error(`no node labelled ${wanted}`);
    return node.renderedPosition();
  }, label);

  await page.mouse.click(box.x + position.x, box.y + position.y);
}

export async function nodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ontoView!.cy.nodes().map((n) => n.id()));
}

export async function elementCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__ontoView!.cy.elements().length);
}

/** The triple count the source panel reports for the first source. */
export async function tripleCount(page: Page): Promise<number> {
  const text = (await page.locator(".sources__meta").first().textContent()) ?? "";
  const match = text.match(/([\d,]+) triples/);
  if (!match) throw new Error(`no triple count in "${text}"`);
  return Number(match[1].replaceAll(",", ""));
}

export async function loadSample(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the sample ontology" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".sources__item").length === 1);
  await page.waitForTimeout(300);
}
