export const optionIds = [
  "part-local",
  "part-alternate",
  "vehicle",
  "handoff",
  "clarify",
] as const;
export type OptionId = (typeof optionIds)[number];
export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "handed_off"
  | "needs_info"
  | "rejected"
  | "failed"
  | "expired";
export const terminalStatuses: RunStatus[] = [
  "completed",
  "handed_off",
  "needs_info",
  "rejected",
  "failed",
  "expired",
];
export const statusLabels: Record<RunStatus, string> = {
  queued: "Sırada",
  running: "İnceleniyor",
  awaiting_approval: "Onay bekliyor",
  executing: "Uygulanıyor",
  completed: "Tamamlandı",
  handed_off: "Uzmana devredildi",
  needs_info: "Bilgi gerekiyor",
  rejected: "Reddedildi",
  failed: "İşlem başarısız",
  expired: "Onay süresi doldu",
};
export const optionLabels: Record<OptionId, string> = {
  "part-local": "Merkezden parça ayır",
  "part-alternate": "Alternatif şubeden parça ayır",
  vehicle: "İkame araç ayır",
  handoff: "Servis uzmanına devret",
  clarify: "Eksik bilgiyi iste",
};
