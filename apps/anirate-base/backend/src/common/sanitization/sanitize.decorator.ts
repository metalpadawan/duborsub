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

export function SanitizeQueryText() {
  return SanitizeString({
    trim: true,
    collapseWhitespace: true,
    stripHtml: true,
  });
}
