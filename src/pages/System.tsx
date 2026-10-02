import {
  Activity,
  BarChart3,
  FlaskConical,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../api";
import { ErrorBox, Skeleton, Stat, QualityRow } from "../components";
import { money } from "../format";
import type { Bootstrap, SystemData } from "../types";
import { percentile } from "../../shared/metrics";
export default function System({ boot }: { boot: Bootstrap }) {
  const { data, error } = useData<SystemData>("/system", 15000);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">İŞLETİM VE MALİYET</span>
          <h1>Sınırlar belli. Sistem görünür.</h1>
          <p>
            Bütçe, sağlayıcı yapılandırması ve gerçek kullanıcı performans
            ölçümleri.
          </p>
        </div>
        <span className="pill">
          <Activity size={14} /> 15 sn'de yenilenir
        </span>
      </div>
      <ErrorBox message={error} />
      {data ? (
        <>
          <div className="stat-grid three">
            <Stat
              icon={BarChart3}
              label="Günlük bütçe kullanımı"
              value={money(data.budget.daily)}
              sub={`${money(data.budget.limits.daily)} sınır · bekleyen rezervasyonlar dahil`}
            />
            <Stat
              icon={BarChart3}
              label="Aylık bütçe kullanımı"
              value={money(data.budget.monthly)}
              sub={`${money(data.budget.limits.monthly)} sınır · tüm ziyaretçiler ortak`}
            />
            <Stat
              icon={FlaskConical}
              label="Değerlendirme bütçesi"
              value={money(data.budget.evaluation)}
              sub={`${money(data.budget.limits.evaluation)} toplam sınır`}
            />
          </div>
          <div className="analysis-grid">
            <section className="panel system-panel">
              <div className="panel-heading">
                <div>
                  <h3>Servis yapılandırması</h3>
                  <p>
                    Yapılandırılmış olmak, erişilebilirlik garantisi değildir.
                  </p>
                </div>
                <Activity size={20} />
              </div>
              <dl>
                <div>
                  <dt>Model</dt>
                  <dd>{data.model}</dd>
                </div>
                <div>
                  <dt>API anahtarı</dt>
                  <dd>
                    {data.configured ? "Yapılandırıldı" : "Henüz eklenmedi"}
                  </dd>
                </div>
                <div>
                  <dt>Çalışma modu</dt>
                  <dd>
                    {boot.mode === "live"
                      ? "OpenRouter · canlı"
                      : "Yerel test sağlayıcısı"}
                  </dd>
                </div>
                <div>
                  <dt>Veri seti</dt>
                  <dd>{data.dataset}</dd>
                </div>
                <div>
                  <dt>Vaka saklama süresi</dt>
                  <dd>{data.retentionDays} gün</dd>
                </div>
              </dl>
            </section>
            <section className="panel system-panel">
              <div className="panel-heading">
                <div>
                  <h3>Web performansı</h3>
                  <p>Bu oturum · son 7 gün · p75</p>
                </div>
                <Zap size={21} />
              </div>
              {(["LCP", "INP", "CLS"] as const).map((name) => {
                const values = data.vitals
                    .filter((v) => v.name === name)
                    .map((v) => v.value),
                  p = percentile(values, 0.75);
                return (
                  <QualityRow
                    key={name}
                    label={
                      {
                        LCP: "Ana içeriğin görünmesi",
                        INP: "Etkileşim yanıtı",
                        CLS: "Görsel yerleşim kararlılığı",
                      }[name]
                    }
                    value={
                      p === null
                        ? "—"
                        : name === "CLS"
                          ? p.toFixed(3)
                          : `${Math.round(p)} ms`
                    }
                    detail={`${name} · n=${values.length} · hedef ${name === "LCP" ? "≤ 2500 ms" : name === "INP" ? "≤ 200 ms" : "≤ 0,1"}`}
                  />
                );
              })}
              <p className="data-note">
                Küçük örneklem genellenemez. INP için etkileşim, bazı ölçümler
                için sekme değişimi gerekir.
              </p>
            </section>
          </div>
        </>
      ) : (
        <Skeleton />
      )}
      <div className="notice">
        <ShieldCheck size={18} /> Maliyeti bilinmeyen çağrıların ayrılan bütçesi
        korunur. Zaman aşımı, sağlayıcının ücret uygulamadığı anlamına gelmez.
      </div>
    </>
  );
}
