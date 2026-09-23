import { expect, test, type Page } from "@playwright/test";

import { loadSample } from "./helpers";

async function slotWidth(page: Page, side: "left" | "right"): Promise<number> {
  const box = await page.locator(`.panel-slot--${side}`).boundingBox();
  if (!box) throw new Error(`no ${side} panel`);
  return box.width;
}

test("a side panel can be dragged to a new width, and it survives a reload", async ({ page }) => {
  await loadSample(page);
  const before = await slotWidth(page, "left");

  const handle = page.getByRole("separator", { name: "Resize Sources panel" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  const after = await slotWidth(page, "left");
  expect(after).toBeGreaterThan(before + 60);

  await page.reload();
  await expect(page.locator(".panel-slot--left")).toBeVisible({timeout: 15_000});
  expect(await slotWidth(page, "left")).toBeCloseTo(after, 0);
});

test("the handle resizes from the keyboard and resets on Home", async ({ page }) => {
  await loadSample(page);
  const before = await slotWidth(page, "right");

  const handle = page.getByRole("separator", { name: "Resize Inspector panel" });
  await handle.focus();
  await handle.press("ArrowLeft");
  expect(await slotWidth(page, "right")).toBeGreaterThan(before);

  await handle.press("Home");
  expect(await slotWidth(page, "right")).toBeCloseTo(before, 0);
});

test("collapsing a panel leaves a rail that reopens it", async ({ page }) => {
  await loadSample(page);

  await page.getByRole("button", { name: "Hide Inspector panel" }).click();
  await expect(page.locator(".panel--rail")).toContainText("Inspector");
  await expect(page.getByRole("heading", { name: "Inspector" })).toHaveCount(0);
  expect(await slotWidth(page, "right")).toBeLessThan(40);

  // The canvas takes the freed space rather than leaving a gap.
  const graph = (await page.locator(".graph").boundingBox())!;
  expect(graph.width).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Show Inspector panel" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible({timeout: 15_000});
});
