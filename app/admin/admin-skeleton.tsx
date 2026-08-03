import { Image as ImageIcon } from "lucide-react";

function Block({ className = "" }: { className?: string }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export function AdminDashboardSkeleton() {
  return (
    <main
      className="admin-page admin-system-skeleton"
      aria-busy="true"
      aria-describedby="admin-loading-status"
    >
      <header className="admin-header">
        <div className="container admin-nav">
          <div className="brand">
            <span className="brand-mark">
              <img src="/satun-risk-logo.png" alt="" aria-hidden="true" />
            </span>
            <span>
              <strong>ระบบจัดการสื่อ</strong>
              <small>สำนักงานสาธารณสุขจังหวัดสตูล</small>
            </span>
          </div>
          <div className="admin-skeleton-nav" aria-hidden="true">
            <Block /><Block /><Block />
          </div>
        </div>
      </header>

      <div className="container admin-content">
        <div className="admin-loading-status" id="admin-loading-status" role="status" aria-live="polite">
          <span className="skeleton-loading-dot" aria-hidden="true" />
          กำลังโหลดข้อมูลระบบจัดการ กรุณารอสักครู่
        </div>

        <section className="admin-title-row admin-skeleton-title" aria-hidden="true">
          <div><Block /><Block /><Block /></div>
          <div><Block /><Block /></div>
        </section>

        <section className="connection-banner admin-skeleton-connection" aria-hidden="true">
          <Block /><div><Block /><Block /></div><Block />
        </section>

        <section className="media-overview admin-skeleton-overview" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <article key={item}><Block /><Block /><Block /></article>
          ))}
        </section>

        <section className="media-library-panel admin-skeleton-library" aria-hidden="true">
          <div className="library-heading">
            <div className="panel-heading-main">
              <span className="panel-icon"><ImageIcon size={20} /></span>
              <span><Block /><Block /></span>
            </div>
            <Block />
          </div>
          <div className="library-toolbar">
            <Block className="admin-skeleton-search" />
            <div className="library-filter-grid">
              <Block /><Block /><Block /><Block />
            </div>
          </div>
          <Block className="admin-skeleton-result" />
          <div className="media-library-list">
            {[0, 1, 2, 3, 4].map((item) => (
              <article className="media-library-item admin-skeleton-item" key={item}>
                <Block className="admin-skeleton-thumb" />
                <div>
                  <Block /><Block /><Block />
                </div>
                <Block />
                <div><Block /><Block /></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
