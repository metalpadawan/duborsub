// Archivo carries the whole identity: its width axis turns the same family into
// wall-label signage (expanded) and display lettering (normal width).
// next/font self-hosts it at build time, so no request leaves for Google at runtime.
import { Archivo } from 'next/font/google';

export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});
