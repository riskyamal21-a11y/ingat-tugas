/**
 * IngatTugas - Single Page Application
 * Ekstraksi Foto Tugas via Tesseract.js, Sinkronisasi Supabase & Google Calendar
 */

// ==========================================
// 1. Konfigurasi Supabase
// ==========================================
const SUPABASE_URL = https://ybdefjvxpxpiiiehqvfc.supabase.co;
const SUPABASE_KEY = sb_publishable_k2W1baGA8E4oJjnlBEEkjw_2_mf1xk3;

let supabaseClient = null;
const isSupabaseConfigured = SUPABASE_KEY && SUPABASE_KEY !== 'PASTE_ANON_KEY_DISINI';

if (isSupabaseConfigured && window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[IngatTugas] Terkoneksi dengan Supabase Client');
  } catch (err) {
    console.error('[IngatTugas] Gagal inisialisasi Supabase:', err);
  }
}

// ==========================================
// 2. DOM Elements
// ==========================================
const dropzone = document.getElementById('dropzone');
const dropzonePrompt = document.getElementById('dropzonePrompt');
const imageInput = document.getElementById('imageInput');
const previewWrapper = document.getElementById('previewWrapper');
const imagePreview = document.getElementById('imagePreview');
const btnChangeImage = document.getElementById('btnChangeImage');
const btnProcessImage = document.getElementById('btnProcessImage');

const progressContainer = document.getElementById('progressContainer');
const progressStatus = document.getElementById('progressStatus');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');

const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDeadline = document.getElementById('taskDeadline');
const taskNotes = document.getElementById('taskNotes');
const btnSaveTask = document.getElementById('btnSaveTask');
const btnAddToCalendar = document.getElementById('btnAddToCalendar');

const tasksList = document.getElementById('tasksList');
const tasksSummary = document.getElementById('tasksSummary');
const btnRefreshTasks = document.getElementById('btnRefreshTasks');
const notificationBanner = document.getElementById('notificationBanner');

let currentImageFile = null;

// ==========================================
// 3. Notifikasi & Banner
// ==========================================
function showNotification(message, type = 'info', timeout = 5000) {
  notificationBanner.className = `notification-banner ${type}`;
  notificationBanner.innerHTML = `<span>${message}</span><button onclick="this.parentElement.classList.add('hidden')" style="background:none;border:none;cursor:pointer;font-weight:bold;color:inherit;margin-left:8px;">✕</button>`;
  notificationBanner.classList.remove('hidden');

  if (timeout > 0) {
    setTimeout(() => {
      notificationBanner.classList.add('hidden');
    }, timeout);
  }
}

// Cek apakah key masih placeholder saat pertama kali dimuat
function checkSupabaseStatus() {
  if (!isSupabaseConfigured) {
    showNotification(
      '⚠️ <strong>Mode Penyimpanan Lokal Aktif</strong>: Supabase Anon Key masih default. Data tugas sementara disimpan di memori browser (LocalStorage). Masukkan Anon Key asli di file <code>app.js</code> untuk menyimpan ke database cloud Supabase.',
      'warning',
      0
    );
  }
}

// ==========================================
// 4. File Upload & Drag-and-Drop Handling
// ==========================================
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleSelectedFile(file);
});

// Drag and drop events
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleSelectedFile(file);
  } else {
    showNotification('Silakan unggah file berupa gambar (JPG, PNG, WEBP).', 'error');
  }
});

btnChangeImage.addEventListener('click', (e) => {
  e.stopPropagation();
  resetImageUpload();
});

function handleSelectedFile(file) {
  currentImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    dropzonePrompt.classList.add('hidden');
    previewWrapper.classList.remove('hidden');
    btnProcessImage.disabled = false;
  };
  reader.readAsDataURL(file);
}

function resetImageUpload() {
  currentImageFile = null;
  imageInput.value = '';
  imagePreview.src = '';
  previewWrapper.classList.add('hidden');
  dropzonePrompt.classList.remove('hidden');
  btnProcessImage.disabled = true;
  progressContainer.classList.add('hidden');
  progressBar.style.width = '0%';
}

