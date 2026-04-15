const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const config = require('../config');
const { safeResolvePath, validateName, SAFE_ROOT } = require('../utils/security');

const router = express.Router();

// Sanitize a name to be safe inside a Content-Disposition filename
function safeFilename(name) {
  return name.replace(/[^\w\s.\-]/g, '_');
}

function addAllowedFiles(archive, dirPath, prefix) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const f of entries) {
    if (!f.isFile()) continue;
    if (!validateName(f.name)) continue;
    const ext = path.extname(f.name).toLowerCase();
    if (!config.ALLOWED_EXTENSIONS.includes(ext)) continue;

    try {
      const filePath = safeResolvePath(dirPath, f.name);
      archive.file(filePath, { name: prefix ? `${prefix}/${f.name}` : f.name });
    } catch {
      // skip unsafe paths
    }
  }
}

// GET /download/file/:project/:file — single file as attachment
router.get('/file/:project/:file', (req, res, next) => {
  const { project, file } = req.params;

  if (!validateName(project) || !validateName(file)) {
    return next({ status: 400, message: 'Bad request' });
  }

  const ext = path.extname(file).toLowerCase();
  if (!config.ALLOWED_EXTENSIONS.includes(ext)) {
    return next({ status: 403, message: 'Forbidden' });
  }

  let resolvedProject;
  try {
    resolvedProject = safeResolvePath(SAFE_ROOT, project);
  } catch (e) { return next(e); }

  let resolvedFile;
  try {
    resolvedFile = safeResolvePath(resolvedProject, file);
  } catch (e) { return next(e); }

  res.set('Content-Disposition', `attachment; filename="${safeFilename(file)}"`);
  res.set('Cache-Control', 'private, max-age=3600');

  res.sendFile(resolvedFile, { root: '/' }, (err) => {
    if (err) next({ status: 404, message: 'Not found' });
  });
});

// GET /download/project/:name — zip all files in one folder
router.get('/project/:name', (req, res, next) => {
  const { name } = req.params;

  if (!validateName(name)) {
    return next({ status: 400, message: 'Bad request' });
  }

  let dirPath;
  try {
    dirPath = safeResolvePath(SAFE_ROOT, name);
  } catch (e) { return next(e); }

  res.set('Content-Disposition', `attachment; filename="${safeFilename(name)}.zip"`);
  res.set('Content-Type', 'application/zip');
  res.set('Cache-Control', 'no-store');

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', () => res.end());
  archive.pipe(res);

  addAllowedFiles(archive, dirPath, null);
  archive.finalize();
});

// GET /download/all — zip everything across all projects
router.get('/all', (_req, res, next) => {
  let projectEntries;
  try {
    projectEntries = fs.readdirSync(SAFE_ROOT, { withFileTypes: true });
  } catch {
    return next({ status: 500, message: 'Server error' });
  }

  res.set('Content-Disposition', 'attachment; filename="portfolio.zip"');
  res.set('Content-Type', 'application/zip');
  res.set('Cache-Control', 'no-store');

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', () => res.end());
  archive.pipe(res);

  for (const proj of projectEntries) {
    if (!proj.isDirectory()) continue;
    if (!validateName(proj.name)) continue;

    let dirPath;
    try {
      dirPath = safeResolvePath(SAFE_ROOT, proj.name);
    } catch { continue; }

    addAllowedFiles(archive, dirPath, proj.name);
  }

  archive.finalize();
});

module.exports = router;
