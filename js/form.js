// ============================================================
//  QC Report — form.html logic
// ============================================================

if (!Auth.requirePage('form.html')) { /* redirected */ }

document.getElementById('userName').textContent = (Auth.getUser() || {}).name || '';
document.getElementById('userRole').textContent = Auth.getRoleLabel((Auth.getUser() || {}).role);

function num(v) { return Number(String(v == null ? 0 : v).replace(/,/g, '')) || 0; }
function val(id) { return document.getElementById(id).value; }
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fpOpts = {
  dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y',
  locale: (window.flatpickr && flatpickr.l10ns && flatpickr.l10ns.th) ? 'th' : 'default',
  allowInput: true
};
flatpickr('#date_in', fpOpts);
flatpickr('#date_qa', fpOpts);
flatpickr('#verified_date', Object.assign({ defaultDate: 'today' }, fpOpts));

document.getElementById('verified_by').value = (Auth.getUser() || {}).name || '';

const editId = new URLSearchParams(window.location.search).get('id');

// ====== state ======
let items = [];
let verifiedSign = null;

function newItem() { return { type: 'Defected', reason_text: '', qty: '', photos: [], videos: [] }; }

const reasonListEl = document.getElementById('reasonList');

function photoSlot(i, pi, slot, dataUrl, label) {
  return `<div class="photo-slot">
    ${dataUrl
      ? `<img src="${dataUrl}"><button type="button" class="rm" data-act="removePhoto" data-i="${i}" data-pi="${pi}" data-slot="${slot}">&times;</button>`
      : `<span>${label}</span>`}
    <input type="file" accept="image/*" data-act="photo" data-i="${i}" data-pi="${pi}" data-slot="${slot}">
  </div>`;
}

