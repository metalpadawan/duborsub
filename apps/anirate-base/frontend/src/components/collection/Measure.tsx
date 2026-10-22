// A score set as a measurement: tabular figure over a ruled track scaled to /5.
// Presentational only, so it renders the same on the no-JS catalog and in React pages.
import type { CSSProperties } from 'react';
import { formatScore } from '@/lib/scores';

export function Measure({
  version,
  value,
  lead = false,
  drawn = false,
  delay = 0,
  emptyLabel,
  className,
}: {
  version: 'sub' | 'dub';
  value: number | null;
  lead?: boolean;
  /** Draw the rule in on mount (used outside the hero's own choreography). */
  drawn?: boolean;
  delay?: number;
  /** Words to print instead of a dash when there is no score (large measures). */
  emptyLabel?: string;
  className?: string;
}) {
  const name = version === 'sub' ? 'Sub' : 'Dub';
  const classes = [
    'measure',
    `measure--${version}`,
    lead ? 'measure--lead' : '',
    value === null ? 'measure--empty' : '',
    drawn ? 'measure--drawn' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--v': value === null ? 0 : Math.min(1, Math.max(0, value / 5)),
    '--delay': `${delay}ms`,
  } as CSSProperties;

  return (
    <span className={classes} style={style}>
      <span className="measure__head">
        <span className="measure__name signage">{name}</span>
        {value === null && emptyLabel ? (
          <span className="measure__value measure__value--text">{emptyLabel}</span>
        ) : (
          <span className="measure__value num">
            {formatScore(value)}
            <span className="visually-hidden">{value === null ? ' — not yet rated' : ' out of 5'}</span>
          </span>
        )}
      </span>
      <span className="measure__track" aria-hidden="true">
        <span className="measure__fill" />
      </span>
    </span>
  );
}

export function VerdictTag({ tag, lead }: { tag: string; lead: 'sub' | 'dub' | 'even' | null }) {
  const tone = lead === 'sub' || lead === 'dub' ? 'verdict-tag--lead' : lead === 'even' ? '' : 'verdict-tag--none';
  return <span className={`verdict-tag ${tone}`.trim()}>{tag}</span>;
}
