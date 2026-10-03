import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  Clock3,
  BarChart3,
  Code2,
  FileCheck2,
  LoaderCircle,
  CheckCheck,
  AlertTriangle,
  Check,
  Sparkles,
  ShieldCheck,
  Search,
} from "lucide-react";
import { api, useData } from "../api";
import { ErrorBox, Skeleton, Status, Empty } from "../components";
import { money, duration, date } from "../format";
import type { RunDetail } from "../../shared/types";
import {
  optionLabels,
  statusLabels,
  terminalStatuses,
  type OptionId,
} from "../../shared/presentation";
export default function CaseDetail({
  id,
  offline,
}: {
  id: string;
  offline: boolean;
}) {
  const { data, error, refresh } = useData<RunDetail>(
    `/runs/${id}`,
    2500,
    (d) => terminalStatuses.includes(d.run.status),
  );
  const [selected, setSelected] = useState<OptionId | null>(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  useEffect(() => {
    setSelected(null);
    setNote("");
    setActionError("");
  }, [data?.run.plan_version]);
  if (!data)
    return (
      <>
        <ErrorBox message={error} />
        <Skeleton />
      </>
    );
  const { run, plan } = data;
  const option = selected ?? plan?.optionId ?? "handoff";
  const saved = data.approvals.find((a) => a.plan_version === run.plan_version);
  async function decide(reject = false) {
    if (!plan) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/runs/${id}/approval`, {
        method: "POST",
        body: JSON.stringify({
          version: run.plan_version,
          decision: reject
            ? "reject"
            : option !== plan.optionId || note.trim()
              ? "edit"
              : "approve",
          optionId: option,
          note: note.trim(),
        }),
      });
      refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const totalCost = data.calls.some((c) => c.cost !== null)
    ? data.calls.reduce((n, c) => n + (c.cost ?? 0), 0)
    : null;
  return (
    <>
      <a className="back-link" href="#cases">
        <ArrowDownLeft size={16} /> Vakalara dön
      </a>
      <div className="page-heading detail-heading">
        <div>
          <span className="eyebrow">VAKA / {id.slice(0, 8).toUpperCase()}</span>
          <h1>{run.title}</h1>
          <p>
            {data.data.customer} · {data.data.vehicle} · {date(run.created_at)}
          </p>
        </div>
        <Status status={run.status} />
      </div>
      <ErrorBox message={error} />
      <div className="case-stats">
        <span>
          <Clock3 size={16} />
          {duration(
            run.finished_at ? run.finished_at - run.created_at : null,
          )}{" "}
          toplam
        </span>
        <span>
          <BarChart3 size={16} />
          {money(totalCost)}{" "}
          {data.calls.some((c) => c.cost === null) ? "(eksik maliyet)" : ""}
        </span>
        <span>
          <Code2 size={16} />
          {run.mode === "live" ? run.model : "Yerel test sağlayıcısı"}
        </span>
        <span>
          <FileCheck2 size={16} />
          {run.plan_version ? `Plan v${run.plan_version}` : "Henüz plan yok"}
        </span>
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Yürütme günlüğü</h3>
                <p>Kaynaklar, araçlar ve doğrulanan sonuçlar</p>
              </div>
              {!terminalStatuses.includes(run.status) && (
                <LoaderCircle className="spin" size={18} />
              )}
            </div>
            <ol className="timeline">
              {data.events.map((e, i) => (
                <li key={e.id} className={`event-${e.kind}`}>
                  <span className="timeline-dot">
                    {e.kind === "verified" ? (
                      <CheckCheck size={15} />
                    ) : e.kind === "tool_error" || e.kind === "failed" ? (
                      <AlertTriangle size={14} />
                    ) : (
                      <Check size={13} />
                    )}
                  </span>
                  <div className="event-heading">
                    <strong>{e.label}</strong>
                    <time>
                      {new Date(e.created_at).toLocaleTimeString("tr-TR")}
                    </time>
                  </div>
                  <span className="event-index">
                    ADIM {String(i + 1).padStart(2, "0")}
                    {e.duration_ms !== null
                      ? ` · ${duration(e.duration_ms)}`
                      : ""}
                  </span>
                  {e.detail_json !== "{}" && (
                    <details>
                      <summary>Kaydı incele</summary>
                      <pre>
                        {JSON.stringify(JSON.parse(e.detail_json), null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
            {!data.events.length && <Skeleton />}
          </section>
          <details className="panel raw-details">
            <summary>Model çağrıları · {data.calls.length} deneme</summary>
            {data.calls.length ? (
              data.calls.map((c) => (
                <div className="call-row" key={c.id}>
                  <strong>{c.provider ?? "Sağlayıcı bilgisi yok"}</strong>
                  <span>
                    {c.status === "success"
                      ? "Başarılı"
                      : c.status === "pending"
                        ? "Sürüyor"
                        : "Hata"}{" "}
                    · {duration(c.duration_ms)} · {money(c.cost)}
                  </span>
                  <small>
                    {c.input_tokens ?? "—"} giriş / {c.output_tokens ?? "—"}{" "}
                    çıkış tokenı · {c.error_code ?? "Hata yok"}
                  </small>
                </div>
              ))
            ) : (
              <p>Bu çalışmada gerçek model çağrısı kaydedilmedi.</p>
            )}
          </details>
        </div>
        <div className="detail-side">
          <section className="panel plan-panel">
            <div className="panel-heading">
              <div className="inline-icon">
                <Sparkles size={18} />
                <h3>Çözüm önerisi</h3>
              </div>
              <span className="pill">v{run.plan_version || 1}</span>
            </div>
            {plan ? (
              <div className="plan-body">
                <span className="proposal-label">ÖNERİLEN İŞLEM</span>
                <h2>{optionLabels[plan.optionId]}</h2>
                <p>{plan.summary}</p>
                <div className="evidence-tags">
                  {plan.evidenceIds.map((e) => (
                    <span key={e}>
                      <FileCheck2 size={12} />
                      {
                        {
                          case: "Servis kaydı",
                          inventory: "Stok kaydı",
                          policy: "Şirket politikası",
                        }[e]
                      }
                    </span>
                  ))}
                </div>
                <div className="message-draft">
                  <span>MÜŞTERİ MESAJI TASLAĞI</span>
                  <p>{plan.customerMessage}</p>
                  <small>Taslak · Müşteriye gönderilmez</small>
                </div>
                {run.status === "awaiting_approval" && !saved ? (
                  <div className="approval-form">
                    <label htmlFor="action">Uygulanacak işlem</label>
                    <select
                      id="action"
                      value={option}
                      onChange={(e) => setSelected(e.target.value as OptionId)}
                    >
                      {data.options.map((o) => (
                        <option key={o} value={o}>
                          {optionLabels[o as OptionId]}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="note">
                      Operatör notu <span>(isteğe bağlı)</span>
                    </label>
                    <textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={500}
                      placeholder="Kararınıza kısa bir not ekleyin."
                    />
                    <p className="approval-info">
                      <ShieldCheck size={15} /> Bu onay yalnızca planın mevcut
                      sürümü için geçerlidir.
                    </p>
                    <ErrorBox message={actionError} />
                    <button
                      className="button primary full"
                      disabled={busy || offline}
                      onClick={() => void decide()}
                    >
                      {busy ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <Check size={17} />
                      )}{" "}
                      {option !== plan.optionId || note.trim()
                        ? "Düzenleyerek onayla"
                        : "Onayla ve uygula"}
                    </button>
                    <button
                      className="button ghost full"
                      disabled={busy || offline}
                      onClick={() => void decide(true)}
                    >
                      Öneriyi reddet
                    </button>
                  </div>
                ) : saved && run.status === "awaiting_approval" ? (
                  <div className="notice">
                    <LoaderCircle className="spin" size={17} /> Karar
                    kaydedildi. Akış devam ediyor.
                  </div>
                ) : (
                  <div className="outcome">
                    <CheckCheck size={20} />
                    <span>
                      {run.status === "completed"
                        ? "Rezervasyon ve stok değişikliği doğrulandı."
                        : run.status === "rejected"
                          ? "Öneri reddedildi; rezervasyon yapılmadı."
                          : run.status === "needs_info"
                            ? "Şasi bilgisi gerekiyor. Bilgi tamamlandığında yeni vaka başlatılabilir."
                            : run.status === "handed_off"
                              ? "Uzman incelemesi gerekiyor; rezervasyon yapılmadı."
                              : statusLabels[run.status]}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Empty
                title={
                  run.status === "failed"
                    ? "Öneri oluşturulamadı"
                    : "Kaynaklar inceleniyor"
                }
                icon={run.status === "failed" ? AlertTriangle : Search}
              >
                {run.status === "failed"
                  ? "Akış durdu. Hata ayrıntılarını yürütme günlüğünden inceleyebilirsiniz."
                  : "Öneri hazır olduğunda kanıtlarıyla birlikte burada görünecek."}
              </Empty>
            )}
          </section>
          <section className="panel context-panel">
            <h3>Vaka bağlamı</h3>
            <dl>
              <div>
                <dt>Gecikme</dt>
                <dd>{data.data.delayDays} gün</dd>
              </div>
              <div>
                <dt>Garanti</dt>
                <dd>
                  {data.data.warranty ? "Kapsam dahilinde" : "Kapsam dışında"}
                </dd>
              </div>
              <div>
                <dt>Merkez / alternatif stok</dt>
                <dd>
                  {data.data.partStock} / {data.data.alternateStock}
                </dd>
              </div>
              <div>
                <dt>İkame araç stoğu</dt>
                <dd>{data.data.vehicleStock}</dd>
              </div>
              <div>
                <dt>Kayıt sürümü</dt>
                <dd>v{data.data.version}</dd>
              </div>
            </dl>
          </section>
          {run.error_code && (
            <ErrorBox
              message={`Akış durduruldu: ${run.error_code}. Günlükteki kayıtları inceleyebilirsiniz.`}
            />
          )}
        </div>
      </div>
    </>
  );
}
