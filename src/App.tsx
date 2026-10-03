import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  LayoutDashboard,
  Workflow,
  FlaskConical,
  Activity,
  Menu,
  Download,
  ShieldCheck,
  Github,
  ArrowUpRight,
  WifiOff,
  Check,
  LoaderCircle,
  Zap,
} from "lucide-react";
import { api, useData } from "./api";
import { Empty, ErrorBox, Skeleton, Modal } from "./components";
import type { Bootstrap } from "./types";
const Overview = lazy(() => import("./pages/Overview"));
const Cases = lazy(() => import("./pages/Cases"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const Evaluations = lazy(() => import("./pages/Evaluations"));
const System = lazy(() => import("./pages/System"));
type Page = "overview" | "cases" | "evaluations" | "system";
const nav = [
  { id: "overview", label: "Genel bakış", icon: LayoutDashboard },
  { id: "cases", label: "Vakalar", icon: Workflow },
  { id: "evaluations", label: "Değerlendirmeler", icon: FlaskConical },
  { id: "system", label: "Sistem durumu", icon: Activity },
] as const;
function route() {
  return location.hash.startsWith("#case/")
    ? { page: "cases" as Page, id: location.hash.slice(6) }
    : {
        page: (nav.find((n) => `#${n.id}` === location.hash)?.id ??
          "overview") as Page,
        id: null,
      };
}
export function App() {
  const boot = useData<Bootstrap>("/bootstrap");
  const [current, setCurrent] = useState(route),
    [menu, setMenu] = useState(false),
    [newCase, setNewCase] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const [install, setInstall] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);
  useEffect(() => {
    const hash = () => {
      setCurrent(route());
      setMenu(false);
    };
    window.addEventListener("hashchange", hash);
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    if (!boot.data) return;
    import("web-vitals").then(({ onLCP, onINP, onCLS }) => {
      const report = ({
        id,
        name,
        value,
      }: {
        id: string;
        name: string;
        value: number;
      }) => {
        void api("/vitals", {
          method: "POST",
          body: JSON.stringify({ id, name, value }),
          keepalive: true,
        }).catch(() => {});
      };
      onLCP(report);
      onINP(report);
      onCLS(report);
    });
  }, [Boolean(boot.data)]);
  const go = (id: string) => {
    location.hash = `case/${id}`;
    setNewCase(false);
  };
  return (
    <div className="shell">
      <a className="skip" href="#main">
        İçeriğe geç
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#overview">
          <span className="brand-mark">
            <Workflow size={24} />
          </span>
          <span>
            service<span className="brand-light">ops</span>
            <small>AI OPERASYON MERKEZİ</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Aster Mobility</strong>
            <span>Demo çalışma alanı</span>
          </div>
          <span className="workspace-dot" />
        </div>
        <span className="nav-label">ÇALIŞMA ALANI</span>
        <nav aria-label="Ana menü">
          {nav.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              className={current.page === id ? "active" : ""}
              href={`#${id}`}
              aria-current={current.page === id ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safe-card">
            <ShieldCheck size={22} />
            <strong>Kontrol sizde.</strong>
            <p>Her rezervasyon, insan onayıyla gerçekleşir.</p>
            <span>
              <i /> Sentetik verilerle güvenli demo
            </span>
          </div>
          <a
            className="repo-link"
            href="https://github.com/serkanazeri/serviceops"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} /> Kaynak kodu <ArrowUpRight size={15} />
          </a>
          <div className="author">
            <span>SA</span>
            <div>
              <strong>Serkan Azeri</strong>
              <small>Forward Deployed AI Engineer</small>
            </div>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Menüyü kapat"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="crumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Menüyü aç"
            >
              <Menu size={21} />
            </button>
            <span>Çalışma alanı</span>
            <ChevronRight size={14} />
            <strong>
              {current.id
                ? "Vaka detayı"
                : nav.find((n) => n.id === current.page)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className={`connection ${offline ? "offline" : ""}`}>
              <i />
              {offline
                ? "Çevrimdışı"
                : !boot.data
                  ? "Bağlantı kontrol ediliyor"
                  : boot.data.mode === "live"
                    ? boot.data.configured
                      ? "Canlı model"
                      : "Model bağlantısı bekleniyor"
                    : "Yerel test modu"}
            </span>
            {install && (
              <button
                className="icon-button"
                title="Uygulamayı yükle"
                aria-label="Uygulamayı yükle"
                onClick={() => {
                  void install.prompt();
                  setInstall(null);
                }}
              >
                <Download size={19} />
              </button>
            )}
            <span className="top-avatar">SA</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {offline && (
            <div className="notice">
              <WifiOff size={18} /> Bağlantı yok. Yeni işlem ve onay için
              internete bağlanın. Görünen veriler güncel olmayabilir.
            </div>
          )}
          <ErrorBox message={boot.error} />
          {boot.data?.mode === "live" && !boot.data.configured && (
            <div className="notice" role="status">
              <Activity size={18} /> Model bağlantısı hazırlanıyor. Arayüzü
              inceleyebilirsiniz; yeni vaka başlatma henüz kullanılamıyor.
            </div>
          )}
          <Suspense fallback={<Skeleton />}>
            {!boot.data ? (
              offline ? (
                <Empty title="Çevrimdışı çalışma alanı" icon={WifiOff}>
                  Uygulama hazır. Güncel vakalar, yeni çalışmalar ve onay
                  işlemleri için bağlantınızı yeniden kurun.
                </Empty>
              ) : (
                <Skeleton />
              )
            ) : current.id ? (
              <CaseDetail key={current.id} id={current.id} offline={offline} />
            ) : current.page === "overview" ? (
              <Overview boot={boot.data} onNew={() => setNewCase(true)} />
            ) : current.page === "cases" ? (
              <Cases onNew={() => setNewCase(true)} />
            ) : current.page === "evaluations" ? (
              <Evaluations />
            ) : (
              <System boot={boot.data} />
            )}
          </Suspense>
          <footer className="page-footer">
            <span>
              ServiceOps <span className="muted">/</span> Kanıta dayalı
              kararlar, izlenebilir sonuçlar.
            </span>
            <span>Sentetik veriler · Gerçek iş akışı</span>
          </footer>
        </main>
      </div>
      {newCase && boot.data && (
        <NewCase
          boot={boot.data}
          onClose={() => setNewCase(false)}
          onCreated={go}
          offline={offline}
        />
      )}
    </div>
  );
}
function NewCase({
  boot,
  onClose,
  onCreated,
  offline,
}: {
  boot: Bootstrap;
  onClose: () => void;
  onCreated: (id: string) => void;
  offline: boolean;
}) {
  const [selected, setSelected] = useState(boot.scenarios[0].id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/runs", {
        method: "POST",
        body: JSON.stringify({
          scenarioId: selected,
          requestId: requestId.current,
        }),
      });
      onCreated(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Bir servis vakası seçin"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-body">
        <p className="modal-intro">
          Her senaryo ayrı sentetik kayıtlarla başlar.{" "}
          {boot.mode === "live"
            ? boot.configured
              ? "Gerçek model çağrıları kullanılır."
              : "Model bağlantısı tamamlandığında vakaları başlatabilirsiniz."
            : "Yerel test sağlayıcısı kullanılır; LLM çağrısı yapılmaz."}
        </p>
        <div className="scenario-grid">
          {boot.scenarios.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setSelected(s.id);
                requestId.current = crypto.randomUUID();
              }}
              disabled={busy}
              className={`scenario ${s.id === selected ? "selected" : ""}`}
              aria-pressed={s.id === selected}
            >
              <span className="scenario-top">
                <span>0{i + 1}</span>
                <span>{s.tag}</span>
                {s.id === selected && <Check size={16} />}
              </span>
              <strong>{s.title}</strong>
              <p>{s.description}</p>
            </button>
          ))}
        </div>
        <ErrorBox message={error} />
      </div>
      <div className="modal-footer">
        <span>
          <ShieldCheck size={15} /> Gerçek müşteri verisi kullanılmaz.
        </span>
        <button
          className="button primary"
          disabled={busy || offline || (boot.mode === "live" && !boot.configured)}
          onClick={() => void start()}
        >
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Zap size={17} />
          )}{" "}
          {busy ? "Başlatılıyor…" : "Vakayı başlat"}
        </button>
      </div>
    </Modal>
  );
}
