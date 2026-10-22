// Where a record comes from, said plainly on its wall label. The six seed titles
// are demo data, so they are always labelled as samples, never passed off as real.
import { catalogItems as seedTitles } from './catalog-data';

const SAMPLE_IDS = new Set(seedTitles.map((anime) => anime.id));

export function isSampleRecord(id: string) {
  return SAMPLE_IDS.has(id);
}

/** Two short phrases — source, then dub status — each kept whole when the line wraps. */
// Imported IDs carry their source site's prefix ("anilist-21", "mal-5114"); records
// an admin created have random UUIDs. AniList imports bring a synopsis, while the
// open offline database, which also uses AniList IDs, does not.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function provenanceParts(anime: { id: string; hasDub: boolean; description?: string | null }): [string, string] {
  const source = isSampleRecord(anime.id)
    ? 'Sample record'
    : UUID.test(anime.id)
      ? 'Catalogued by AniRate'
      : anime.id.startsWith('anilist-') && anime.description
        ? 'Metadata from AniList'
        : 'Metadata from open databases';

  return [source, anime.hasDub ? 'Dub listed' : 'Dub not reported'];
}
