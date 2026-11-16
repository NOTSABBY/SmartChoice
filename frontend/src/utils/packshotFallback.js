export function generatePackshotSvgClient(
  brand,
  productName,
  packagingSize,
  categoryId = 1,
  dietaryType = 'VEG'
) {
  const categoryPalettes = {
    1: { bg: '#F59E0B', accent: '#B45309', icon: '🍪' },
    2: { bg: '#10B981', accent: '#047857', icon: '🥣' },
    3: { bg: '#EF4444', accent: '#B91C1C', icon: '🍜' },
    4: { bg: '#8B5CF6', accent: '#6D28D9', icon: '🍫' },
    5: { bg: '#F97316', accent: '#C2410C', icon: '🧃' },
    6: { bg: '#E11D48', accent: '#9F1239', icon: '🥫' },
    7: { bg: '#EC4899', accent: '#BE185D', icon: '🍯' },
    8: { bg: '#FBBF24', accent: '#D97706', icon: '🥔' },
    9: { bg: '#78350F', accent: '#451A03', icon: '☕' },
    10: { bg: '#DC2626', accent: '#991B1B', icon: '🌶️' },
    11: { bg: '#CA8A04', accent: '#854D0E', icon: '🫒' },
    12: { bg: '#EA580C', accent: '#9A3412', icon: '🍛' },
    13: { bg: '#3B82F6', accent: '#1D4ED8', icon: '🧀' },
    14: { bg: '#06B6D4', accent: '#0E7490', icon: '⚡' },
    15: { bg: '#D97706', accent: '#92400E', icon: '🥨' },
    16: { bg: '#65A30D', accent: '#3F6212', icon: '🫙' },
    17: { bg: '#A16207', accent: '#713F12', icon: '🌾' },
    18: { bg: '#854D0E', accent: '#581C87', icon: '🥜' },
    19: { bg: '#4F46E5', accent: '#3730A3', icon: '🧁' },
    20: { bg: '#0D9488', accent: '#115E59', icon: '🍲' },
    21: { bg: '#059669', accent: '#065F46', icon: '💪' },
    22: { bg: '#D97706', accent: '#B45309', icon: '🌾' },
    23: { bg: '#2563EB', accent: '#1E40AF', icon: '🥤' },
    24: { bg: '#BE185D', accent: '#831843', icon: '🍮' },
    25: { bg: '#0284C7', accent: '#0369A1', icon: '🍦' },
  };

  const theme = categoryPalettes[categoryId] || { bg: '#3B82F6', accent: '#1D4ED8', icon: '📦' };
  const brandClean = (brand || 'GENUINE').toUpperCase().slice(0, 22);
  const prodClean = (productName || 'Authentic Food').slice(0, 36);
  const packClean = (packagingSize || 'Standard Pack').slice(0, 18);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg}"/>
      <stop offset="100%" stop-color="${theme.accent}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="24" fill="url(#g)"/>
  <rect x="20" y="20" width="360" height="360" rx="16" fill="#FFFFFF" fill-opacity="0.94"/>
  <text x="360" y="52" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="28" text-anchor="end">${theme.icon}</text>
  <text x="200" y="110" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="900" font-size="16" fill="#6B7280" text-anchor="middle" letter-spacing="1.5">${brandClean}</text>
  <text x="200" y="150" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800" font-size="20" fill="#111827" text-anchor="middle">${prodClean}</text>
  <rect x="140" y="190" width="120" height="120" rx="20" fill="${theme.bg}" fill-opacity="0.15"/>
  <text x="200" y="265" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="64" text-anchor="middle">${theme.icon}</text>
  <rect x="120" y="330" width="160" height="30" rx="15" fill="#F3F4F6"/>
  <text x="200" y="350" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#4B5563" text-anchor="middle">${packClean}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