function renderItems() {
  if (!items.length) {
    reasonListEl.innerHTML = `<div class="empty-state" style="padding:20px 0">ยังไม่มีรายการตรวจ — หากสินค้าผ่านทั้งหมดไม่ต้องเพิ่มรายการ</div>`;
    recalcSummary();
    return;
  }
  reasonListEl.innerHTML = items.map((it, i) => `
    <div class="reason-block" data-idx="${i}">
      <button type="button" class="remove-block" data-act="removeBlock" data-i="${i}" title="ลบรายการนี้">&times;</button>
      <div class="reason-head">
        <div class="field" style="max-width:150px">
          <label>ประเภท <span class="req">*</span></label>
          <select data-act="type" data-i="${i}">
            <option value="Defected" ${it.type === 'Defected' ? 'selected' : ''}>Defected</option>
            <option value="Rejected" ${it.type === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>
        <div class="field">
          <label>สาเหตุที่ ${it.type} <span class="req">*</span></label>
          <input type="text" data-act="reason" data-i="${i}" value="${escapeHtml(it.reason_text)}" placeholder="ระบุสาเหตุ">
        </div>
        <div class="field qty-field">
          <label>จำนวน (ชิ้น) <span class="req">*</span></label>
          <input type="number" min="0" class="type-${it.type}" data-act="qty" data-i="${i}" value="${it.qty}">
        </div>
      </div>
      <div class="photo-pairs">
        ${it.photos.map((p, pi) => `
          <div class="photo-pair" data-pi="${pi}">
            ${photoSlot(i, pi, 'closeup', p.closeup, 'ถ่ายจุดที่เสีย/\nถูกปฏิเสธ')}
            ${photoSlot(i, pi, 'overview', p.overview, 'ถ่ายภาพรวม\nทั้งชิ้น')}
            <button type="button" class="pair-remove" data-act="removePair" data-i="${i}" data-pi="${pi}" title="ลบคู่รูปนี้">&times;</button>
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="addPair" data-i="${i}">+ เพิ่มรูป</button>
      <div class="video-section">
        <label style="margin:0 0 8px;display:block">แนบวิดีโอ (คลิป):</label>
        ${it.videos.length ? it.videos.map((v, vi) => `
          <div class="video-slot">
            <span class="video-name">${escapeHtml(v.name || ('คลิปที่ ' + (vi + 1)))}</span>
            <button type="button" class="pair-remove" data-act="removeVideo" data-i="${i}" data-vi="${vi}" title="ลบคลิป">&times;</button>
          </div>`).join('') : `<div class="video-slot"><span class="video-name empty">ยังไม่แนบคลิป</span></div>`}
        <input type="file" accept="video/*" data-act="video" data-i="${i}" id="video-${i}" style="display:none">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('video-${i}').click()">+ เลือกไฟล์วิดีโอ</button>
      </div>
    </div>
  `).join('');
  recalcSummary();
}

function recalcSummary() {
  const order = num(val('order_qty'));
  let defected = 0, rejected = 0;
  items.forEach(it => {
    const q = num(it.qty);
    if (it.type === 'Rejected') rejected += q; else defected += q;
  });
  const accepted = order - defected - rejected;
  document.getElementById('sumAccepted').textContent = accepted;
  document.getElementById('sumDefected').textContent = defected;
  document.getElementById('sumRejected').textContent = rejected;
  document.getElementById('sumAcceptedBox').classList.toggle('negative', accepted < 0);
}

document.getElementById('order_qty').addEventListener('input', recalcSummary);
document.getElementById('btnAddReason').addEventListener('click', () => { items.push(newItem()); renderItems(); });

reasonListEl.addEventListener('input', (e) => {
  const act = e.target.dataset.act, i = e.target.dataset.i;
  if (act === 'reason') items[i].reason_text = e.target.value;
  else if (act === 'qty') { items[i].qty = e.target.value; recalcSummary(); }
});

reasonListEl.addEventListener('change', async (e) => {
  const act = e.target.dataset.act, i = e.target.dataset.i;
  if (act === 'type') { items[i].type = e.target.value; renderItems(); }
  else if (act === 'photo') {
    const file = e.target.files[0];
    if (!file) return;
    let dataUrl;
    try {
      dataUrl = await compressImage(file); // แปลงเป็น JPEG เสมอ (รวมไฟล์ HEIC จากไอโฟน)
    } catch (err) {
      // บางไฟล์ (เช่น HEIC บางเวอร์ชัน) เบราว์เซอร์ decode ไม่ได้ → ใช้ไฟล์ต้นฉบับแทนดีกว่าไม่มีรูปเลย
      toast('ย่อรูปไม่สำเร็จ ใช้ไฟล์ต้นฉบับแทน (อาจไม่ใช่ JPEG)', 'info');
      dataUrl = await fileToDataUrl(file);
    }
    items[i].photos[e.target.dataset.pi][e.target.dataset.slot] = dataUrl;
    renderItems();
  } else if (act === 'video') {
    const file = e.target.files[0];
    if (!file) return;
    // บีบอัด + แปลงเป็น mp4/webm เสมอ (กันไฟล์ .mov/HEVC จากไอโฟนที่บางเบราว์เซอร์เปิดไม่ได้) ถ้าเบราว์เซอร์ไม่รองรับจะ fallback ไปใช้ไฟล์เดิม
    showLoader('กำลังแปลง/บีบอัดวิดีโอ...');
    const compressed = await compressVideo(file);
    hideLoader();
    const dataUrl = compressed || await fileToDataUrl(file);
    if (!compressed) toast('เบราว์เซอร์นี้แปลงวิดีโอไม่ได้ ใช้ไฟล์ต้นฉบับแทน', 'info');
    if (dataUrl.length > 27 * 1024 * 1024) toast('ไฟล์วิดีโอยังใหญ่เกิน 20MB อาจอัปโหลดไม่สำเร็จ', 'error');
    const outExt = compressed ? (dataUrl.startsWith('data:video/mp4') ? '.mp4' : '.webm') : null;
    const displayName = outExt ? file.name.replace(/\.[^.]+$/, '') + outExt : file.name;
    items[i].videos.push({ data: dataUrl, name: displayName });
    renderItems();
  }
});

reasonListEl.addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  const i = e.target.dataset.i;
  if (act === 'removeBlock') { items.splice(i, 1); renderItems(); }
  else if (act === 'addPair') { items[i].photos.push({ closeup: null, overview: null }); renderItems(); }
  else if (act === 'removePair') { items[i].photos.splice(e.target.dataset.pi, 1); renderItems(); }
  else if (act === 'removePhoto') { items[i].photos[e.target.dataset.pi][e.target.dataset.slot] = null; renderItems(); }
  else if (act === 'removeVideo') { items[i].videos.splice(e.target.dataset.vi, 1); renderItems(); }
});

// ====== signature ======
function renderVerifiedPreview() {
  document.getElementById('verifiedPreview').innerHTML = verifiedSign
    ? `<img src="${verifiedSign}">`
    : `<span class="placeholder">ยังไม่เซ็นชื่อ</span>`;
}
document.getElementById('btnSignVerified').addEventListener('click', () => {
  SignaturePad.open(dataUrl => { verifiedSign = dataUrl; renderVerifiedPreview(); });
});

// ====== submit ======
// กันกดส่งซ้ำ (ไฟล์รูป/วิดีโอใหญ่ อาจใช้เวลานานบนมือถือ ผู้ใช้เข้าใจผิดว่าค้างแล้วกดซ้ำ กลายเป็นสร้างซ้ำ 2 ใบ)
let isSubmitting = false;
document.getElementById('btnSubmit').addEventListener('click', async () => {
  if (isSubmitting) return;

  const supplier_code = val('supplier_code').trim();
  const supplier_name = val('supplier_name').trim();
  const stock_code = val('stock_code').trim();
  const ean13 = val('ean13').trim();
  const description = val('description').trim();
  const order_qty = num(val('order_qty'));
  const date_in = val('date_in');
  const date_qa = val('date_qa');

  if (!supplier_code || !stock_code || !description || !date_in || !date_qa) {
    toast('กรุณากรอกข้อมูลหัวฟอร์มให้ครบ (ช่องสีแดง)', 'error'); return;
  }
  for (let i = 0; i < items.length; i++) {
    if (!items[i].reason_text.trim()) { toast(`กรุณากรอก Reason ของรายการที่ ${i + 1}`, 'error'); return; }
    if (num(items[i].qty) <= 0) { toast(`กรุณากรอก Qty ของรายการที่ ${i + 1}`, 'error'); return; }
  }

  if (!editId) {
    if (!verifiedSign) { toast('กรุณาเซ็นชื่อผู้ตรวจสอบ (Verified by) ก่อนส่งข้อมูล', 'error'); return; }
    if (!val('verified_date')) { toast('กรุณาเลือก Date สำหรับ Verified by', 'error'); return; }
  }

  const itemsPayload = items.map(it => ({
    type: it.type, reason_text: it.reason_text.trim(), qty: num(it.qty),
    photos: it.photos.filter(p => p.closeup || p.overview),
    videos: it.videos.map(v => v.data)
  }));

  const btn = document.getElementById('btnSubmit');
  const originalLabel = btn.textContent;
  isSubmitting = true;
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง... กรุณาอย่ากดซ้ำ';
  // คืนสถานะปุ่มให้กดใหม่ได้ (เรียกเฉพาะตอนไม่สำเร็จ — ตอนสำเร็จกำลังจะเปลี่ยนหน้าอยู่แล้ว ปล่อยปุ่มปิดไว้กันกดซ้ำระหว่างรอ)
  const resetButton = () => { isSubmitting = false; btn.disabled = false; btn.textContent = originalLabel; };

  let res;
  try {
    if (editId) {
      res = await API.updateReport({
        id: editId, supplier_code, supplier_name, stock_code, ean13, description, order_qty, date_in, date_qa,
        items: itemsPayload
      });
    } else {
      const verified_by = val('verified_by').trim() || (Auth.getUser() || {}).name;
      res = await API.createReport({
        supplier_code, supplier_name, stock_code, ean13, description, order_qty, date_in, date_qa,
        verified_sign: verifiedSign, verified_by, verified_date: val('verified_date'),
        items: itemsPayload
      });
    }
  } catch (err) {
    resetButton();
    toast('เกิดข้อผิดพลาดไม่คาดคิด: ' + err.message, 'error');
    return;
  }

  if (!res.success) {
    resetButton();
    toast(res.message || 'บันทึกไม่สำเร็จ ตรวจสอบหน้ารายงานก่อนกดส่งซ้ำ (เผื่อบันทึกไปแล้วแต่แจ้งผลช้า)', 'error');
    return;
  }

  if (editId) {
    toast('บันทึกการแก้ไขสำเร็จ', 'success');
    setTimeout(() => { window.location.href = 'view.html?id=' + encodeURIComponent(editId); }, 600);
  } else {
    toast('ส่งข้อมูลสำเร็จ: ' + res.id, 'success');
    setTimeout(() => { window.location.href = 'view.html?id=' + encodeURIComponent(res.id); }, 600);
  }
});

// ====== โหมดแก้ไข: โหลดข้อมูลเดิมมาเติมในฟอร์ม ======
async function loadForEdit(id) {
  const res = await API.getReport(id);
  if (!res.success) { toast(res.message || 'โหลดเอกสารไม่สำเร็จ', 'error'); return; }
  const r = res.report;
  document.getElementById('supplier_code').value = r.supplier_code || '';
  document.getElementById('supplier_name').value = r.supplier_name || '';
  document.getElementById('stock_code').value = r.stock_code || '';
  document.getElementById('ean13').value = r.ean13 || '';
  document.getElementById('description').value = r.description || '';
  document.getElementById('order_qty').value = r.order_qty || 0;
  if (r.date_in) document.querySelector('#date_in')._flatpickr.setDate(r.date_in, true);
  if (r.date_qa) document.querySelector('#date_qa')._flatpickr.setDate(r.date_qa, true);

  items = (res.items || []).map(it => ({
    type: it.type, reason_text: it.reason_text || '', qty: it.qty,
    photos: (it.photos || []).map(p => ({ closeup: p.closeup || null, overview: p.overview || null })),
    videos: (it.video_urls || []).map((url, vi) => ({ data: url, name: 'คลิปเดิมที่ ' + (vi + 1) }))
  }));
  renderItems();

  document.getElementById('signRowWrap').innerHTML = `<div style="background:#f4f5f7;padding:14px;border-radius:8px;text-align:center;color:var(--muted);width:100%">
    ลายเซ็น Verified by เดิม: <b>${escapeHtml(r.verified_by || '-')}</b> · ${fmtDateTH(r.verified_date)}<br>
    <span style="font-size:12px">(แก้ไขข้อมูลจะไม่เปลี่ยนลายเซ็นเดิม)</span>
  </div>`;
  document.getElementById('pageTitle').textContent = 'แก้ไขใบตรวจ QC — ' + r.id;
  document.getElementById('btnSubmit').textContent = 'บันทึกการแก้ไข';
}

if (editId) loadForEdit(editId);
renderItems();
