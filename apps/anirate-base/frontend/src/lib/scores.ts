// The split: how a title's sub and dub scores compare. Every surface reads its
// leader, tag, and sentence from here so the comparison is stated one way only.
// Only versions that actually have ratings are compared; nothing is inferred.

export type Lead = 'sub' | 'dub' | 'even' | null;

export interface Split {
  sub: number | null;
  dub: number | null;
  lead: Lead;
  gap: number | null;
  /** Short form for lists, e.g. "Dub +0.5", "Sub only", "Unrated". */
  tag: string;
}

export function describeSplit(subRating?: number | null, dubRating?: number | null): Split {
  const sub = typeof subRating === 'number' ? subRating : null;
  const dub = typeof dubRating === 'number' ? dubRating : null;

  if (sub !== null && dub !== null) {
    const gap = Math.round((dub - sub) * 10) / 10;
    if (gap === 0) {
      return { sub, dub, lead: 'even', gap: 0, tag: 'Even' };
    }

    const lead = gap > 0 ? 'dub' : 'sub';
    return { sub, dub, lead, gap: Math.abs(gap), tag: `${lead === 'dub' ? 'Dub' : 'Sub'} +${Math.abs(gap).toFixed(1)}` };
  }

  if (sub !== null) {
    return { sub, dub, lead: null, gap: null, tag: 'Sub only' };
  }

  if (dub !== null) {
    return { sub, dub, lead: null, gap: null, tag: 'Dub only' };
  }

  return { sub, dub, lead: null, gap: null, tag: 'Unrated' };
}

export function formatScore(value: number | null) {
  return value === null ? '—' : value.toFixed(1);
}

export function formatStatus(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function formatCount(count: number) {
  return count.toLocaleString('en-US');
}

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'Web series',
  SPECIAL: 'Special',
};

// Seasons, films and specials often share a title, so the format tells them apart.
export function formatLabel(format: string | null | undefined) {
  return format ? FORMAT_LABELS[format] ?? format : '';
}

/** View-transition names must be CSS identifiers, and some ids start with a digit. */
export function workTransitionName(id: string) {
  return `work-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
