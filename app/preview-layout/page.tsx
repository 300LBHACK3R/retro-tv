export default function PreviewLayoutPage() {
  return (
    <main className="ttv-preview-layout">
      <div className="ttv-preview-shell">

        <header className="ttv-preview-topbar">
          <div className="ttv-preview-logo">
            <div className="ttv-preview-logo-title">
              Tate's TV
            </div>

            <div className="ttv-preview-logo-subtitle">
              Premium Dashboard Preview
            </div>
          </div>

          <nav className="ttv-preview-nav">
            <button>Live TV</button>
            <button>Guide</button>
            <button>Categories</button>
            <button>Schedule</button>
            <button>Search</button>
            <button>Settings</button>
          </nav>
        </header>

        <section className="ttv-preview-status">
          <div className="ttv-preview-card">
            Viewer Header
          </div>

          <div className="ttv-preview-card">
            Now / Next
          </div>

          <div className="ttv-preview-card">
            Quick Tune
          </div>
        </section>

        <section className="ttv-preview-main-grid">

          <div className="ttv-preview-player-column">

            <div className="ttv-preview-player-frame">
              PLAYER AREA
            </div>

            <div className="ttv-preview-card">
              Now Playing Details
            </div>

            <div className="ttv-preview-card">
              Up Next Details
            </div>

          </div>

          <aside className="ttv-preview-sidebar">

            <div className="ttv-preview-guide-box">
              GUIDE PANEL
            </div>

            <div className="ttv-preview-remote-box">
              REMOTE PANEL
            </div>

          </aside>

        </section>

        <section className="ttv-preview-tools">

          <div className="ttv-preview-card">
            Theme Selector
          </div>

          <div className="ttv-preview-card">
            Show Library
          </div>

        </section>

        <section className="ttv-preview-channel-rail">
          CHANNEL RAIL
        </section>

        <footer className="ttv-preview-footer">
          Tate's TV Preview Layout — Production homepage remains untouched.
        </footer>

      </div>
    </main>
  );
}