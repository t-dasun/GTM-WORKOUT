import Link from 'next/link'

export default function Home() {
  return (
    <main className="container page-shell landing-page" style={{ marginTop: '2rem' }}>
      <section className="landing-grid">
        <div className="landing-stack">
          <div className="page-header">
            <span className="page-eyebrow">Mobile-first workout tracking</span>
            <h1 className="page-title">Welcome to <span style={{ color: 'var(--primary)' }}>Gym Tracker</span></h1>
            <p className="page-subtitle">
              An execution-first system for athletes and trainers. Log sessions fast, keep plans flexible, and carry the same clean experience from phone to tablet to desktop.
            </p>
          </div>

          <div className="card hero-card">
            <div className="landing-hero-row">
              <div>
                <h2 style={{ marginBottom: '0.45rem' }}>Ready to train anywhere?</h2>
                <p style={{ marginBottom: '1rem' }}>
                  Build a plan, follow your next queued day, and review progress without desktop-only layouts slowing you down in the gym.
                </p>
              </div>
              <div className="landing-cta-row">
                <Link href="/auth/athlete" className="btn btn-primary landing-cta-btn" style={{ textDecoration: 'none' }}>
                  Athlete Login
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-stack">
          <div className="landing-card-grid">
            <div className="card">
              <h4>💪 Execution-First</h4>
              <p>Fast logging with set-by-set editing, previous performance context, and clean controls built for touch.</p>
            </div>
            <div className="card">
              <h4>📅 Flexible Scheduling</h4>
              <p>Day-agnostic training blocks keep progress moving even when real life changes your gym days.</p>
            </div>
            <div className="card">
              <h4>🤝 Trainer Connection</h4>
              <p>Private trainer approval, assigned plans, and athlete-specific customization without changing the source schedule.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
