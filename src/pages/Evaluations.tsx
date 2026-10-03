import { useEffect, useState } from "react";
import {
  BookOpen,
  FlaskConical,
  FileCheck2,
  ShieldCheck,
  Download,
  BarChart3,
} from "lucide-react";
import { ErrorBox, Skeleton, Stat } from "../components";
import { date, percent, money, duration } from "../format";
import type { LiveReport } from "../../shared/evaluation-report";
import type { EvalReport } from "../types";
import { optionLabels, type OptionId } from "../../shared/presentation";
export default function Evaluations() {
  const [live, setLive] = useState<LiveReport | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/live-evaluation.json", { signal: c.signal })
      .then((r) => r.json())
      .then((d) => {
        const report = d as LiveReport;
        if (report.kind === "live-agent-evaluation") setLive(report);
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  const [report, setReport] = useState<EvalReport | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/evaluation.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Değerlendirme raporu henüz oluşturulmadı.");
        return r.json() as Promise<EvalReport>;
      })
      .then(setReport)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KALİTE LABORATUVARI</span>
          <h1>Başarıyı tanımlayın. Sonra ölçün.</h1>
          <p>
            Sürümlenmiş senaryolar, açık başarı ölçütleri ve tekrarlanabilir
            kontroller.
          </p>
        </div>
        <a
          className="button secondary"
          href="https://github.com/serkanazeri/serviceops/blob/main/docs/evaluation.md"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen size={17} /> Yöntemi incele
        </a>
      </div>
      <div className="notice">
        <FlaskConical size={19} />
        <span>
          Aşağıdaki rapor deterministik iş kuralları testidir. Canlı model
          doğruluğunu ölçmez. Canlı değerlendirme ayrı raporlanır.
        </span>
      </div>
      <ErrorBox message={error} />
      {report ? (
        <>
          <div className="stat-grid three">
            <Stat
              icon={FileCheck2}
              label="Politika sözleşmeleri"
              value={`${report.passed}/${report.total}`}
              sub="Kaynak okuma, öneri ve işlem sonrası kontrol"
              accent="blue"
            />
            <Stat
              icon={FlaskConical}
              label="Ayrılmış senaryolar"
              value={`${report.split.holdout.passed}/${report.split.holdout.total}`}
              sub="Prompt geliştirmesinden ayrı tutulan varyantlar"
            />
            <Stat
              icon={ShieldCheck}
              label="Canlı model değerlendirmesi"
              value={live ? percent(live.passed / live.total) : "Ölçülmedi"}
              sub={
                live
                  ? `${live.passed}/${live.total} canlı vaka · Ayrılmış: ${live.split.holdout.passed}/${live.split.holdout.total}`
                  : "Bu rapor LLM başarısı için kanıt değildir."
              }
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Senaryo sonuçları</h3>
                <p>
                  {report.dataset} · {date(Date.parse(report.generatedAt))}
                </p>
              </div>
              <a className="text-link" href="/evaluation.json" download>
                <Download size={16} />
                JSON
              </a>
            </div>
            <div className="table-scroll">
              <table className="evaluation-table">
                <thead>
                  <tr>
                    <th>Senaryo</th>
                    <th>Grup</th>
                    <th>Beklenen sonuç</th>
                    <th>Kontrol</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.id}</code>
                      </td>
                      <td>
                        {r.split === "holdout" ? "Ayrılmış test" : "Geliştirme"}
                      </td>
                      <td>{optionLabels[r.expected as OptionId]}</td>
                      <td>
                        <span
                          className={`status ${r.passed ? "status-completed" : "status-failed"}`}
                        >
                          <i />
                          {r.passed ? "Geçti" : "Başarısız"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        !error && <Skeleton />
      )}
      {live && (
        <section className="panel live-report">
          <div className="panel-heading">
            <div>
              <h3>Canlı model değerlendirmesi</h3>
              <p>
                {live.model} · {date(Date.parse(live.generatedAt))} ·{" "}
                {live.prompt}
              </p>
            </div>
            <a className="text-link" href="/live-evaluation.json" download>
              <Download size={16} />
              JSON
            </a>
          </div>
          <div className="table-scroll">
            <table className="evaluation-table">
              <thead>
                <tr>
                  <th>Vaka</th>
                  <th>Sonuç</th>
                  <th>Süre</th>
                  <th>Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {live.results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>
                      {r.passed
                        ? "Geçti"
                        : (r.error ?? "Beklenen sonuç alınamadı")}
                    </td>
                    <td>{duration(r.latencyMs)}</td>
                    <td>{money(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="data-note">
            Sentetik vakalar · Otomatik politika kontrolü · İnsan dil
            değerlendirmesi yapılmadı.
          </p>
        </section>
      )}
      <div className="method-cards">
        <section className="panel">
          <ShieldCheck size={24} />
          <h3>Kontroller sürümü korur</h3>
          <p>
            Onaysız işlem, eski plan onayı, mükerrer rezervasyon ve oturum
            izolasyonu ayrıca uçtan uca test edilir.
          </p>
        </section>
        <section className="panel">
          <BarChart3 size={24} />
          <h3>Ölçümün sınırı açık</h3>
          <p>
            Sentetik senaryolardan elde edilen sonuçlar gerçek müşteri
            verisindeki başarıyı garanti etmez. Manuel zaman tasarrufu henüz
            ölçülmedi.
          </p>
        </section>
      </div>
    </>
  );
}
