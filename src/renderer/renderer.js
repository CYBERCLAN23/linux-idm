// Check if running in Electron or web browser
const isElectron = typeof require !== 'undefined' && typeof require('electron') !== 'undefined';
const ipcRenderer = isElectron ? require('electron').ipcRenderer : null;

// WebSocket for web mode
let ws = null;

// State
let currentView = 'all';
let currentLayout = 'grid';
let downloads = [];

// DOM Elements
const addDownloadBtn = document.getElementById('add-download-btn');
const addDownloadModal = document.getElementById('add-download-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelDownloadBtn = document.getElementById('cancel-download');
const startDownloadBtn = document.getElementById('start-download');
const browsePathBtn = document.getElementById('browse-path');
const downloadsContainer = document.getElementById('downloads-container');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const navItems = document.querySelectorAll('.nav-item');
const viewOptions = document.querySelectorAll('.view-option');

// Initialize
init();

async function init() {
  // Set default download path
  const os = typeof require !== 'undefined' ? require('os') : null;
  const path = typeof require !== 'undefined' ? require('path') : null;

  if (os && path) {
    const downloadPath = path.join(os.homedir(), 'Downloads');
    document.getElementById('download-path').value = downloadPath;
  } else {
    // Web mode - use a default
    document.getElementById('download-path').value = '/home/user/Downloads';
  }

  // Load downloads
  await loadDownloads();

  // Setup event listeners
  setupEventListeners();

  // Setup communication (IPC or WebSocket)
  if (isElectron) {
    setupIPCListeners();
  } else {
    setupWebSocket();
  }
}

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('Connected to server');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'download-progress':
        updateDownload(data.download);
        break;
      case 'download-complete':
        updateDownload(data.download);
        showNotification('Download Complete', `${data.download.filename} has been downloaded`);
        break;
      case 'download-error':
        updateDownload(data.download);
        showNotification('Download Error', `Failed to download ${data.download.filename}`);
        break;
      case 'download-update':
        updateDownload(data.download);
        break;
      case 'download-deleted':
        downloads = downloads.filter(d => d.id !== data.id);
        renderDownloads();
        updateCounts();
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    // Try to reconnect after 3 seconds
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      setupWebSocket();
    }, 3000);
  };
}

function setupEventListeners() {
  // Modal
  addDownloadBtn.addEventListener('click', showAddDownloadModal);
  closeModalBtn.addEventListener('click', hideAddDownloadModal);
  cancelDownloadBtn.addEventListener('click', hideAddDownloadModal);
  startDownloadBtn.addEventListener('click', addDownload);

  // Browse path
  browsePathBtn.addEventListener('click', async () => {
    if (isElectron) {
      const path = await ipcRenderer.invoke('select-download-path');
      if (path) {
        document.getElementById('download-path').value = path;
      }
    } else {
      // Web mode - just let user type
      alert('In web mode, please type the path manually');
    }
  });

  // Auto-populate filename from URL
  document.getElementById('download-url').addEventListener('blur', (e) => {
    const url = e.target.value;
    const filenameInput = document.getElementById('download-filename');

    if (url && !filenameInput.value) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop() || 'download';
        filenameInput.value = filename;
      } catch (error) {
        // Invalid URL
      }
    }
  });

  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentView = item.dataset.view;
      document.getElementById('view-title').textContent =
        item.querySelector('span:nth-child(2)').textContent;
      renderDownloads();
    });
  });

  // View options
  viewOptions.forEach(option => {
    option.addEventListener('click', () => {
      viewOptions.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      currentLayout = option.dataset.layout;

      if (currentLayout === 'list') {
        downloadsContainer.classList.add('list-view');
      } else {
        downloadsContainer.classList.remove('list-view');
      }
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    renderDownloads(e.target.value);
  });

  // Modal backdrop click
  addDownloadModal.addEventListener('click', (e) => {
    if (e.target === addDownloadModal) {
      hideAddDownloadModal();
    }
  });
}

function setupIPCListeners() {
  ipcRenderer.on('download-progress', (event, download) => {
    updateDownload(download);
  });

  ipcRenderer.on('download-complete', (event, download) => {
    updateDownload(download);
    showNotification('Download Complete', `${download.filename} has been downloaded`);
  });

  ipcRenderer.on('download-error', (event, download) => {
    updateDownload(download);
    showNotification('Download Error', `Failed to download ${download.filename}`);
  });

  ipcRenderer.on('show-add-download', () => {
    showAddDownloadModal();
  });
}

async function loadDownloads() {
  if (isElectron) {
    downloads = await ipcRenderer.invoke('get-downloads');
  } else {
    // Web mode - fetch from API
    try {
      const response = await fetch('/api/downloads');
      downloads = await response.json();
    } catch (error) {
      console.error('Error loading downloads:', error);
      downloads = [];
    }
  }
  renderDownloads();
  updateCounts();
}

function showAddDownloadModal() {
  addDownloadModal.classList.add('show');
}

function hideAddDownloadModal() {
  addDownloadModal.classList.remove('show');
  // Reset form
  document.getElementById('download-url').value = '';
  document.getElementById('download-filename').value = '';
  document.getElementById('download-chunks').value = '4';
}

async function addDownload() {
  const url = document.getElementById('download-url').value.trim();
  const filename = document.getElementById('download-filename').value.trim();
  const savePath = document.getElementById('download-path').value.trim();
  const chunks = parseInt(document.getElementById('download-chunks').value);

  if (!url || !filename || !savePath) {
    alert('Please fill in all fields');
    return;
  }

  let download;

  if (isElectron) {
    download = await ipcRenderer.invoke('add-download', {
      url,
      filename,
      savePath,
      chunks
    });
  } else {
    // Web mode - call API
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, filename, savePath, chunks })
      });
      download = await response.json();
    } catch (error) {
      alert('Error starting download: ' + error.message);
      return;
    }
  }

  downloads.unshift(download);
  renderDownloads();
  updateCounts();
  hideAddDownloadModal();
  showNotification('Download Started', `Downloading ${filename}`);
}

