// The link-preview card: the site's statement on the gallery wall, with the two
// measures the whole site is built around.
import { ImageResponse } from 'next/og';

export const alt = 'AniRate: two versions, two scores';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#f3f3f1',
          color: '#111111',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 26, height: 26, background: '#111111' }} />
          AniRate
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 104, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>
          <span>Two versions.</span>
          <span>Two scores.</span>
        </div>
        <div style={{ display: 'flex', gap: 64, fontSize: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 360 }}>
            <span style={{ letterSpacing: 4, color: '#002fa7' }}>SUB</span>
            <div style={{ height: 6, background: '#002fa7', width: '86%' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 360 }}>
            <span style={{ letterSpacing: 4 }}>DUB</span>
            <div style={{ height: 6, background: '#111111', width: '72%' }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
