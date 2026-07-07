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

// ====== state ======
let items = [];
let verifiedSign = null;

function newItem() { return { type: 'Defected', reason_text: '', qty: '', photos: [], video: null, videoName: '' }; }

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
          <label>Reason for ${it.type} <span class="req">*</span></label>
          <input type="text" data-act="reason" data-i="${i}" value="${escapeHtml(it.reason_text)}" placeholder="ระบุสาเหตุ">
        </div>
        <div class="field qty-field">
          <label>Qty <span class="req">*</span></label>
          <input type="number" min="0" class="type-${it.type}" data-act="qty" data-i="${i}" value="${it.qty}">
        </div>
      </div>
      <div class="photo-pairs">
        ${it.photos.map((p, pi) => `
          <div class="photo-pair" data-pi="${pi}">
            ${photoSlot(i, pi, 'closeup', p.closeup, 'photo defected/\nrejected shot only')}
            ${photoSlot(i, pi, 'overview', p.overview, 'photo all of\ndefected/rejected shot')}
            <button type="button" class="pair-remove" data-act="removePair" data-i="${i}" data-pi="${pi}" title="ลบคู่รูปนี้">&times;</button>
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="addPair" data-i="${i}">+ เพิ่มรูป</button>
      <div class="video-slot">
        <label style="margin:0">link clip:</label>
        <input type="file" accept="video/*" data-act="video" data-i="${i}" id="video-${i}" style="display:none">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('video-${i}').click()">เลือกไฟล์วิดีโอ</button>
        <span class="video-name ${it.videoName ? '' : 'empty'}">${escapeHtml(it.videoName || 'ยังไม่แนบคลิป')}</span>
        ${it.videoName ? `<button type="button" class="pair-remove" data-act="removeVideo" data-i="${i}" title="ลบคลิป">&times;</button>` : ''}
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
    const dataUrl = await compressImage(file);
    items[i].photos[e.target.dataset.pi][e.target.dataset.slot] = dataUrl;
    renderItems();
  } else if (act === 'video') {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) toast('ไฟล์วิดีโอใหญ่เกิน 30MB อาจอัปโหลดไม่สำเร็จ', 'error');
    const dataUrl = await fileToDataUrl(file);
    items[i].video = dataUrl;
    items[i].videoName = file.name;
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
  else if (act === 'removeVideo') { items[i].video = null; items[i].videoName = ''; renderItems(); }
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
document.getElementById('btnSubmit').addEventListener('click', async () => {
  const supplier_code = val('supplier_code').trim();
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
  if (!verifiedSign) { toast('กรุณาเซ็นชื่อผู้ตรวจสอบ (Verified by) ก่อนส่งข้อมูล', 'error'); return; }
  const verified_date = val('verified_date');
  if (!verified_date) { toast('กรุณาเลือก Date สำหรับ Verified by', 'error'); return; }
  const verified_by = val('verified_by').trim() || (Auth.getUser() || {}).name;

  const payload = {
    supplier_code, stock_code, ean13, description, order_qty, date_in, date_qa,
    verified_sign: verifiedSign, verified_by, verified_date,
    items: items.map(it => ({
      type: it.type, reason_text: it.reason_text.trim(), qty: num(it.qty),
      photos: it.photos.filter(p => p.closeup || p.overview),
      video: it.video || null
    }))
  };

  const res = await API.createReport(payload);
  if (res.success) {
    toast('ส่งข้อมูลสำเร็จ: ' + res.id, 'success');
    setTimeout(() => { window.location.href = 'view.html?id=' + encodeURIComponent(res.id); }, 600);
  } else {
    toast(res.message || 'บันทึกไม่สำเร็จ', 'error');
  }
});

renderItems();
