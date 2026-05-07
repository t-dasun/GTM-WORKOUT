import Link from 'next/link'

export default function Home() {
  return (
    <main className="container">
      <div style={{ marginTop: '4rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          Welcome to <span style={{ color: 'var(--primary)' }}>Gym Tracker</span>
        </h1>
        <p className="mb-4">
          An execution-first tracking app for athletes and trainers. Track your progressive overload without rigid calendar constraints.
        </p>
        
        <div className="card text-center" style={{ marginTop: '2rem' }}>
          <h2>Get Started</h2>
          <p className="mb-4">Join today or sign in to continue your journey.</p>
          <div className="flex flex-col gap-4">
            <Link href="/auth" className="btn btn-primary w-full" style={{ textDecoration: 'none' }}>
              Login / Sign Up
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '4rem', textAlign: 'left' }}>
          <h3>Why Gym Tracker?</h3>
          <div className="card">
            <h4>💪 Execution-First</h4>
            <p>1-tap fast logging with inline editing and historical context.</p>
          </div>
          <div className="card">
            <h4>📅 Flexible Scheduling</h4>
            <p>Day-agnostic blocks that handle missed days gracefully via a queue system.</p>
          </div>
          <div className="card">
            <h4>🤝 Trainer Connection</h4>
            <p>Privacy-first handshake for athletes to approve trainers.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
