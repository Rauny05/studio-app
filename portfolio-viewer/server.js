const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'blob:', 'data:'],
      mediaSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' },
  noSniff: true,
}));

// ── CORS — localhost only ─────────────────────────────────────────────────────
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  methods: ['GET'],
}));

// ── Body size limit (belt-and-braces, no POST expected) ───────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const mediaLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const downloadLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

app.use('/api', apiLimiter);
app.use('/media', mediaLimiter);
app.use('/download', downloadLimiter);

// ── Strip query strings from all routes ───────────────────────────────────────
app.use((req, _res, next) => {
  req.query = {};
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/projects', require('./routes/projects'));
app.use('/media', require('./routes/media'));
app.use('/download', require('./routes/download'));

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for SPA (404 → index.html)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler — no info leakage ───────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const safe = {
    400: 'Bad request',
    403: 'Forbidden',
    404: 'Not found',
    429: 'Too many requests',
    500: 'Server error',
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', err);
  }

  res.status(status).json({ error: safe[status] || 'Server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`Portfolio viewer running → http://localhost:${config.PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`Root: ${config.PORTFOLIO_ROOT}`);
  }
});
