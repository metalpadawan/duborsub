// The cover when the record has one; otherwise a typeset plate, never a broken image.
import { getImageProps } from 'next/image';
import { version as reactVersion } from 'react';
import imageHosts from '@/lib/image-hosts.json';

const OPTIMIZED_HOSTS = new Set<string>(imageHosts);
const PRIORITY_PROP = Number(reactVersion.split('.')[0]) >= 19 ? 'fetchPriority' : 'fetchpriority';

function isOptimizable(src: string) {
  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

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
    const alt = decorative ? '' : `Cover art for ${title}`;
    // The zero-JS catalogue renders with React 18, which only knows the lower-case
    // attribute; the App Router pages run React 19, which wants the camel-cased prop.
    const priorityAttribute = { [PRIORITY_PROP]: priority ? 'high' : 'auto' } as Record<string, string>;

    if (!isOptimizable(src)) {
      // A cover on a host the image optimizer does not fetch from (an admin's URL).
      return <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" width={460} height={690} {...priorityAttribute} />;
    }

    // Covers go through Next's image optimizer: a list thumbnail downloads a small
    // WebP/AVIF instead of the source's full-size JPEG. getImageProps only computes
    // attributes, so this stays a plain <img> that works on the zero-JS pages.
    const { props } = getImageProps({
      src,
      alt,
      width: 460,
      height: 690,
      quality: 75,
      loading: priority ? 'eager' : 'lazy',
      sizes: titled ? '(max-width: 760px) 92vw, 460px' : '56px',
    });
    // Next's own fetchPriority and inline style are replaced by the attribute above.
    const attributes: Record<string, unknown> = { ...props };
    delete attributes.fetchPriority;
    delete attributes.style;

    // data-original lets the fallback script (lib/image-fallback.ts) load the source
    // image directly if the resized one fails.
    return <img {...attributes} alt={alt} decoding="async" data-original={src} {...priorityAttribute} />;
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
