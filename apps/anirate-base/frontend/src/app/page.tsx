'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiteHeader } from '@/components/SiteHeader';
import { Anime, animeApi } from '@/lib/api';

const genreOptions = ['All', 'Action', 'Adventure', 'Drama', 'Fantasy', 'Mystery', 'Sci-Fi'];

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('title');
  const [genre, setGenre] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['anime', search, sort, genre, page],
    queryFn: async () => {
      const response = await animeApi.list({ search, sortBy: sort, page, limit: 24 });
      return response.data;
    },
  });

  const filteredItems = query.data?.items.filter((anime) =>
    genre ? anime.genres.some((entry) => entry.name === genre) : true,
  );

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <SiteHeader />

      <section className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--text-3)' }}>
            Community anime scorecards
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold mt-3" style={{ color: 'var(--text-1)' }}>
            Compare sub and dub takes in one place.
          </h1>
          <p className="text-base mt-4 max-w-xl" style={{ color: 'var(--text-2)' }}>
            Browse the catalog, rate both versions, and jump into the discussion around each series.
          </p>
        </div>
      </section>

      <section className="border-y" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap gap-3 items-center">
          <input
            className="input max-w-xs"
            placeholder="Search anime..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <select className="input max-w-[160px]" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="title">A-Z</option>
            <option value="rating">Top Rated</option>
            <option value="votes">Most Voted</option>
            <option value="year">Newest</option>
          </select>

          <div className="flex gap-2 flex-wrap">
            {genreOptions.map((option) => {
              const value = option === 'All' ? '' : option;
              const active = genre === value;

              return (
                <button
                  key={option}
                  onClick={() => {
                    setGenre(value);
                    setPage(1);
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--bg-card)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        {query.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[2/3] rounded-lg mb-2" style={{ background: 'var(--bg-card)' }} />
                <div className="h-3 rounded mb-1" style={{ background: 'var(--bg-card)', width: '80%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--bg-card)', width: '50%' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredItems?.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>

            {filteredItems?.length === 0 ? (
              <div className="text-center py-20" style={{ color: 'var(--text-3)' }}>
                No anime matched that filter.
              </div>
            ) : null}

            {query.data && query.data.pagination.pages > 1 ? (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: query.data.pagination.pages }, (_, index) => index + 1).map((value) => (
                  <button
                    key={value}
                    onClick={() => setPage(value)}
                    className="w-9 h-9 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: value === page ? 'var(--accent)' : 'var(--bg-card)',
                      color: value === page ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <Link href={`/anime/${anime.id}`} className="group block">
      <div
        className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {anime.coverImageUrl ? (
          <Image
            src={anime.coverImageUrl}
            alt={anime.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 17vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: 'var(--text-3)' }}>
            *
          </div>
        )}

        {anime.avgSubRating ? (
          <div
            className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.75)', color: '#f59e0b' }}
          >
            * {Number(anime.avgSubRating).toFixed(1)}
          </div>
        ) : null}

        {anime.hasDub ? (
          <div
            className="absolute top-2 left-2 text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(224,64,176,0.85)', color: '#fff' }}
          >
            DUB
          </div>
        ) : null}
      </div>

      <p className="text-sm font-medium truncate transition-colors" style={{ color: 'var(--text-1)' }}>
        {anime.title}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
        {anime.releaseYear ?? '-'}
        <span className="ml-2">{anime.totalVotes} votes</span>
      </p>
    </Link>
  );
}
