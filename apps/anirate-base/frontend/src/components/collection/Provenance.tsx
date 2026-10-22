// The wall label's provenance line. Each phrase stays whole when the line wraps.
import { provenanceParts } from '@/lib/provenance';

export function Provenance({
  anime,
  className = 'provenance',
  block = false,
}: {
  anime: { id: string; hasDub: boolean; description?: string | null };
  className?: string;
  block?: boolean;
}) {
  const [source, dub] = provenanceParts(anime);
  const Tag = block ? 'p' : 'span';

  return (
    <Tag className={className}>
      <span className="nowrap">{source}</span>
      <span aria-hidden="true"> · </span>
      <span className="visually-hidden">, </span>
      <span className="nowrap">{dub}</span>
    </Tag>
  );
}
