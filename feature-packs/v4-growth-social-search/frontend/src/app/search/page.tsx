'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Suspense } from 'react';

const GENRES = [
  { id: 1, name: 'Action' }, { id: 2, name: 'Adventure' }, { id: 3, name: 'Comedy' },
  { id: 4, name: 'Drama' }, { id: 5, name: 'Fantasy' }, { id: 6, name: 'Horror' },
  { id: 7, name: 'Mecha' }, { id: 8, name: 'Mystery' }, { id: 9, name: 'Romance' },
  { id: 10, name: 'Sci-Fi' }, { id: 11, name: 'Slice of Life' }, { id: 12, name: 'Sports' },
  { id: 13, name: 'Supernatural' }, { id: 14, name: 'Thriller' },
];

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ]               = useState(searchParams.get('q') ?? '');
  const [genres, setGenres]      = useState<number[]>([]);
  const [minRating, setMinRating]= useState('');
  const [maxRating, setMaxRating]= useState('');
  const [yearFrom, setYearFrom]  = useState('');
  const [yearTo, setYearTo]      = useState('');
  const [status, setStatus]      = useState('');
  const [hasDub, setHasDub]      = useState('');
  const [sortBy, setSortBy]      = useState('relevance');
  const [page, setPage]          = useState(1);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSugg, setShowSugg]  = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const params = {
    ...(q && { q }),
    ...(genres.length && { genres }),
    ...(minRating && { minRating }),
    ...(maxRating && { maxRating }),
    ...(yearFrom && { yearFrom }),
    ...(yearTo && { yearTo }),
    ...(status && { status }),
    ...(hasDub && { hasDub }),
    sortBy, page, limit: 24,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', params],
    queryFn: () => api.get('/search', { params }).then(r => r.data.data ?? r.data),
    placeholderData: (prev) => prev,
  });

  // Typeahead suggestions
  const fetchSuggestions = useCallback((val: string) => {
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const { data } = await api.get('/search/suggest', { params: { q: val } });
      setSuggestions(data.data ?? data);
    }, 200);
  }, []);

  useEffect(() => { fetchSuggestions(q); }, [q, fetchSuggestions]);

  function toggleGenre(id: number) {
    setGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
    setPage(1);
  }

  const hasFilters = genres.length || minRating || maxRating || yearFrom || yearTo || status || hasDub;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Search bar */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '20px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              style={{ fontSize: 16, padding: '12px 16px', paddingLeft: 44 }}
              placeholder="Search anime by title or description..."
              value={q}
              autoFocus
              onChange={e => { setQ(e.target.value); setPage(1); setShowSugg(true); }}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onFocus={() => suggestions.length && setShowSugg(true)}
            />
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 18 }}>⌕</span>
            {isFetching && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 12 }}>…</span>
            )}

            {/* Suggestions dropdown */}
            {showSugg && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                {suggestions.map((s: any) => (
                  <Link key={s.id} href={`/anime/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 32, height: 44, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-hover)' }}>
                      {s.coverImageUrl && <Image src={s.coverImageUrl} alt={s.title} width={32} height={44} style={{ objectFit: 'cover' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{s.title}</div>
                      {s.releaseYear && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.releaseYear}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'grid', gridTemplateColumns: '240px 1fr', gap: 28, alignItems: 'start' }}>

        {/* Filters sidebar */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Filters</span>
            {hasFilters && (
              <button onClick={() => { setGenres([]); setMinRating(''); setMaxRating(''); setYearFrom(''); setYearTo(''); setStatus(''); setHasDub(''); setPage(1); }}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear all
              </button>
            )}
          </div>

          <FilterSection label="Genres">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GENRES.map(g => (
                <button key={g.id} onClick={() => toggleGenre(g.id)}
                  style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', transition: 'all 0.12s',
                    border: `1px solid ${genres.includes(g.id) ? 'var(--accent)' : 'var(--border)'}`,
                    background: genres.includes(g.id) ? 'rgba(224,64,176,0.12)' : 'var(--bg-card)',
                    color: genres.includes(g.id) ? 'var(--accent)' : 'var(--text-3)' }}>
                  {g.name}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection label="Min rating">
            <RatingSlider value={minRating} onChange={v => { setMinRating(v); setPage(1); }} />
          </FilterSection>

          <FilterSection label="Year">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="From" value={yearFrom}
                onChange={e => { setYearFrom(e.target.value); setPage(1); }} />
              <input className="input" style={{ flex: 1 }} placeholder="To" value={yearTo}
                onChange={e => { setYearTo(e.target.value); setPage(1); }} />
            </div>
          </FilterSection>

          <FilterSection label="Status">
            <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Any</option>
              <option value="airing">Airing</option>
              <option value="completed">Completed</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </FilterSection>

          <FilterSection label="Version">
            <select className="input" value={hasDub} onChange={e => { setHasDub(e.target.value); setPage(1); }}>
              <option value="">Any</option>
              <option value="true">Has dub</option>
              <option value="false">Sub only</option>
            </select>
          </FilterSection>
        </div>

        {/* Results */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {data?.pagination?.total ? `${data.pagination.total.toLocaleString()} results` : ''}
            </span>
            <select className="input" style={{ width: 'auto', fontSize: 12 }} value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}>
              {q && <option value="relevance">Most relevant</option>}
              <option value="rating">Highest rated</option>
              <option value="votes">Most voted</option>
              <option value="year">Newest</option>
              <option value="title">A–Z</option>
            </select>
          </div>

          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="animate-pulse" style={{ aspectRatio: '2/3', borderRadius: 8, background: 'var(--bg-card)' }} />)}
            </div>
          ) : data?.items?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>No results found</p>
              <p style={{ fontSize: 14 }}>Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {data?.items?.map((anime: any) => (
                <Link key={anime.id} href={`/anime/${anime.id}`} style={{ textDecoration: 'none' }} className="group">
                  <div style={{ aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', position: 'relative', marginBottom: 8 }}>
                    {anime.coverImageUrl
                      ? <Image src={anime.coverImageUrl} alt={anime.title} fill style={{ objectFit: 'cover' }} sizes="180px" />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--text-3)' }}>⛩</div>
                    }
                    {anime.avgSubRating && (
                      <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.75)', color: '#f59e0b' }}>
                        ★ {Number(anime.avgSubRating).toFixed(1)}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{anime.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{anime.releaseYear ?? '—'}</p>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              {Array.from({ length: Math.min(data.pagination.pages, 8) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.12s',
                    background: p === page ? 'var(--accent)' : 'var(--bg-card)',
                    color: p === page ? '#fff' : 'var(--text-2)',
                    border: '1px solid var(--border)' }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function RatingSlider({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="range" min={1} max={5} step={0.5} value={value || 1}
        onChange={e => onChange(e.target.value)} style={{ flex: 1 }} />
      <span style={{ fontSize: 13, color: value ? '#f59e0b' : 'var(--text-3)', minWidth: 24 }}>
        {value ? `${value}+` : 'Any'}
      </span>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
      <SearchContent />
    </Suspense>
  );
}
