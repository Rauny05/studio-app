const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { safeResolvePath, validateName, validateExtension, mediaType, SAFE_ROOT } = require('../utils/security');

const router = express.Router();

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

// GET /api/projects
router.get('/', (req, res, next) => {
  let entries;
  try {
    entries = fs.readdirSync(SAFE_ROOT, { withFileTypes: true });
  } catch (e) {
    return next({ status: 500, message: 'Not found' });
  }

  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!validateName(entry.name)) continue;

    // No symlink directories
    try {
      const stat = fs.lstatSync(path.join(SAFE_ROOT, entry.name));
      if (stat.isSymbolicLink()) continue;
    } catch {
      continue;
    }

    let files;
    try {
      const dirPath = safeResolvePath(SAFE_ROOT, entry.name);
      files = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const allowed = files.filter(f => {
      if (!f.isFile()) return false;
      if (!validateName(f.name)) return false;
      const ext = path.extname(f.name).toLowerCase();
      return config.ALLOWED_EXTENSIONS.includes(ext);
    });

    const previewFile = allowed.find(f => IMAGE_EXTS.includes(path.extname(f.name).toLowerCase()));

    projects.push({
      name: entry.name,
      fileCount: allowed.length,
      previewFile: previewFile
        ? `/media/${encodeURIComponent(entry.name)}/${encodeURIComponent(previewFile.name)}`
        : null,
    });
  }

  res.json(projects);
});

// GET /api/projects/:name/files
router.get('/:name/files', (req, res, next) => {
  const { name } = req.params;

  if (!validateName(name)) {
    return next({ status: 400, message: 'Bad request' });
  }

  let dirPath;
  try {
    dirPath = safeResolvePath(SAFE_ROOT, name);
  } catch (e) {
    return next(e);
  }

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return next({ status: 404, message: 'Not found' });
  }

  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!validateName(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!config.ALLOWED_EXTENSIONS.includes(ext)) continue;

    files.push({
      name: entry.name,
      type: mediaType(ext),
      url: `/media/${encodeURIComponent(name)}/${encodeURIComponent(entry.name)}`,
    });
  }

  res.json(files);
});

module.exports = router;
