import AxeBuilder from "@axe-core/playwright";
import { test, expect, type APIRequestContext } from "@playwright/test";
import type { RunDetail } from "../shared/types";
const origin = {
  Origin: "http://localhost:8790",
  "Content-Type": "application/json",
};
async function start(request: APIRequestContext, scenarioId: string) {
  const boot = await request.get("/api/bootstrap");
  expect((await boot.json()).mode).toBe("fixture");
  const id = crypto.randomUUID();
  const r = await request.post("/api/runs", {
    headers: origin,
    data: { scenarioId, requestId: id },
  });
  expect(r.status(), await r.text()).toBe(202);
  return id;
}
async function detail(request: APIRequestContext, id: string) {
  const r = await request.get(`/api/runs/${id}`);
  expect(r.status()).toBe(200);
  return r.json() as Promise<RunDetail>;
}
async function until(
  request: APIRequestContext,
  id: string,
  status: string,
  version?: number,
) {
  await expect
    .poll(
      async () => {
        const d = await detail(request, id);
        return `${d.run.status}:${d.run.plan_version}`;
      },
      { timeout: 55000, intervals: [500, 1000, 1500] },
    )
    .toBe(`${status}:${version ?? 1}`);
  return detail(request, id);
}
async function approve(
  request: APIRequestContext,
  id: string,
  version = 1,
  optionId = "part-local",
  decision = "approve",
) {
  return request.post(`/api/runs/${id}/approval`, {
    headers: origin,
    data: { version, optionId, decision, note: "" },
  });
}
test("real D1 + Workflow: requires approval, resumes and creates exactly one reservation on duplicate delivery", async ({
  request,
}) => {
  const id = await start(request, "part-1");
  const waiting = await until(request, id, "awaiting_approval");
  expect(waiting.run).not.toHaveProperty("session_id");
  expect(waiting.reservation).toBeNull();
  expect(waiting.data.partStock).toBe(2);
  const [a, b] = await Promise.all([
    approve(request, id),
    approve(request, id),
  ]);
  expect(a.status()).toBe(200);
  expect(b.status()).toBe(200);
  const done = await until(request, id, "completed");
  expect(done.data.partStock).toBe(1);
  expect(done.reservation?.verified).toBe(1);
  expect(done.approvals).toHaveLength(1);
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/runs/${id}/runtime`)).json()).status,
    )
    .toBe("complete");
  const repeated = await approve(request, id);
  expect(repeated.status()).toBe(200);
  expect((await detail(request, id)).data.partStock).toBe(1);
});
test("stale approval never executes: stock drift requires a second approval", async ({
  request,
}) => {
  const id = await start(request, "changed-1");
  await until(request, id, "awaiting_approval");
  expect((await approve(request, id)).status()).toBe(200);
  const changed = await until(request, id, "awaiting_approval", 2);
  expect(changed.reservation).toBeNull();
  expect(changed.plan?.optionId).toBe("part-alternate");
  expect((await approve(request, id, 1, "part-local")).status()).toBe(409);
  expect((await approve(request, id, 2, "part-alternate")).status()).toBe(200);
  const done = await until(request, id, "completed", 2);
  expect(done.data.alternateStock).toBe(0);
  expect(done.data.partStock).toBe(0);
});
test("rejecting the proposal has no write side effect", async ({ request }) => {
  const id = await start(request, "part-1");
  await until(request, id, "awaiting_approval");
  expect((await approve(request, id, 1, "part-local", "reject")).status()).toBe(
    200,
  );
  const done = await until(request, id, "rejected");
  expect(done.reservation).toBeNull();
  expect(done.data.partStock).toBe(2);
});
test("operator edits are validated and the selected action is verified", async ({
  request,
}) => {
  const id = await start(request, "part-1");
  await until(request, id, "awaiting_approval");
  expect(
    (await approve(request, id, 1, "part-alternate", "edit")).status(),
  ).toBe(409);
  expect((await approve(request, id, 1, "vehicle", "approve")).status()).toBe(
    409,
  );
  expect((await approve(request, id, 1, "vehicle", "edit")).status()).toBe(200);
  const done = await until(request, id, "completed");
  expect(done.data.partStock).toBe(2);
  expect(done.data.vehicleStock).toBe(0);
  expect(done.approvals[0].decision).toBe("edit");
  expect(done.reservation?.option_id).toBe("vehicle");
});
test("transient tool timeout is recorded and recovers", async ({ request }) => {
  const id = await start(request, "timeout-1");
  const d = await until(request, id, "awaiting_approval");
  expect(d.events.filter((e) => e.kind === "tool_error")).toHaveLength(1);
  expect(
    d.events.some(
      (e) =>
        e.kind === "tool_success" &&
        JSON.parse(e.detail_json).tool === "get_inventory",
    ),
  ).toBe(true);
  await approve(request, id, 1, "part-local", "reject");
});
test("missing identity asks for information without reserving", async ({
  request,
}) => {
  const id = await start(request, "missing-1");
  const d = await until(request, id, "needs_info");
  expect(d.reservation).toBeNull();
  expect(d.run.verified).toBe(1);
});
test("other sessions cannot read or approve and cross-origin posts fail", async ({
  request,
  playwright,
}) => {
  const id = await start(request, "part-1");
  await until(request, id, "awaiting_approval");
  const other = await playwright.request.newContext({
    baseURL: "http://localhost:8790",
  });
  await other.get("/api/bootstrap");
  expect((await other.get(`/api/runs/${id}`)).status()).toBe(404);
  expect((await approve(other, id)).status()).toBe(404);
  expect(
    (
      await request.post(`/api/runs/${id}/approval`, {
        headers: { ...origin, Origin: "https://attacker.invalid" },
        data: { version: 1, decision: "approve", optionId: "part-local" },
      })
    ).status(),
  ).toBe(403);
  await other.dispose();
  await approve(request, id, 1, "part-local", "reject");
});
test("Turkish responsive UI and PWA shell", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Her kararın arkasını görün." }),
  ).toBeVisible();
  expect(await page.locator("html").getAttribute("lang")).toBe("tr");
  await page.screenshot({
    path: "docs/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/dashboard-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Yeni vaka başlat", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Vakayı başlat", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Onayla ve uygula" }),
  ).toBeVisible({ timeout: 55000 });
  await page.screenshot({
    path: "docs/screenshots/approval-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Öneriyi reddet" }).click();
  await expect(
    page.getByText("Öneri reddedildi; rezervasyon yapılmadı."),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.lang).toBe("tr");
  expect(manifest.icons).toHaveLength(3);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText(/Bağlantı yok/)).toBeVisible();
  const cached = await page.evaluate(async () => {
    const all = await caches.keys();
    const urls = await Promise.all(
      all.map(async (k) =>
        (await (await caches.open(k)).keys()).map((r) => r.url),
      ),
    );
    return urls.flat();
  });
  expect(cached.some((u) => u.includes("/api/"))).toBe(false);
  await page.context().setOffline(false);
  expect(errors).toEqual([]);
});

test("dashboard WCAG AA automated checks", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Her kararın arkasını görün." }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});
