import { describe, expect, it } from "vitest";
import { evaluationOptions } from "../scripts/evaluation-options";

describe("Live evaluation inputs", () => {
  it.each(["0", "-1", "NaN", "Infinity", "2.5", "41"])(
    "rejects invalid sample size %s before any paid call",
    (limit) => {
      expect(() => evaluationOptions(["--limit", limit])).toThrow("--limit");
    },
  );
  it("does not publish a small smoke sample as the full benchmark", () => {
    expect(() => evaluationOptions(["--limit", "1", "--publish"])).toThrow(
      "complete 40-case",
    );
    expect(() =>
      evaluationOptions(["--split", "holdout", "--publish"]),
    ).toThrow("complete 40-case");
  });
  it("rejects misspelled splits instead of evaluating an unintended cohort", () => {
    expect(() => evaluationOptions(["--split", "heldout"])).toThrow("--split");
  });
  it.each([
    "http://example.com",
    "https://demo.example/?token=x",
    "https://u:p@demo.example",
    "https://demo.example/api",
  ])("does not send the evaluation secret to invalid target %s", (url) => {
    expect(() => evaluationOptions(["--url", url])).toThrow("HTTPS origin");
  });
  it("supports a complete remote benchmark and local development-only smoke run", () => {
    expect(
      evaluationOptions(["--url", "https://demo.example/", "--publish"]),
    ).toEqual({
      base: "https://demo.example",
      limit: 40,
      split: "all",
      publish: true,
    });
    expect(
      evaluationOptions(["--split", "development", "--limit", "2"]).split,
    ).toBe("development");
  });
});
