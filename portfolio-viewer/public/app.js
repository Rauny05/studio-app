// ── State ──────────────────────────────────────────────────────
let allProjects = [];
let currentFiles = [];
let lightboxImages = [];
let lightboxIndex = 0;
let panelOpen = false;
let currentProjectName = '';

// ── DOM refs ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const skeletonGrid   = $('skeletonGrid');
const projectGrid    = $('projectGrid');
const emptyState     = $('emptyState');
const errorState     = $('errorState');
const projectCount   = $('projectCountLabel');
const mobileNavLabel = $('mobileNavLabel');
const panelBackdrop  = $('panelBackdrop');
const panel          = $('panel');
const panelTitle     = $('panelTitle');
const panelFileCount = $('panelFileCount');
const panelBody      = $('panelBody');
const dlFolderBtn    = $('dlFolderBtn');
const lightbox       = $('lightbox');
const lbImg          = $('lbImg');
const lbCounter      = $('lbCounter');
const toastContainer = $('toastContainer');

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

// ── Download helper ────────────────────────────────────────────
function startDownload(url, toastMsg) {
  if (toastMsg) showToast(toastMsg);
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

// ── Fetch projects ─────────────────────────────────────────────
async function loadProjects() {
  skeletonGrid.style.display = 'grid';
  projectGrid.style.display  = 'none';
  emptyState.style.display   = 'none';
  errorState.style.display   = 'none';

  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Server error');
    allProjects = await res.json();
  } catch {
    skeletonGrid.style.display = 'none';
    errorState.style.display   = 'flex';
    return;
  }

  skeletonGrid.style.display = 'none';

  if (allProjects.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  const label = `${allProjects.length} project${allProjects.length !== 1 ? 's' : ''}`;
  projectCount.textContent   = label;
  mobileNavLabel.textContent = label;

  renderGrid(allProjects);
  projectGrid.style.display = 'grid';
}

// ── Render grid ────────────────────────────────────────────────
function renderGrid(projects) {
  projectGrid.innerHTML = '';

  projects.forEach((proj, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${i * 0.05}s`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open project: ${proj.name}`);

    const bg = document.createElement('div');
    bg.className = 'card-bg' + (proj.previewFile ? '' : ' no-image');
    if (proj.previewFile) {
      bg.style.backgroundImage = `url('${escUrl(proj.previewFile)}')`;
    }

    card.innerHTML = `
      <div class="card-overlay"></div>
      <div class="card-hover-overlay">
        <div class="card-cta">Open →</div>
      </div>
      <div class="card-info">
        <div class="card-name">${escHtml(proj.name)}</div>
        <div class="card-count">${proj.fileCount} file${proj.fileCount !== 1 ? 's' : ''}</div>
      </div>
      <a class="card-dl" href="/download/project/${encodeURIComponent(proj.name)}" title="Download folder" aria-label="Download ${escHtml(proj.name)}">↓</a>
    `;
    card.insertBefore(bg, card.firstChild);

    // Card-level download button — stop propagation so it doesn't open the panel
    card.querySelector('.card-dl').addEventListener('click', e => {
      e.stopPropagation();
      showToast(`Preparing "${proj.name}"…`);
    });

    card.addEventListener('click', () => openPanel(proj.name));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(proj.name); }
    });

    projectGrid.appendChild(card);
  });
}

// ── Open panel ─────────────────────────────────────────────────
async function openPanel(projectName) {
  currentProjectName = projectName;
  panelTitle.textContent     = projectName;
  panelFileCount.textContent = '';
  panelBody.innerHTML        = '<div class="panel-loading"><div class="spinner"></div></div>';
  dlFolderBtn.href           = `/download/project/${encodeURIComponent(projectName)}`;
  panelBackdrop.classList.add('open');
  panel.classList.add('open');
  panelOpen = true;

  let files;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/files`);
    if (!res.ok) throw new Error('Load error');
    files = await res.json();
  } catch {
    panelBody.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Failed to load files.</p>`;
    return;
  }

  currentFiles = files;
  panelFileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
  renderPanelBody(files, projectName);
}

