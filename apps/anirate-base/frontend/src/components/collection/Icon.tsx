// A deliberately tiny icon set, drawn on one 16px grid with one 1.5px stroke.
type IconName = 'arrow-right' | 'arrow-left';

const PATHS: Record<IconName, string> = {
  'arrow-right': 'M2.5 8h10.5M9 4l4 4-4 4',
  'arrow-left': 'M13.5 8H3M7 4 3 8l4 4',
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