async function pauseDownload(id) {
  if (isElectron) {
    const download = await ipcRenderer.invoke('pause-download', id);
    updateDownload(download);
  } else {
    try {
      const response = await fetch(`/api/download/${id}/pause`, { method: 'POST' });
      const download = await response.json();
      updateDownload(download);
    } catch (error) {
      console.error('Error pausing download:', error);
    }
  }
}

async function resumeDownload(id) {
  if (isElectron) {
    const download = await ipcRenderer.invoke('resume-download', id);
    updateDownload(download);
  } else {
    try {
      const response = await fetch(`/api/download/${id}/resume`, { method: 'POST' });
      const download = await response.json();
      updateDownload(download);
    } catch (error) {
      console.error('Error resuming download:', error);
    }
  }
}

async function cancelDownload(id) {
  if (confirm('Are you sure you want to cancel this download?')) {
    if (isElectron) {
      await ipcRenderer.invoke('cancel-download', id);
    } else {
      try {
        await fetch(`/api/download/${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Error cancelling download:', error);
      }
    }
    downloads = downloads.filter(d => d.id !== id);
    renderDownloads();
    updateCounts();
  }
}

async function deleteDownload(id) {
  if (confirm('Are you sure you want to delete this download and its file?')) {
    if (isElectron) {
      await ipcRenderer.invoke('delete-download', id);
    } else {
      try {
        await fetch(`/api/download/${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Error deleting download:', error);
      }
    }
    downloads = downloads.filter(d => d.id !== id);
    renderDownloads();
    updateCounts();
  }
}

function updateDownload(updatedDownload) {
  const index = downloads.findIndex(d => d.id === updatedDownload.id);
  if (index !== -1) {
    downloads[index] = updatedDownload;
    renderDownloads();
    updateCounts();
  }
}

function renderDownloads(searchTerm = '') {
  let filteredDownloads = downloads;

  // Filter by view
  if (currentView !== 'all') {
    filteredDownloads = filteredDownloads.filter(d => d.status === currentView);
  }

  // Filter by search
  if (searchTerm) {
    filteredDownloads = filteredDownloads.filter(d =>
      d.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (filteredDownloads.length === 0) {
    downloadsContainer.innerHTML = '';
    emptyState.classList.add('show');
    return;
  }

  emptyState.classList.remove('show');

  downloadsContainer.innerHTML = filteredDownloads.map(download => {
    const percentage = download.progress || 0;
    const downloadedMB = (download.downloadedSize / (1024 * 1024)).toFixed(2);
    const totalMB = (download.totalSize / (1024 * 1024)).toFixed(2);

    return `
      <div class="download-card" data-id="${download.id}">
        <div class="download-card-header">
          <div class="download-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div class="download-info">
            <div class="download-name" title="${download.filename}">${download.filename}</div>
            <div class="download-size">${totalMB > 0 ? `${downloadedMB} / ${totalMB} MB` : 'Unknown size'}</div>
          </div>
          <span class="download-status ${download.status}">${download.status}</span>
        </div>
        
        ${download.status !== 'error' ? `
          <div class="download-progress">
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-info">
              <span>${percentage}%</span>
              <span>${download.speed || 0} KB/s</span>
            </div>
          </div>
        ` : `
          <div style="color: var(--error); font-size: 13px; margin-bottom: 16px;">
            ${download.error || 'Download failed'}
          </div>
        `}
        
        <div class="download-actions">
          ${download.status === 'downloading' ? `
            <button class="action-btn" onclick="pauseDownload('${download.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              Pause
            </button>
          ` : download.status === 'paused' ? `
            <button class="action-btn" onclick="resumeDownload('${download.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Resume
            </button>
          ` : ''}
          
          ${download.status === 'downloading' || download.status === 'paused' ? `
            <button class="action-btn danger" onclick="cancelDownload('${download.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Cancel
            </button>
          ` : download.status === 'completed' && isElectron ? `
            <button class="action-btn" onclick="openDownloadLocation('${download.savePath.replace(/\\/g, '\\\\')}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              Open Folder
            </button>
            <button class="action-btn danger" onclick="deleteDownload('${download.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          ` : `
            <button class="action-btn danger" onclick="deleteDownload('${download.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function updateCounts() {
  const allCount = downloads.length;
  const downloadingCount = downloads.filter(d => d.status === 'downloading').length;
  const completedCount = downloads.filter(d => d.status === 'completed').length;
  const pausedCount = downloads.filter(d => d.status === 'paused').length;

  document.getElementById('all-count').textContent = allCount;
  document.getElementById('downloading-count').textContent = downloadingCount;
  document.getElementById('completed-count').textContent = completedCount;
  document.getElementById('paused-count').textContent = pausedCount;
  document.getElementById('total-downloads').textContent = allCount;

  // Calculate total speed
  const totalSpeed = downloads
    .filter(d => d.status === 'downloading')
    .reduce((sum, d) => sum + (d.speed || 0), 0);
  document.getElementById('total-speed').textContent = `${totalSpeed.toFixed(2)} KB/s`;
}

function openDownloadLocation(downloadPath) {
  if (isElectron) {
    require('electron').shell.showItemInFolder(downloadPath);
  }
}

function showNotification(title, body) {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }
}

// Make functions global for onclick handlers
window.pauseDownload = pauseDownload;
window.resumeDownload = resumeDownload;
window.cancelDownload = cancelDownload;
window.deleteDownload = deleteDownload;
window.openDownloadLocation = openDownloadLocation;
