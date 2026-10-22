import type { AnimeDetail } from '@/lib/api';
import { resolveServerApiUrl } from '@/lib/server/api-base';

export type AnimeLookup =
  | { status: 'found'; anime: AnimeDetail }
  | { status: 'missing' }
  | { status: 'unavailable' };

// The work page renders its record on the server so the first frame already holds
// the hung work, which the cross-document view transition needs to land on.
export async function fetchAnime(id: string): Promise<AnimeLookup> {
  const baseUrl = resolveServerApiUrl();
  if (!baseUrl) {
    return { status: 'unavailable' };
  }

  try {
    const response = await fetch(`${baseUrl}/anime/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (response.status === 404 || response.status === 400) {
      return { status: 'missing' };
    }

    if (!response.ok) {
      return { status: 'unavailable' };
    }

    return { status: 'found', anime: (await response.json()) as AnimeDetail };
  } catch {
    return { status: 'unavailable' };
  }
}
