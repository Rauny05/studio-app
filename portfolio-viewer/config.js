module.exports = {
  PORTFOLIO_ROOT: '/Users/raunaqrm/Documents/Browser-Project', // ← USER: only change this line
  PORT: 3000,
  ALLOWED_ORIGINS: ['http://localhost:3000'],
  MAX_FILE_SIZE_MB: 200,
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
                        '.mp4', '.mov', '.webm', '.pdf'],
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 300,
};
