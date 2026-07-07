// ============================================================
//  QC Report — API Client
// ============================================================

// <<< URL ของ Web App หลัง Deploy GAS >>>
const API_URL = 'https://script.google.com/macros/s/AKfycbxXX9kC5Eg0Aew0UWY6tewJPVBhNRt7RSBaxuwLyziDnrag4W6e-Q3FlOtSMqWdYXVd/exec';

// ====== Global loading overlay ======
let _loaderEl = null, _loaderCount = 0;
function _ensureLoader() {
  if (_loaderEl) return _loaderEl;
  _loaderEl = document.createElement('div');
  _loaderEl.className = 'app-loader';
  _loaderEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div><div class="lbl">กำลังบันทึก...</div>`;
  document.body.appendChild(_loaderEl);
  return _loaderEl;
}
function showLoader(label) {
  const el = _ensureLoader();
  el.querySelector('.lbl').textContent = label || 'กำลังบันทึก...';
  _loaderCount++;
  el.classList.add('show');
}
function hideLoader() {
  if (_loaderCount > 0) _loaderCount--;
  if (_loaderCount > 0 || !_loaderEl) return;
  _loaderEl.classList.remove('show');
}

async function apiCall(action, data = {}, opts = {}) {
  const payload = { action, token: Auth.getToken(), ...data };
  if (!opts.silent) showLoader(opts.loadingText);
  try {
    const payloadStr = JSON.stringify(payload);
    let res;
    if (payloadStr.length > 3500) {
      // payload ใหญ่ (แนบรูป/วิดีโอ/ลายเซ็น) → POST แบบ text/plain กัน CORS preflight
      res = await fetch(API_URL, {
        method: 'POST',
        body: payloadStr,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
    } else {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => {
        params.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
      });
      res = await fetch(API_URL + '?' + params.toString());
    }
    const json = await res.json();
    if (json.success === false && json.message === 'Unauthorized') {
      Auth.clear();
      window.location.href = 'index.html';
    }
    return json;
  } catch (err) {
    return { success: false, message: 'เชื่อมต่อ API ไม่ได้: ' + err.message };
  } finally {
    if (!opts.silent) hideLoader();
  }
}

const API = {
  login:          (username, password) => apiCall('login', { username, password }),
  createReport:   (data) => apiCall('createReport', data, { loadingText: 'กำลังบันทึกใบตรวจ...' }),
  getReport:      (id) => apiCall('getReport', { id }),
  listReports:    (filters = {}) => apiCall('listReports', filters, { silent: true }),
  approveReport:  (data) => apiCall('approveReport', data, { loadingText: 'กำลังบันทึกการอนุมัติ...' })
};

// ====== UI helpers ======
function toast(msg, type = 'info') {
  let box = document.getElementById('toast-container');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-container';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3200);
}

// แปลง File → dataURL (base64) สำหรับส่งไป GAS
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ย่อรูปฝั่ง client ก่อนอัปโหลด (ลดขนาด payload) — คืน dataURL jpeg
function compressImage(file, maxDim = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// จัดรูปแบบวันที่ yyyy-MM-dd (เก็บ) → dd/MM/yyyy (แสดง)
function fmtDateTH(ymd) {
  if (!ymd) return '-';
  const parts = String(ymd).split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtDateTimeTH(s) {
  if (!s) return '-';
  const [d, t] = String(s).split(' ');
  return fmtDateTH(d) + (t ? ' ' + t.substring(0, 5) : '');
}

function statusLabel(status) {
  return status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ';
}