// ==========================================
// 5. OCR & Ekstraksi Cerdas (Tesseract.js)
// ==========================================
btnProcessImage.addEventListener('click', async () => {
  if (!currentImageFile) return;

  if (typeof Tesseract === 'undefined') {
    showNotification('Tesseract.js gagal dimuat dari CDN. Periksa koneksi internet Anda.', 'error');
    return;
  }

  try {
    btnProcessImage.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '5%';
    progressStatus.textContent = 'Memulai pembacaan gambar...';
    progressPercent.textContent = '5%';

    // Menjalankan OCR dengan Tesseract v5 (ind + eng)
    const result = await Tesseract.recognize(
      currentImageFile,
      'ind+eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            progressBar.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            progressStatus.textContent = `Mengenali teks: ${pct}%`;
          } else {
            progressStatus.textContent = m.status || 'Memproses...';
          }
        }
      }
    );

    const extractedText = result.data.text || '';
    if (!extractedText.trim()) {
      showNotification('Tidak ada teks terbaca dari gambar. Coba gunakan gambar yang lebih jelas.', 'warning');
      return;
    }

    // Ekstraksi data tugas cerdas dari teks OCR
    parseOcrText(extractedText);
    showNotification('🎉 Ekstraksi teks selesai! Silakan periksa formulir hasil di sebelah kanan.', 'success');

  } catch (error) {
    console.error('[IngatTugas OCR Error]', error);
    showNotification('Terjadi kesalahan saat memproses gambar: ' + (error.message || error), 'error');
  } finally {
    btnProcessImage.disabled = false;
    setTimeout(() => {
      progressContainer.classList.add('hidden');
    }, 2000);
  }
});

/**
 * Parsing teks OCR untuk mengekstrak Judul, Deadline, dan Catatan
 */
function parseOcrText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Ekstraksi Tanggal & Waktu
  const parsedDate = extractDeadlineDate(rawText);
  if (parsedDate) {
    taskDeadline.value = formatDateTimeLocal(parsedDate);
  } else {
    // Default deadline: Besok pukul 23:59 jika tanggal tidak terdeteksi
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    taskDeadline.value = formatDateTimeLocal(tomorrow);
  }

  // 2. Ekstraksi Judul Tugas
  const detectedTitle = extractTitle(lines);
  taskTitle.value = detectedTitle || 'Tugas Baru';

  // 3. Catatan / Detail: simpan teks lengkap hasil OCR
  taskNotes.value = `[Hasil OCR]\n${rawText.trim()}`;

  // Perbarui link Google Calendar
  updateGoogleCalendarLink();
}

/**
 * Mendeteksi tanggal dan waktu dari teks (format Indonesia & Numerik)
 */
function extractDeadlineDate(text) {
  const monthMap = {
    januari: 0, jan: 0,
    februari: 1, feb: 1,
    maret: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4, may: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    agustus: 7, agu: 7, ags: 7, aug: 7,
    september: 8, sep: 8, okt: 9, oktober: 9, oct: 9,
    november: 10, nov: 10,
    desember: 11, des: 11, dec: 11
  };

  const currentYear = new Date().getFullYear();
  let foundDate = null;
  let hours = 23;
  let minutes = 59;

  // Cek jam terlebih dahulu: "pukul 14.00", "jam 23:59", "14:30"
  const timeRegex = /(?:pukul|jam)?\s*(\b[0-2]?[0-9])[:.]([0-5][0-9])\b/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      hours = h;
      minutes = m;
    }
  }

  // Pola 1: "15 November 2026", "24 Des", "05 Mei"
  const textDateRegex = /(\b[0-3]?[0-9])\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|ags|aug|sep|okt|oct|nov|des|dec)\s*(\d{4})?/i;
  const textDateMatch = text.match(textDateRegex);

  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10);
    const monthName = textDateMatch[2].toLowerCase();
    const year = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : currentYear;
    const monthIndex = monthMap[monthName];

    if (monthIndex !== undefined && day >= 1 && day <= 31) {
      foundDate = new Date(year, monthIndex, day, hours, minutes, 0);
      return foundDate;
    }
  }

  // Pola 2: Numerik "DD/MM/YYYY", "DD-MM-YYYY", atau "YYYY-MM-DD"
  const numDateRegex = /(\b[0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.](\d{2,4})\b/;
  const numMatch = text.match(numDateRegex);

  if (numMatch) {
    let day = parseInt(numMatch[1], 10);
    let month = parseInt(numMatch[2], 10) - 1;
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;

    // Jika format terbalik YYYY-MM-DD
    if (day > 1000) {
      const tempYear = day;
      day = year;
      year = tempYear;
    }

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      foundDate = new Date(year, month, day, hours, minutes, 0);
      return foundDate;
    }
  }

  return null;
}