function renderPanelBody(files, projectName) {
  const images = files.filter(f => f.type === 'image');
  const videos = files.filter(f => f.type === 'video');
  const pdfs   = files.filter(f => f.type === 'pdf');

  lightboxImages = images;

  let html = '';

  if (images.length) {
    html += `<div class="section-label">${images.length} Image${images.length !== 1 ? 's' : ''}</div>`;
    html += `<div class="image-masonry">`;
    images.forEach((img, idx) => {
      const dlUrl = `/download/file/${encodeURIComponent(projectName)}/${encodeURIComponent(img.name)}`;
      html += `<div class="masonry-item" data-lb-index="${idx}">
        <img src="${escUrl(img.url)}" alt="${escHtml(img.name)}" loading="lazy" />
        <a class="dl-overlay" href="${escDlUrl(dlUrl)}" title="Download ${escHtml(img.name)}" data-dl>↓</a>
      </div>`;
    });
    html += `</div>`;
  }

  if (videos.length) {
    html += `<div class="section-label">${videos.length} Video${videos.length !== 1 ? 's' : ''}</div>`;
    html += `<div class="video-list">`;
    videos.forEach(vid => {
      const dlUrl = `/download/file/${encodeURIComponent(projectName)}/${encodeURIComponent(vid.name)}`;
      html += `<div>
        <video controls preload="metadata" playsinline>
          <source src="${escUrl(vid.url)}" />
          Your browser does not support video playback.
        </video>
        <div class="video-actions">
          <span class="video-label">${escHtml(vid.name)}</span>
          <a class="btn-dl" href="${escDlUrl(dlUrl)}" title="Download" data-dl>↓ Download</a>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  if (pdfs.length) {
    html += `<div class="section-label">${pdfs.length} PDF${pdfs.length !== 1 ? 's' : ''}</div>`;
    html += `<div class="pdf-list">`;
    pdfs.forEach(pdf => {
      const dlUrl = `/download/file/${encodeURIComponent(projectName)}/${encodeURIComponent(pdf.name)}`;
      html += `<div style="display:flex;align-items:center;gap:8px;">
        <a class="pdf-link" href="${escUrl(pdf.url)}" target="_blank" rel="noopener noreferrer" style="flex:1">
          <span class="pdf-icon">⬛</span>
          ${escHtml(pdf.name)}
        </a>
        <a class="btn-dl" href="${escDlUrl(dlUrl)}" title="Download" data-dl>↓</a>
      </div>`;
    });
    html += `</div>`;
  }

  if (!html) {
    html = `<p style="color:var(--muted);font-size:.85rem;margin-top:16px;">No supported media files in this project.</p>`;
  }

  panelBody.innerHTML = html;

  // Lightbox triggers — skip clicks on download overlays
  panelBody.querySelectorAll('[data-lb-index]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-dl]')) return;
      openLightbox(parseInt(el.dataset.lbIndex, 10));
    });
  });

  // Toast on individual downloads
  panelBody.querySelectorAll('[data-dl]').forEach(a => {
    a.addEventListener('click', e => {
      e.stopPropagation();
      showToast('Downloading…');
    });
  });
}

// ── Close panel ────────────────────────────────────────────────
function closePanel() {
  panel.classList.remove('open');
  panelBackdrop.classList.remove('open');
  panelOpen = false;
}

$('panelClose').addEventListener('click', closePanel);
panelBackdrop.addEventListener('click', closePanel);

// Folder download button toast
dlFolderBtn.addEventListener('click', () => {
  if (currentProjectName) showToast(`Preparing "${currentProjectName}"…`);
});

// Global download-all toast
$('dlAllBtn').addEventListener('click', () => {
  showToast('Preparing portfolio.zip…');
});

// ── Sheet drag-to-dismiss (mobile) ─────────────────────────────
let touchStartY = 0;
$('sheetHandle').addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
$('sheetHandle').addEventListener('touchend', e => {
  const delta = e.changedTouches[0].clientY - touchStartY;
  if (delta > 60) closePanel();
});

// ── Lightbox ───────────────────────────────────────────────────
function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  lightbox.classList.add('open');
}

function closeLightbox() {
  lightbox.classList.remove('open');
}

function renderLightbox() {
  if (!lightboxImages.length) return;
  const img = lightboxImages[lightboxIndex];
  lbImg.src = escUrl(img.url);
  lbImg.alt = img.name;
  lbCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
}

function lbNavigate(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}

$('lbClose').addEventListener('click', closeLightbox);
$('lbPrev').addEventListener('click', () => lbNavigate(-1));
$('lbNext').addEventListener('click', () => lbNavigate(1));

// Lightbox download button
$('lbDownload').addEventListener('click', () => {
  if (!lightboxImages.length) return;
  const img = lightboxImages[lightboxIndex];
  startDownload(`/download/file/${encodeURIComponent(currentProjectName)}/${encodeURIComponent(img.name)}`, 'Downloading…');
});

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

// ── Keyboard navigation ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('open')) {
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  lbNavigate(-1);
    if (e.key === 'ArrowRight') lbNavigate(1);
    return;
  }
  if (panelOpen && e.key === 'Escape') closePanel();
});

// ── Retry button ───────────────────────────────────────────────
$('retryBtn').addEventListener('click', loadProjects);

// ── Escape helpers ─────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escUrl(url) {
  if (typeof url !== 'string') return '';
  if (!url.startsWith('/media/')) return '';
  return url.replace(/"/g, '%22').replace(/'/g, '%27');
}

function escDlUrl(url) {
  if (typeof url !== 'string') return '';
  if (!url.startsWith('/download/')) return '';
  return url.replace(/"/g, '%22').replace(/'/g, '%27');
}

// ── Boot ───────────────────────────────────────────────────────
loadProjects();
