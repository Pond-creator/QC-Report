// ============================================================
//  QC Report — API Client
// ============================================================

// <<< URL ของ Web App หลัง Deploy GAS >>>
const API_URL = 'https://script.google.com/macros/s/AKfycbxXX9kC5Eg0Aew0UWY6tewJPVBhNRt7RSBaxuwLyziDnrag4W6e-Q3FlOtSMqWdYXVd/exec';

// ====== Global loading overlay (มีตัวเลข % วิ่งขึ้นเรื่อยๆ กันรู้สึกค้าง) ======
let _loaderEl = null, _loaderTimer = null, _loaderPct = 0, _loaderCount = 0;
function _ensureLoader() {
  if (_loaderEl) return _loaderEl;
  _loaderEl = document.createElement('div');
  _loaderEl.className = 'app-loader';
  _loaderEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span class="pct">0%</span></div><div class="lbl">กำลังบันทึก...</div>`;
  document.body.appendChild(_loaderEl);
  return _loaderEl;
}
function showLoader(label) {
  const el = _ensureLoader();
  el.querySelector('.lbl').textContent = label || 'กำลังบันทึก...';
  _loaderCount++;
  el.classList.add('show');
  _loaderPct = 0;
  el.querySelector('.pct').textContent = '0%';
  clearInterval(_loaderTimer);
  _loaderTimer = setInterval(() => {
    if (_loaderPct < 95) {
      _loaderPct += Math.max(1, Math.round((95 - _loaderPct) * 0.09));
      el.querySelector('.pct').textContent = Math.min(_loaderPct, 99) + '%';
    }
  }, 110);
}
function hideLoader() {
  if (_loaderCount > 0) _loaderCount--;
  if (_loaderCount > 0 || !_loaderEl) return;
  clearInterval(_loaderTimer);
  _loaderEl.querySelector('.pct').textContent = '100%';
  const el = _loaderEl;
  setTimeout(() => { if (_loaderCount === 0) el.classList.remove('show'); }, 200);
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
  updateReport:   (data) => apiCall('updateReport', data, { loadingText: 'กำลังบันทึกการแก้ไข...' }),
  deleteReport:   (data) => apiCall('deleteReport', data, { loadingText: 'กำลังลบเอกสาร...' }),
  getReport:      (id) => apiCall('getReport', { id }),
  listReports:    (filters = {}) => apiCall('listReports', filters, { silent: true }),
  approveReport:  (data) => apiCall('approveReport', data, { loadingText: 'กำลังบันทึกการอนุมัติ...' }),
  shareReport:    (data) => apiCall('shareReport', data, { loadingText: 'กำลังสร้างลิงก์แชร์...' }),
  translateReport:(data) => apiCall('translateReport', data, { loadingText: 'กำลังแปลภาษา...' })
};

// เรียก getSharedReport แบบไม่ต้อง login (ใช้ในหน้า share.html) — ไม่มี token ผู้ใช้ ไม่ผ่าน apiCall ปกติ
async function apiCallPublic(action, data = {}) {
  const payload = { action, ...data };
  try {
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => params.append(k, typeof v === 'object' ? JSON.stringify(v) : v));
    const res = await fetch(API_URL + '?' + params.toString());
    return await res.json();
  } catch (err) {
    return { success: false, message: 'เชื่อมต่อ API ไม่ได้: ' + err.message };
  }
}

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

// บีบอัดวิดีโอฝั่ง client ก่อนอัปโหลด (ย่อความละเอียด + re-encode บิตเรตต่ำผ่าน canvas+MediaRecorder)
// คืน dataURL ถ้าบีบสำเร็จ, คืน null ถ้าเบราว์เซอร์ไม่รองรับ/บีบไม่สำเร็จ (ผู้เรียกต้อง fallback ไปใช้ไฟล์เดิม)
function compressVideo(file, maxDim = 640, fps = 24, videoBitsPerSecond = 800000) {
  return new Promise((resolve) => {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { resolve(null); return; }
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(drawTimer);
      URL.revokeObjectURL(video.src);
      video.remove();
      resolve(result);
    };

    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    video.src = URL.createObjectURL(file);
    document.body.appendChild(video);

    let drawTimer;
    const timeoutGuard = setTimeout(() => finish(null), 90000); // กันค้างถ้าวิดีโอยาวผิดปกติ/ติดขัด

    video.addEventListener('error', () => { clearTimeout(timeoutGuard); finish(null); });

    video.addEventListener('loadedmetadata', () => {
      const w0 = video.videoWidth, h0 = video.videoHeight;
      if (!w0 || !h0) { clearTimeout(timeoutGuard); finish(null); return; }
      let w = w0, h = h0;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale); h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');

      let audioTracks = [];
      try { audioTracks = video.captureStream ? video.captureStream().getAudioTracks() : []; } catch (e) { /* ไม่มีเสียงก็ไม่เป็นไร */ }

      let combined;
      try {
        const canvasStream = canvas.captureStream(fps);
        combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      } catch (e) { clearTimeout(timeoutGuard); finish(null); return; }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      if (!mimeType) { clearTimeout(timeoutGuard); finish(null); return; }

      let recorder;
      try { recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond }); }
      catch (e) { clearTimeout(timeoutGuard); finish(null); return; }

      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        clearTimeout(timeoutGuard);
        if (!chunks.length) { finish(null); return; }
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => finish(reader.result);
        reader.onerror = () => finish(null);
        reader.readAsDataURL(blob);
      };

      video.addEventListener('play', () => {
        drawTimer = setInterval(() => {
          if (video.paused || video.ended) return;
          try { ctx.drawImage(video, 0, 0, w, h); } catch (e) { /* เฟรมข้ามได้ ไม่ critical */ }
        }, 1000 / fps);
      });
      video.addEventListener('ended', () => { if (recorder.state !== 'inactive') recorder.stop(); });

      try {
        recorder.start();
        video.currentTime = 0;
        video.play().catch(() => { clearTimeout(timeoutGuard); finish(null); });
      } catch (e) { clearTimeout(timeoutGuard); finish(null); }
    });
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
