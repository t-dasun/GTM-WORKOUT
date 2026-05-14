import Link from 'next/link'

export default function AuthPage() {
  return (
    <main className="container page-shell auth-page" style={{ marginTop: '2rem' }}>
      <section className="auth-layout auth-layout--chooser">
        <div className="hero-card card auth-chooser-card">
          <div className="page-header">
            <span className="page-eyebrow">Forge access</span>
            <h1 className="page-title">Choose your login</h1>
            <p className="page-subtitle">
              Use separate login pages for athletes and trainers.
            </p>
          </div>

          <div className="landing-feature-grid" style={{ marginTop: '1rem' }}>
            <div className="card surface-muted" style={{ marginBottom: 0 }}>
              <h4 style={{ marginBottom: '0.25rem' }}>Athletes</h4>
              <p>Sign in or sign up as an athlete.</p>
              <Link href="/auth/athlete" className="btn btn-primary w-full" style={{ marginTop: '0.65rem', textDecoration: 'none' }}>
                Athlete Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
