// The page closes on a gallery-black wall: one invitation to rate, then the colophon.
export function Colophon({ showInvitation = true }: { showInvitation?: boolean }) {
  return (
    <footer className="colophon">
      <div className={showInvitation ? 'wrap colophon__inner' : 'wrap colophon__inner colophon__inner--plain'}>
        {showInvitation ? (
          <div className="colophon__cta">
            <h2 className="display">
              Watched it?
              <br />
              Rate both versions.
            </h2>
            <p className="colophon__lede">
              Sub and dub scores are counted separately, so every rating sharpens the comparison for the next viewer.
            </p>
            <div className="colophon__actions">
              <a className="btn btn--white" href="/register">
                Create an account
              </a>
              <a className="btn btn--on-ink" href="/login">
                Sign in
              </a>
            </div>
          </div>
        ) : null}

        <div className="colophon__foot">
          <a className="brand" href="/">
            <span className="brand__mark" aria-hidden="true" />
            AniRate
          </a>
          <p>
            Catalogue metadata from AniList and{' '}
            <a className="link" href="https://github.com/manami-project/anime-offline-database">
              anime-offline-database
            </a>{' '}
            (ODbL); popularity from Kitsu. Cover art belongs to its rights holders. Scores are community ratings on a 1–5 scale.
          </p>
        </div>
      </div>
    </footer>
  );
}
