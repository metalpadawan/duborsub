// AuthLayout is the black room: the product's thesis on a gallery-black wall, the form on
// the white one. Stateless, so auth pages stay simple to test.
import type { ReactNode } from 'react';

const POINTS = [
  { name: 'Sub', text: 'Rate the subtitled release on its own terms.' },
  { name: 'Dub', text: 'Rate the dub separately. The two scores never blend.' },
  { name: 'Notes', text: 'Leave a note for the next viewer deciding how to watch.' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="room">
      <aside className="room__wall">
        <a className="brand" href="/" aria-label="AniRate, home">
          <span className="brand__mark" aria-hidden="true" />
          AniRate
        </a>

        <div className="room__thesis">
          <p className="display" style={{ fontSize: 'clamp(2.5rem, 4.6vw, 4.5rem)' }}>
            Two versions.
            <br />
            Two scores.
          </p>
          <ul className="room__points">
            {POINTS.map((point) => (
              <li key={point.name}>
                <span className="signage">{point.name}</span>
                <span>{point.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main id="main" className="room__desk">
        <div className="room__form">
          <div className="room__form-head">
            <h1 className="title-l">{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

// Password input with a show/hide control. The control's name avoids the word
// "password" so the field keeps a single accessible label match.
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  describedBy,
  visible,
  onToggle,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  describedBy?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="input-group">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="input"
        required
        minLength={minLength}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" className="input-group__action" aria-pressed={visible} aria-controls={id} onClick={onToggle}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// The backend's password policy, shown as it is met rather than after a failed submit.
export const PASSWORD_RULES: Array<{ id: string; label: string; test: (value: string) => boolean }> = [
  { id: 'length', label: '8 or more characters', test: (value) => value.length >= 8 && value.length <= 72 },
  { id: 'case', label: 'Upper and lower case', test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { id: 'digit', label: 'A number', test: (value) => /\d/.test(value) },
  { id: 'symbol', label: 'One of @ $ ! % * ? & _ - #', test: (value) => /[@$!%*?&_\-#]/.test(value) },
];

export function PasswordRules({ id, value }: { id: string; value: string }) {
  return (
    <ul className="rules" id={id} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} data-met={met}>
            {rule.label}
            <span className="visually-hidden">{met ? ' (met)' : ' (not met yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function errorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join('. ');
  }

  return message ?? fallback;
}
