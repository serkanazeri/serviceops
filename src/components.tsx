import { useEffect, useRef, type ReactNode } from "react";
import {
  Workflow,
  AlertTriangle,
  LoaderCircle,
  X,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import { statusLabels, type RunStatus } from "../shared/presentation";
import type { PublicRun } from "../shared/types";
import { date } from "./format";
export function Status({ status }: { status: RunStatus }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
export function Empty({
  title,
  children,
  icon: Icon = Workflow,
}: {
  title: string;
  children: ReactNode;
  icon?: typeof Workflow;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={24} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="error">
      <AlertTriangle size={17} />
      {message}
    </div>
  ) : null;
}
export function Skeleton() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} /> Veriler yükleniyor…
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">SERVICEOPS / ÇALIŞMA ALANI</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Kapat">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent = "neutral",
}: {
  icon: typeof Workflow;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <section className={`stat-card ${accent}`}>
      <div className="stat-label">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong className="stat-value">{value}</strong>
      <p>{sub}</p>
    </section>
  );
}
export function QualityRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="quality-row">
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <span>{value}</span>
    </div>
  );
}
export function RunList({ runs }: { runs: PublicRun[] }) {
  return !runs.length ? (
    <Empty title="Henüz bir vaka başlatılmadı">
      Örnek bir senaryo seçin. Agentın kararlarını ve sonuçlarını burada
      izleyin.
    </Empty>
  ) : (
    <div className="run-list">
      {runs.map((run) => (
        <a className="run-row" key={run.id} href={`#case/${run.id}`}>
          <span
            className={`run-icon ${run.status === "completed" ? "done" : ""}`}
          >
            {run.status === "completed" ? (
              <CheckCheck size={20} />
            ) : (
              <Workflow size={20} />
            )}
          </span>
          <div className="run-info">
            <strong>{run.title}</strong>
            <small>
              {run.id.slice(0, 8).toUpperCase()} <span>·</span>{" "}
              {date(run.created_at)} <span>·</span>{" "}
              {run.mode === "live" ? "Canlı model" : "Yerel test"}
            </small>
          </div>
          <Status status={run.status} />
          <ChevronRight className="row-chevron" size={17} />
        </a>
      ))}
    </div>
  );
}
