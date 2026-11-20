const softImagePlaceholderSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" preserveAspectRatio="none">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#171717" />
      <stop offset="45%" stop-color="#2a2a2a" />
      <stop offset="100%" stop-color="#101010" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)" />
      <stop offset="50%" stop-color="rgba(255,255,255,0.2)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
  </defs>
  <rect width="160" height="200" fill="url(#bg)" />
  <rect x="-60" y="0" width="60" height="200" fill="url(#glow)">
    <animate attributeName="x" from="-60" to="220" dur="1.8s" repeatCount="indefinite" />
  </rect>
</svg>
`.trim();

export const SOFT_IMAGE_BLUR_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    softImagePlaceholderSvg,
)}`;