/**
 * Mencari baris yang paling cocok untuk judul tugas
 */
function extractTitle(lines) {
  // Keyword penanda tugas
  const keywords = ['tugas', 'pr', 'matkul', 'mata kuliah', 'deadline', 'bab', 'proyek', 'project', 'quiz', 'kuis', 'laporan', 'praktikum'];

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw) && line.length > 4 && line.length < 80) {
        return cleanTitle(line);
      }
    }
  }

  // Jika tidak ditemukan keyword spesifik, ambil baris pertama yang bermakna
  for (const line of lines) {
    if (line.length >= 4 && line.length <= 70 && !/^\d+$/.test(line)) {
      return cleanTitle(line);
    }
  }

  return '';
}

function cleanTitle(str) {
  return str.replace(/^[-•*#\s:]+/, '').trim();
}

function formatDateTimeLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ==========================================
// 6. Integrasi Google Calendar (Direct Link)
// ==========================================
function generateGoogleCalendarUrl(title, deadlineISO, notes) {
  if (!deadlineISO) return '#';

  const deadlineDate = new Date(deadlineISO);
  if (isNaN(deadlineDate.getTime())) return '#';

  // Jadwalkan 1 jam sebelum deadline hingga waktu deadline
  const startDate = new Date(deadlineDate.getTime() - 60 * 60 * 1000);
  const endDate = deadlineDate;

  // Format UTC: YYYYMMDDTHHmmSSZ
  const formatGCal = (dt) => dt.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const startStr = formatGCal(startDate);
  const endStr = formatGCal(endDate);

  const eventTitle = encodeURIComponent(title || 'Tugas');
  const eventDetails = encodeURIComponent((notes || '').slice(0, 1000));

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startStr}/${endStr}&details=${eventDetails}`;
}

function updateGoogleCalendarLink() {
  const title = taskTitle.value.trim() || 'Tugas Baru';
  const deadline = taskDeadline.value;
  const notes = taskNotes.value.trim();

  if (deadline) {
    const url = generateGoogleCalendarUrl(title, deadline, notes);
    btnAddToCalendar.href = url;
  } else {
    btnAddToCalendar.href = '#';
  }
}

// Perbarui link secara real-time saat form diketik
[taskTitle, taskDeadline, taskNotes].forEach(input => {
  input.addEventListener('input', updateGoogleCalendarLink);
});

btnAddToCalendar.addEventListener('click', (e) => {
  if (!taskDeadline.value) {
    e.preventDefault();
    showNotification('Mohon lengkapi Tanggal & Jam Deadline terlebih dahulu.', 'warning');
  }
});

// ==========================================
// 7. Simpan & Kelola Tugas (Supabase & Local)
// ==========================================
const LOCAL_STORAGE_KEY = 'ingattugas_local_tasks';

function getLocalTasks() {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Gagal membaca localStorage:', err);
    return [];
  }
}

function saveLocalTask(task) {
  const tasks = getLocalTasks();
  tasks.unshift(task);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
}

function deleteLocalTask(id) {
  const tasks = getLocalTasks().filter(t => t.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
}

// Simpan Tugas
btnSaveTask.addEventListener('click', async () => {
  const title = taskTitle.value.trim();
  const deadline = taskDeadline.value;
  const notes = taskNotes.value.trim();

  if (!title) {
    showNotification('Judul tugas wajib diisi!', 'warning');
    taskTitle.focus();
    return;
  }

  if (!deadline) {
    showNotification('Tanggal & jam deadline wajib diisi!', 'warning');
    taskDeadline.focus();
    return;
  }

  btnSaveTask.disabled = true;
  btnSaveTask.textContent = 'Menyimpan...';

  const taskPayload = {
    title: title,
    deadline: new Date(deadline).toISOString(),
    notes: notes,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabaseClient) {
    // Simpan ke Supabase
    try {
      const { data, error } = await supabaseClient
        .from('tasks')
        .insert([taskPayload])
        .select();

      if (error) throw error;
      showNotification('✅ Tugas berhasil disimpan ke Supabase!', 'success');
      resetForm();
      loadTasks();
    } catch (err) {
      console.error('[Supabase Save Error]', err);
      showNotification(`Gagal menyimpan ke Supabase (${err.message}). Data disimpan ke penyimpanan lokal.`, 'warning');
      taskPayload.id = 'loc_' + Date.now();
      saveLocalTask(taskPayload);
      resetForm();
      loadTasks();
    }
  } else {
    // Mode LocalStorage
    taskPayload.id = 'loc_' + Date.now();
    saveLocalTask(taskPayload);
    showNotification('✅ Tugas berhasil disimpan ke penyimpanan lokal!', 'success');
    resetForm();
    loadTasks();
  }

  btnSaveTask.disabled = false;
  btnSaveTask.innerHTML = '<span class="btn-icon">💾</span> Simpan ke Database';
});

function resetForm() {
  taskTitle.value = '';
  taskDeadline.value = '';
  taskNotes.value = '';
  updateGoogleCalendarLink();
  resetImageUpload();
}

// Ambil dan Tampilkan Daftar Tugas
async function loadTasks() {
  tasksSummary.textContent = 'Memuat tugas...';

  let tasks = [];

  if (isSupabaseConfigured && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true });

      if (error) throw error;
      tasks = data || [];
    } catch (err) {
      console.error('[Supabase Fetch Error]', err);
      tasks = getLocalTasks();
      showNotification('Menggunakan data lokal karena Supabase tidak dapat dijangkau.', 'warning');
    }
  } else {
    tasks = getLocalTasks();
  }

  renderTasksList(tasks);
}

function renderTasksList(tasks) {
  tasksList.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    tasksSummary.textContent = 'Belum ada tugas tersimpan';
    tasksList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>Belum ada tugas yang tersimpan.</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Unggah foto tugas atau masukkan data secara manual di atas.</p>
      </div>
    `;
    return;
  }

  tasksSummary.textContent = `Total ${tasks.length} tugas tersimpan`;

  const now = new Date();

  tasks.forEach((task) => {
    const deadlineDate = new Date(task.deadline);
    const isOverdue = deadlineDate < now;

    // Format tampilan tanggal Indonesia
    const formattedDeadline = deadlineDate.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const calendarUrl = generateGoogleCalendarUrl(task.title, task.deadline, task.notes);

    const item = document.createElement('div');
    item.className = 'task-item';
    item.innerHTML = `
      <div class="task-item-header">
        <div class="task-item-title">${escapeHtml(task.title)}</div>
        <span class="task-item-deadline ${isOverdue ? 'overdue' : ''}">
          ⏰ ${formattedDeadline} ${isOverdue ? '(Terlewat)' : ''}
        </span>
      </div>
      ${task.notes ? `<div class="task-item-notes">${escapeHtml(task.notes)}</div>` : ''}
      <div class="task-item-footer">
        <a href="${calendarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-calendar" title="Tambah ke Google Calendar">
          📅 Tambah ke Kalender
        </a>
        <button type="button" class="btn btn-sm btn-danger-outline btn-delete" data-id="${task.id}" title="Hapus Tugas">
          🗑️ Hapus
        </button>
      </div>
    `;

    tasksList.appendChild(item);
  });

  // Event listener tombol hapus
  document.querySelectorAll('.btn-delete').forEach(button => {
    button.addEventListener('click', async (e) => {
      const taskId = e.currentTarget.getAttribute('data-id');
      if (confirm('Apakah Anda yakin ingin menghapus tugas ini?')) {
        await deleteTask(taskId);
      }
    });
  });
}

async function deleteTask(id) {
  if (isSupabaseConfigured && supabaseClient && !String(id).startsWith('loc_')) {
    try {
      const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Tugas berhasil dihapus dari database.', 'success');
    } catch (err) {
      console.error('[Supabase Delete Error]', err);
      showNotification('Gagal menghapus dari Supabase: ' + err.message, 'error');
    }
  } else {
    deleteLocalTask(id);
    showNotification('Tugas dihapus.', 'info');
  }

  loadTasks();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

btnRefreshTasks.addEventListener('click', loadTasks);

// Inisialisasi awal saat halaman dibuka
document.addEventListener('DOMContentLoaded', () => {
  checkSupabaseStatus();
  loadTasks();
  updateGoogleCalendarLink();
});