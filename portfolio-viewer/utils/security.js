const path = require('path');
const fs = require('fs');
const config = require('../config');

const SAFE_ROOT = path.resolve(config.PORTFOLIO_ROOT);

// Validate a user-supplied name (folder or file) — no path separators, no control chars
const NAME_REGEX = /^[^<>:"/\\|?*\x00-\x1f]+$/;

function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  return NAME_REGEX.test(name);
}

/**
 * Safely resolve a user-supplied path component against the portfolio root.
 * Throws a structured error with `status` if the path is unsafe or a symlink.
 */
function safeResolvePath(base, ...parts) {
  const resolved = path.resolve(base, ...parts);
  const safeBase = path.resolve(SAFE_ROOT);

  // Must be the root itself or a strict child
  if (resolved !== safeBase && !resolved.startsWith(safeBase + path.sep)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  // No symlinks — ever
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  } catch (e) {
    if (e.status === 403) throw e;
    // Path doesn't exist — let callers handle naturally
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }

  return resolved;
}

/**
 * Returns the lowercased extension, or throws 400 if ext is not whitelisted.
 */
function validateExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!config.ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return ext;
}

/**
 * Map a file extension to a media type string.
 */
function mediaType(ext) {
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.webm'].includes(ext)) return 'video';
  if (ext === '.pdf') return 'pdf';
  return 'unknown';
}

module.exports = { safeResolvePath, validateName, validateExtension, mediaType, SAFE_ROOT };
