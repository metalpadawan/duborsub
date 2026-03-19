// src/app/page.tsx — Anime catalog (home)
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { animeApi, Anime } from '@/lib/api';

const GENRES = [
  'All', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mecha', 'Mystery', 'Romance', 'Sci-Fi',
];

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState('title');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['anime', search, genre, sort, page],
    queryFn: () => animeApi.list({ search, sortBy: sort, page, limit: 24 }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Header />

      {/* Filters bar */}
      <div className="sticky top-0 z-10 border-b" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center">
          <input
            className="input max-w-xs"
            placeholder="Search anime..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div className="flex gap-2 flex-wrap">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => { setGenre(g === 'All' ? '' : g); setPage(1); }}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: genre === (g === 'All' ? '' : g) ? 'var(--accent)' : 'var(--bg-card)',
                  color: genre === (g === 'All' ? '' : g) ? '#fff' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}
              >
                {g}
              </button>
            ))}
          </div>
          <select
            className="input max-w-[140px] ml-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="title">A–Z</option>
            <option value="rating">Top Rated</option>
            <option value="votes">Most Voted</option>
            <option value="year">Newest</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data?.items.map((anime) => <AnimeCard key={anime.id} anime={anime} />)}
            </div>

            {data?.items.length === 0 && (
              <div className="text-center py-20" style={{ color: 'var(--text-3)' }}>
                <p className="text-lg">No anime found</p>
              </div>
            )}

            {/* Pagination */}
            {data && data.pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-9 h-9 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: p === page ? 'var(--accent)' : 'var(--bg-card)',
                      color: p === page ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>AniRate</span>
          <span className="text-sm px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-3)' }}>
            Sub vs Dub
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
          <Link href="/register" className="btn-primary text-sm">Join</Link>
        </nav>
      </div>
    </header>
  );
}

function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <Link href={`/anime/${anime.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2"
           style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {anime.coverImageUrl ? (
          <Image
            src={anime.coverImageUrl}
            alt={anime.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 17vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ color: 'var(--text-3)' }}>
            <span className="text-3xl">⛩</span>
          </div>
        )}

        {/* Rating badge */}
        {anime.avgSubRating && (
          <div className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
               style={{ background: 'rgba(0,0,0,0.75)', color: '#f59e0b' }}>
            ★ {Number(anime.avgSubRating).toFixed(1)}
          </div>
        )}

        {/* Dub badge */}
        {anime.hasDub && (
          <div className="absolute top-2 left-2 text-xs font-medium px-1.5 py-0.5 rounded"
               style={{ background: 'rgba(224,64,176,0.85)', color: '#fff' }}>
            DUB
          </div>
        )}
      </div>

      <p className="text-sm font-medium truncate group-hover:text-purple-400 transition-colors"
         style={{ color: 'var(--text-1)' }}>
        {anime.title}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
        {anime.releaseYear ?? '—'}
        {anime.avgSubRating && (
          <span className="ml-2">{anime.totalVotes} votes</span>
        )}
      </p>
    </Link>
  );
}

function AnimeCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-lg mb-2"
           style={{ background: 'var(--bg-card)' }} />
      <div className="h-3 rounded mb-1" style={{ background: 'var(--bg-card)', width: '80%' }} />
      <div className="h-3 rounded" style={{ background: 'var(--bg-card)', width: '50%' }} />
    </div>
  );
}
