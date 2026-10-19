import { Transform } from 'class-transformer';
import { SanitizeStringOptions, sanitizeString } from './sanitize.util';

export function SanitizeString(options: SanitizeStringOptions = {}) {
  return Transform(({ value }) => sanitizeString(value, options));
}

export function SanitizeEmail() {
  return SanitizeString({
    trim: true,
    lowercase: true,
    collapseWhitespace: true,
  });
}

export function SanitizePlainText() {
  return SanitizeString({
    trim: true,
    stripHtml: true,
    stripAngleBrackets: true,
  });
}

// User-written prose such as comments. It is stored as typed (minus control
// characters) because every client renders it as text, never as HTML, so
// stripping "<" would only mangle things like "a < b" or "<3".
export function SanitizeMultilineText() {
  return SanitizeString({
    trim: true,
    preserveNewlines: true,
  });
}

export function SanitizeQueryText() {
  return SanitizeString({
    trim: true,
    collapseWhitespace: true,
    stripHtml: true,
  });
}
