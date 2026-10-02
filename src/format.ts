export const money = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 3,
        maximumFractionDigits: 4,
      }).format(n);
export const percent = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("tr-TR", {
        style: "percent",
        maximumFractionDigits: 0,
      }).format(n);
export const duration = (n: number | null) =>
  n === null
    ? "—"
    : n >= 60000
      ? `${(n / 60000).toFixed(1).replace(".", ",")} dk`
      : `${(n / 1000).toFixed(1).replace(".", ",")} sn`;
export const date = (n: number) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(n);
