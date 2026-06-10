export default function Loading() {
  return (
    <main className="ttv-launch-screen">
      <section className="ttv-launch-card" aria-label="Loading Tate's TV">
        <div className="ttv-launch-logo">TTV</div>
        <div>
          <p className="ttv-launch-kicker">Tate&apos;s TV</p>
          <h1>Loading your live lineup...</h1>
          <p>
            Warming up the channel guide, player, and retro broadcast engine.
          </p>
        </div>
        <div className="ttv-launch-loader" aria-hidden="true" />
      </section>
    </main>
  );
}
