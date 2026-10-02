import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
type Booking = {
  amount: number;
  settled: boolean;
  day: string;
  month: string;
  source: string;
  created: number;
};
export class BudgetGuard extends DurableObject<Env> {
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const now = Date.now(),
      day = new Date(now).toISOString().slice(0, 10),
      month = day.slice(0, 7);
    const b = (await request.json()) as {
      id?: string;
      amount?: number;
      source?: string;
      session?: string;
      ip?: string;
    };
    const limits = {
      daily: Number(this.env.DAILY_BUDGET_USD),
      monthly: Number(this.env.MONTHLY_BUDGET_USD),
      evaluation: Number(this.env.EVAL_BUDGET_USD),
    };
    if (Object.values(limits).some((v) => !Number.isFinite(v) || v <= 0))
      return Response.json(
        { error: "BUDGET_CONFIGURATION_INVALID" },
        { status: 503 },
      );
    return this.ctx.storage.transaction(async (tx) => {
      const daily = (await tx.get<number>(`spend:${day}`)) ?? 0,
        monthly = (await tx.get<number>(`spend:${month}`)) ?? 0,
        evaluation = (await tx.get<number>("spend:evaluation")) ?? 0;
      if (path === "/status")
        return Response.json({
          daily,
          monthly,
          evaluation,
          limits,
          includesReservations: true,
        });
      if (path === "/admit") {
        const keys =
          b.source === "evaluation"
            ? [`eval:${day}`]
            : [
                `ip:${day}:${b.ip}`,
                `session:${day}:${b.session}`,
                `total:${day}`,
              ];
        const maxima = b.source === "evaluation" ? [150] : [20, 10, 50];
        const counts = await Promise.all(
          keys.map(async (key) => (await tx.get<number>(key)) ?? 0),
        );
        if (counts.some((count, i) => count >= maxima[i]))
          return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
        await Promise.all(keys.map((key, i) => tx.put(key, counts[i] + 1)));
        return Response.json({ ok: true });
      }
      if (!b.id || !Number.isFinite(b.amount) || b.amount! < 0)
        return Response.json(
          { error: "INVALID_BUDGET_REQUEST" },
          { status: 400 },
        );
      const key = `booking:${b.id}`,
        existing = await tx.get<Booking>(key);
      if (path === "/reserve") {
        if (existing) return Response.json({ ok: true });
        if (
          b.amount! > 0.01 ||
          daily + b.amount! > limits.daily ||
          monthly + b.amount! > limits.monthly ||
          (b.source === "evaluation" &&
            evaluation + b.amount! > limits.evaluation)
        )
          return Response.json({ error: "BUDGET_EXCEEDED" }, { status: 429 });
        await tx.put(key, {
          amount: b.amount,
          settled: false,
          day,
          month,
          source: b.source,
          created: now,
        });
        await tx.put(`spend:${day}`, daily + b.amount!);
        await tx.put(`spend:${month}`, monthly + b.amount!);
        if (b.source === "evaluation")
          await tx.put("spend:evaluation", evaluation + b.amount!);
        return Response.json({ ok: true });
      }
      if (path === "/settle" && existing) {
        if (existing.settled) return Response.json({ ok: true });
        const delta = b.amount! - existing.amount;
        for (const period of [existing.day, existing.month])
          await tx.put(
            `spend:${period}`,
            Math.max(
              0,
              ((await tx.get<number>(`spend:${period}`)) ?? 0) + delta,
            ),
          );
        if (existing.source === "evaluation")
          await tx.put("spend:evaluation", Math.max(0, evaluation + delta));
        await tx.put(key, { ...existing, amount: b.amount!, settled: true });
        return Response.json({ ok: true });
      }
      return Response.json(
        { error: "INVALID_BUDGET_REQUEST" },
        { status: 400 },
      );
    });
  }
}
