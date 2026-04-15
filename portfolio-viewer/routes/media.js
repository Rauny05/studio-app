const express = require('express');
const path = require('path');
const { safeResolvePath, validateName, validateExtension, SAFE_ROOT } = require('../utils/security');

const router = express.Router();

// GET /media/:project/:file
router.get('/:project/:file', (req, res, next) => {
  const { project, file } = req.params;

  if (!validateName(project) || !validateName(file)) {
    return next({ status: 400, message: 'Bad request' });
  }

  let ext;
  try {
    ext = validateExtension(file);
  } catch (e) {
    return next(e);
  }

  let resolvedProject;
  try {
    resolvedProject = safeResolvePath(SAFE_ROOT, project);
  } catch (e) {
    return next(e);
  }

  let resolvedFile;
  try {
    resolvedFile = safeResolvePath(resolvedProject, file);
  } catch (e) {
    return next(e);
  }

  res.set('Cache-Control', 'private, max-age=3600');

  res.sendFile(resolvedFile, { root: '/' }, (err) => {
    if (err) {
      next({ status: 404, message: 'Not found' });
    }
  });
});

module.exports = router;
