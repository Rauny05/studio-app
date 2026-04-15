# Portfolio Viewer

A secure, premium local media browser. Serves images, videos, and PDFs from a single root folder — beautifully.

## Prerequisites

- Node.js ≥ 18

## Install

```bash
cd portfolio-viewer
npm install
```

## Configure

Open `config.js` and set `PORTFOLIO_ROOT` to the absolute path of your portfolio folder:

```js
PORTFOLIO_ROOT: '/Users/you/your-portfolio-folder',
```

That folder should contain one subfolder per project. Each subfolder can hold any mix of supported media:
`.jpg` `.jpeg` `.png` `.gif` `.webp` `.svg` `.mp4` `.mov` `.webm` `.pdf`

## Run

```bash
npm start
```

Then open **http://localhost:3000**

For verbose error logging during development:

```bash
npm run dev
```

## Security

| Threat | Protection |
|---|---|
| Path traversal (`../../etc/passwd`) | `safeResolvePath` validates every path against the portfolio root before touching the filesystem |
| Arbitrary file reads | Extension whitelist — only configured media types are ever served |
| Symlink escapes | `lstatSync` rejects symlinks before following |
| Brute-force / scraping | Rate limiting on all API and media routes |
| Clickjacking, MIME sniffing | `helmet` sets strict security headers globally |
| Cross-origin access | CORS locked to `localhost:3000` only, GET method only |
| Info leakage in errors | Generic messages only — no paths, no stack traces, no OS info |
| XSS via filenames | All user-facing content is HTML-escaped before rendering |

This server is designed for **local use only**. Do not expose it to the internet.
