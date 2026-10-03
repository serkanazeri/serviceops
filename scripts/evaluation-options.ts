import { parseArgs } from "node:util";

export function evaluationOptions(args: string[]) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      url: { type: "string", default: "http://localhost:8788" },
      limit: { type: "string", default: "40" },
      split: { type: "string", default: "all" },
      publish: { type: "boolean", default: false },
    },
  });
  const target = new URL(values.url!);
  if (
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/" ||
    (target.protocol !== "https:" &&
      !["http://localhost:8788", "http://127.0.0.1:8788"].includes(
        target.origin,
      ))
  )
    throw new Error(
      "Use an HTTPS origin, or localhost:8788, without credentials, path or query.",
    );
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 40)
    throw new Error("--limit must be an integer between 1 and 40.");
  if (!["all", "development", "holdout"].includes(values.split!))
    throw new Error("--split must be all, development or holdout.");
  if (values.publish && (limit !== 40 || values.split !== "all"))
    throw new Error(
      "--publish requires the complete 40-case dataset (--split all --limit 40).",
    );
  return {
    base: target.origin,
    limit,
    split: values.split!,
    publish: values.publish,
  };
}
