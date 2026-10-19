export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="site-wrap header-inner">
        <a href="/" className="brand-link">
          <span className="brand-mark">AR</span>
          <span className="brand-stack">
            <span className="brand-name">AniRate</span>
            <span className="brand-subtitle">database companion</span>
          </span>
        </a>

        <nav className="header-nav">
          <a href="/catalog/search?sort=rating" className="nav-link">
            Rankings
          </a>
          <a href="/login" className="btn-ghost">
            Sign in
          </a>
          <a href="/register" className="btn-primary">
            Join
          </a>
        </nav>
      </div>
    </header>
  );
}
