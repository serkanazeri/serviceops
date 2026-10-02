import { useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "../api";
import { ErrorBox, Skeleton, RunList } from "../components";
import type { PublicRun } from "../../shared/types";
export default function Cases({ onNew }: { onNew: () => void }) {
  const [offset, setOffset] = useState(0);
  const { data, error } = useData<{ runs: PublicRun[]; hasMore: boolean }>(
    `/runs?offset=${offset}`,
    4000,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">VAKA YÖNETİMİ</span>
          <h1>Her vakanın bir izi var.</h1>
          <p>
            Kendi çalışma alanınızdaki servis talepleri ve yürütme kayıtları.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={18} />
          Yeni vaka başlat
        </button>
      </div>
      <ErrorBox message={error} />
      <section className="panel">
        <div className="panel-heading">
          <h3>Vaka geçmişi</h3>
          <span className="pill">Oturumunuza özel</span>
        </div>
        {!data ? <Skeleton /> : <RunList runs={data.runs} />}
        <div className="pagination">
          <button
            className="button secondary"
            disabled={!offset}
            onClick={() => setOffset((n) => Math.max(0, n - 20))}
          >
            Önceki
          </button>
          <span>Sayfa {offset / 20 + 1}</span>
          <button
            className="button secondary"
            disabled={!data?.hasMore}
            onClick={() => setOffset((n) => n + 20)}
          >
            Sonraki
          </button>
        </div>
      </section>
    </>
  );
}
