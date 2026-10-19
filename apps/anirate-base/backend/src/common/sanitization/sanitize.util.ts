export interface SanitizeStringOptions {
  trim?: boolean;
  lowercase?: boolean;
  collapseWhitespace?: boolean;
  stripHtml?: boolean;
  stripAngleBrackets?: boolean;
  preserveNewlines?: boolean;
}

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
// Same set minus tab (\u0009) and line feed (\u000A), for multi-line text.
const CONTROL_CHARACTERS_EXCEPT_NEWLINES = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const MULTI_WHITESPACE = /\s+/g;
const HTML_TAGS = /<[^>]*>/g;

export function sanitizeString(value: unknown, options: SanitizeStringOptions = {}) {
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value.normalize('NFKC');
  sanitized = options.preserveNewlines
    ? sanitized.replace(/\r\n?/g, '\n').replace(CONTROL_CHARACTERS_EXCEPT_NEWLINES, '')
    : sanitized.replace(CONTROL_CHARACTERS, '');

  if (options.stripHtml) {
    sanitized = sanitized.replace(HTML_TAGS, '');
  }

  if (options.stripAngleBrackets) {
    sanitized = sanitized.replace(/[<>]/g, '');
  }

  if (options.collapseWhitespace) {
    sanitized = sanitized.replace(MULTI_WHITESPACE, ' ');
  }

  if (options.trim ?? true) {
    sanitized = sanitized.trim();
  }

  if (options.lowercase) {
    sanitized = sanitized.toLowerCase();
  }

  return sanitized;
}
