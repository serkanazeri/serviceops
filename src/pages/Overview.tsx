import { useState } from "react";
import {
  Plus,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
  Search,
  CircleHelp,
  FileCheck2,
  Clock3,
  BarChart3,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { useData } from "../api";
import { Stat, QualityRow, RunList, ErrorBox, Modal } from "../components";
import { money, percent, duration, date } from "../format";
import type { Bootstrap, MetricResponse } from "../types";
import type { PublicRun } from "../../shared/types";
export default function Overview({
  boot,
  onNew,
}: {
  boot: Bootstrap;
  onNew: () => void;
}) {
  const [days, setDays] = useState(7),
    [mode, setMode] = useState(boot.mode),
    [glossary, setGlossary] = useState(false);
  const { data, error } = useData<MetricResponse>(
    `/metrics?days=${days}&mode=${mode}`,
    5000,
  );
  const runs = useData<{ runs: PublicRun[] }>("/runs", 5000);
  const m = data?.metrics;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <span className="tiny-line" /> OPERASYON GÖRÜNÜRLÜĞÜ
          </span>
          <h1>Her kararın arkasını görün.</h1>
          <p>Agent performansı, insan katkısı ve iş sonuçları aynı yerde.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={18} /> Yeni vaka başlat
        </button>
      </div>
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="hero-tag">
            <Sparkles size={13} /> İNSAN ONAYLI AI İŞ AKIŞI
          </span>
          <h2>
            Bir talepten,
            <br />
            doğrulanmış çözüme.
          </h2>
          <p>
            Agent kaynakları inceler, bir çözüm önerir.
            <br />
            Siz onaylarsınız; sonuç kaynaktan doğrulanır.
          </p>
          <button onClick={onNew} className="text-link light">
            Örnek bir vakayı çalıştır <ArrowRight size={17} />
          </button>
        </div>
        <div
          className="flow-preview"
          aria-label="İş akışı: İncele, planla, onayla, doğrula"
        >
          <div className="flow-topline">
            <span>VAKA YAŞAM DÖNGÜSÜ</span>
            <span>
              <i /> İzlenebilir akış
            </span>
          </div>
          <div className="flow-nodes">
            {[
              { icon: Search, label: "İncele", detail: "3 veri kaynağı" },
              { icon: Sparkles, label: "Planla", detail: "Kanıtlı öneri" },
              { icon: ShieldCheck, label: "Onayla", detail: "Kontrol sizde" },
              { icon: CheckCheck, label: "Doğrula", detail: "Sonuç kontrolü" },
            ].map(({ icon: Icon, label, detail }, i) => (
              <div className={`flow-node node-${i}`} key={label}>
                <span className="flow-icon">
                  <Icon size={21} />
                </span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <div className="flow-bottom">
            <ShieldCheck size={14} />
            <span>Onay olmadan rezervasyon yapılmaz.</span>
            <span className="flow-number">01 — 04</span>
          </div>
        </div>
      </div>
      <div className="section-toolbar">
        <div>
          <h2>Operasyon özeti</h2>
          <span className="scope-label">
            Yalnızca sizin oturumunuz · {data?.scope.sampled ?? 0} çalışma
          </span>
        </div>
        <div className="filters">
          <button
            className="icon-button"
            onClick={() => setGlossary(true)}
            title="Metrikler nasıl hesaplanıyor?"
            aria-label="Metrik açıklamaları"
          >
            <CircleHelp size={18} />
          </button>
          <select
            aria-label="Çalışma türü"
            value={mode}
            onChange={(e) => setMode(e.target.value as "live" | "fixture")}
          >
            <option value="live">Canlı model</option>
            <option value="fixture">Yerel test</option>
          </select>
          <select
            aria-label="Zaman aralığı"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
          </select>
        </div>
      </div>
      <ErrorBox message={error} />
      {data?.scope.truncated && (
        <div className="notice">
          Son 500 çalışma gösteriliyor. Toplam {data.scope.total} çalışma var.
        </div>
      )}
      <div className="stat-grid">
        <Stat
          icon={FileCheck2}
          label="Doğrulanmış sonuç"
          value={percent(m?.verifiedRate ?? null)}
          sub={`${m?.verified ?? 0} doğru / ${m?.evaluated ?? 0} değerlendirilen vaka`}
          accent="blue"
        />
        <Stat
          icon={Clock3}
          label="Aktif işlem süresi"
          value={duration(m?.latency.activeP50 ?? null)}
          sub={`Medyan · İnsan bekleme süresi hariç · n=${m?.latency.sample ?? 0}`}
        />
        <Stat
          icon={BarChart3}
          label="Model maliyeti"
          value={money(m?.cost.reported ?? null)}
          sub={
            m?.model.attempts
              ? `${m.model.attempts} çağrı · Maliyet kapsamı ${percent(m.cost.coverage)}`
              : "Henüz ölçülmüş model çağrısı yok"
          }
        />
        <Stat
          icon={ShieldCheck}
          label="Onay bekleyen"
          value={String(m?.awaiting ?? 0).padStart(2, "0")}
          sub={
            m?.awaiting
              ? `En eski bekleme ${duration(m.oldestApprovalMs)}`
              : "İşlem öncesi son kontrol sizde"
          }
          accent="amber"
        />
      </div>
      <div className="analysis-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>İş akışı hareketliliği</h3>
              <p>Başlatılan vakalar ve doğrulanmış sonuçları</p>
            </div>
            <span className="pill">Son 7 gün · UTC</span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-all" />
              Başlatılan
            </span>
            <span>
              <i className="legend-done" />
              Doğrulanan
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={
              m?.total
                ? `Son yedi gün içinde ${m.series.reduce((s, d) => s + d.total, 0)} vaka başlatıldı.`
                : "Grafikte henüz veri yok."
            }
          >
            {(
              m?.series ??
              Array.from({ length: 7 }, (_, i) => ({
                day: new Date(Date.now() - (6 - i) * 86400000)
                  .toISOString()
                  .slice(0, 10),
                total: 0,
                completed: 0,
              }))
            ).map((d) => {
              const max = Math.max(
                1,
                ...(m?.series.map((s) => s.total) ?? [1]),
              );
              return (
                <div className="chart-column" key={d.day}>
                  <div className="bar-track">
                    <span
                      title={`${d.total} başlatılan`}
                      className="bar-all"
                      style={{ height: `${(d.total / max) * 100}%` }}
                    />
                    <span
                      title={`${d.completed} doğrulanan`}
                      className="bar-done"
                      style={{ height: `${(d.completed / max) * 100}%` }}
                    />
                  </div>
                  <span>
                    {new Date(`${d.day}T12:00:00Z`).toLocaleDateString(
                      "tr-TR",
                      { weekday: "short" },
                    )}
                  </span>
                </div>
              );
            })}
            {!m?.total && (
              <span className="chart-empty">İlk vakanızla ölçüm başlar.</span>
            )}
          </div>
          <details className="chart-table">
            <summary>Grafiği tablo olarak göster</summary>
            <table>
              <thead>
                <tr>
                  <th>Gün</th>
                  <th>Başlatılan</th>
                  <th>Doğrulanan</th>
                </tr>
              </thead>
              <tbody>
                {m?.series.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.total}</td>
                    <td>{d.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
        <section className="panel quality-panel">
          <div className="panel-heading">
            <div>
              <h3>Kontrol noktaları</h3>
              <p>Kalite ve güvenilirlik birlikte</p>
            </div>
            <ShieldCheck size={21} />
          </div>
          <QualityRow
            label="Araç çağrısı başarısı"
            value={percent(m?.tools.successRate ?? null)}
            detail={`${m?.tools.attempts ?? 0} deneme · ${m?.tools.errors ?? 0} hata`}
          />
          <QualityRow
            label="Model hatası"
            value={percent(m?.model.errorRate ?? null)}
            detail={`${m?.model.errors ?? 0} hata / ${m?.model.attempts ?? 0} çağrı`}
          />
          <QualityRow
            label="Düzenlenen öneri"
            value={String(m?.approvals.edited ?? 0)}
            detail={`${m?.approvals.total ?? 0} insan kararı içinde`}
          />
          <div className="quality-note">
            <span className="mini-icon">
              <BookOpen size={16} />
            </span>
            <p>
              Doğru bir devir de başarılı sonuçtur. Rezervasyon sayısını ayrıca
              ölçeriz.
            </p>
          </div>
        </section>
      </div>
      {m && (
        <details className="panel metric-details">
          <summary>
            Detaylı mühendislik ölçümleri{" "}
            <span>
              {m.total} vaka · {m.evaluated} değerlendirilen
            </span>
          </summary>
          <div className="metric-detail-grid">
            <div>
              <QualityRow
                label="Rezervasyon / sonlanan akış"
                value={`${m.completed} / ${m.terminal}`}
                detail={`Değerlendirme kapsamı ${percent(m.total ? m.evaluated / m.total : null)}`}
              />
              <QualityRow
                label="Aktif süre p95"
                value={duration(m.latency.activeP95)}
                detail={`n=${m.latency.sample} · İnsan bekleme süresi hariç`}
              />
              <QualityRow
                label="Toplam süre p95"
                value={duration(m.latency.totalP95)}
                detail={`Onay bekleme medyanı ${duration(m.latency.waitP50)}`}
              />
              <QualityRow
                label="Model gecikmesi p95"
                value={duration(m.model.p95)}
                detail={`${m.model.attempts} deneme · ${m.model.timeouts} timeout`}
              />
            </div>
            <div>
              <QualityRow
                label="Doğrulanmış rezervasyon başına maliyet"
                value={money(m.cost.perResolution)}
                detail={`${m.cost.unknown} çağrının maliyeti bilinmiyor`}
              />
              <QualityRow
                label="Token kullanımı"
                value={`${m.model.input} / ${m.model.output}`}
                detail="Raporlanan giriş / çıkış tokenları"
              />
              <QualityRow
                label="İnsan kararları"
                value={`${m.approvals.accepted} / ${m.approvals.edited} / ${m.approvals.rejected}`}
                detail="Onay / düzenleme / ret"
              />
              <QualityRow
                label="Politika engeli / yeniden plan"
                value={`${m.tools.policyBlocks} / ${m.tools.replans}`}
                detail={`${m.failed} başarısız · ${m.handedOff} devir · ${m.needsInfo} bilgi gerekiyor · ${m.stale} takılı olabilecek akış`}
              />
            </div>
          </div>
        </details>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Son vakalar</h3>
            <p>Karardan sonuca kadar tüm adımlar</p>
          </div>
          <a className="text-link" href="#cases">
            Tüm vakalar <ArrowUpRight size={15} />
          </a>
        </div>
        <RunList runs={runs.data?.runs.slice(0, 5) ?? []} />
      </section>
      {data && (
        <p className="data-note">
          Son güncelleme {date(data.updatedAt)} ·{" "}
          {mode === "fixture"
            ? "Yerel test sonuçları canlı model kalitesi veya maliyeti göstermez."
            : "Maliyetler sağlayıcı raporlarına dayanır; eksik çağrılar ayrıca belirtilir."}
        </p>
      )}
      {glossary && (
        <Modal title="Metrik sözlüğü" onClose={() => setGlossary(false)}>
          <div className="modal-body">
            <p>
              Seçili dönemde başlatılmış, sizin oturumunuza ait vakaların güncel
              sonuçları ölçülür. Devam eden ve değerlendirilmemiş vakalar
              doğruluk paydasına girmez.
            </p>
            {[
              [
                "Doğrulanmış sonuç",
                "İşlem sonrası stok/kayıt kontrolü veya politika gereği doğru devir/bilgi isteme kontrolü geçen vakalar / bu kontrolün yapıldığı vakalar. Modelin kendi puanı kullanılmaz.",
              ],
              [
                "Tamamlanan rezervasyon",
                "Kaynaktan okunarak doğrulanmış rezervasyon. Bilgi isteme, devir ve ret bu sayıya dahil değildir.",
              ],
              [
                "Aktif süre",
                "Bitiş − başlangıç − insan onayında beklenen süre. p50 medyanı, p95 yüzde 95 eşiğini gösterir. Küçük örneklemlerde genelleme yapılamaz.",
              ],
              [
                "Maliyet",
                "Başarısız çağrılar dahil raporlanmış tüm maliyetlerin toplamı. Bilinmeyen maliyet sıfır sayılmaz. Çözüm başına maliyet yalnızca tüm çağrı maliyetleri biliniyorsa hesaplanır.",
              ],
              [
                "Politika engeli",
                "Geçersiz veya kanıtsız araç/öneri girişimi. Engellenen girişim ile gerçekleşmiş ihlal farklıdır.",
              ],
            ].map(([t, d]) => (
              <div className="definition" key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
