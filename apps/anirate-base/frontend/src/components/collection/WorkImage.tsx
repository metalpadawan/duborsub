// The cover when the record has one; otherwise a typeset plate, never a broken image.
export function WorkImage({
  title,
  src,
  priority = false,
  decorative = false,
  titled = false,
}: {
  title: string;
  src?: string | null;
  priority?: boolean;
  /** True where the title is printed right beside the image. */
  decorative?: boolean;
  /** At hung size, the plate is set like a catalogue card: the title fills it. */
  titled?: boolean;
}) {
  if (src) {
    return (
      // A plain <img>: the catalog renders without JS, so there is no next/image loader.
      <img
        src={src}
        alt={decorative ? '' : `Cover art for ${title}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        width={460}
        height={690}
      />
    );
  }

  const a11y = decorative ? {} : { role: 'img' as const, 'aria-label': `${title}, no cover on record` };

  if (titled) {
    // Stacked words set as large as the longest one allows, so the title runs down
    // the plate instead of sitting in its top corner. ~0.7em per glyph in the expanded cut.
    const words = title.trim().split(/\s+/);
    const longest = Math.max(...words.map((word) => word.length), 1);
    const size = Math.min(24, 80 / (longest * 0.7));

    return (
      <span className="plate plate--titled" {...a11y}>
        <span className="plate__title" aria-hidden="true" style={{ fontSize: `clamp(1.15rem, ${size.toFixed(2)}cqi, 9rem)` }}>
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className="plate__word">
              {word}
            </span>
          ))}
        </span>
        <span className="plate__note signage" aria-hidden="true">
          No cover on record
        </span>
      </span>
    );
  }

  return (
    <span className="plate" {...a11y}>
      <span className="plate__initial" aria-hidden="true">
        {title.trim().charAt(0).toUpperCase() || '·'}
      </span>
    </span>
  );
}
