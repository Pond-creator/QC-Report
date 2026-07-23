// ============================================================
//  QC Report — Shared document renderer (ใช้ร่วมกันใน view.html และ share.html)
// ============================================================

const DOC_LABELS = {
  th: { title: 'รายงานตรวจสอบคุณภาพสินค้า (QC REPORT)', noItems: 'ไม่มีรายการตรวจ (สินค้าผ่านทั้งหมด)', reasonHeading: 'Reason for Defected and Rejected', overview: 'ภาพรวม' },
  en: { title: 'Quality Control Report (QC REPORT)', noItems: 'No defects found — product fully accepted', reasonHeading: 'Reason for Defected and Rejected', overview: 'overview' }
};

// เช็คว่ามีเนื้อหาที่ยังไม่ได้แปล (ไทย→อังกฤษ) ค้างอยู่ไหม — ใช้ตัดสินใจว่าต้องเรียก translateReport ก่อนสลับไปโหมด EN หรือไม่
function needsTranslation(report, items) {
  return (!!report.description && !report.description_en) ||
    (!!report.supplier_name && !report.supplier_name_en) ||
    (items || []).some(it => it.reason_text && !it.reason_text_en);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ====== พรีวิวรูปขยาย (ใช้ร่วมกันทุกรูปในเอกสาร) ======
// เดสก์ท็อป: ชี้เมาส์ (hover) ขึ้นพรีวิวลอยตามเคอร์เซอร์
// มือถือ/แตะ: กดที่รูป = พรีวิวขยายกลางจอค้างไว้ (ปักหมุด) แตะที่ไหนก็ได้เพื่อปิด — ไม่เปิดลิงก์รูปแยกออกจากหน้าอีกต่อไป
let _zoomEl = null, _zoomPinned = false;
function _ensureZoom() {
  if (_zoomEl) return _zoomEl;
  _zoomEl = document.createElement('div');
  _zoomEl.className = 'photo-zoom-preview';
  document.body.appendChild(_zoomEl);
  return _zoomEl;
}
function showZoom(url, evt) {
  if (_zoomPinned) return; // ปักหมุดอยู่ ไม่ให้ hover มาแทนที่
  const el = _ensureZoom();
  el.innerHTML = `<img src="${url}">`;
  el.classList.add('show');
  moveZoom(evt);
}
function moveZoom(evt) {
  if (!_zoomEl || _zoomPinned || !_zoomEl.classList.contains('show')) return;
  const pad = 18;
  const size = Math.min(560, window.innerWidth * 0.9, window.innerHeight * 0.6);
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + size > window.innerWidth) x = evt.clientX - size - pad;
  if (y + size > window.innerHeight) y = evt.clientY - size - pad;
  _zoomEl.style.left = Math.max(4, x) + 'px';
  _zoomEl.style.top = Math.max(4, y) + 'px';
}
function hideZoom() {
  if (_zoomEl && !_zoomPinned) _zoomEl.classList.remove('show');
}
function pinZoom(url) {
  const el = _ensureZoom();
  el.innerHTML = `<img src="${url}">`;
  el.style.left = ''; el.style.top = ''; // เคลียร์ตำแหน่งจากโหมด hover ให้ CSS จัดกลางจอแทน
  el.classList.add('show', 'pinned');
  _zoomPinned = true;
}
function unpinZoom() {
  if (!_zoomEl) return;
  _zoomEl.classList.remove('show', 'pinned');
  _zoomPinned = false;
}

// event delegation ครั้งเดียว (แทน inline onmouseenter ที่ฝัง URL ใน HTML attribute — เสี่ยงเพี้ยนกับ URL ที่มี & หลายตัว)
document.addEventListener('mouseover', (e) => {
  const img = e.target.closest('.doc-photo-grid img');
  if (img) showZoom(img.src, e);
});
document.addEventListener('mousemove', (e) => {
  if (e.target.closest('.doc-photo-grid img')) moveZoom(e);
});
document.addEventListener('mouseout', (e) => {
  const img = e.target.closest('.doc-photo-grid img');
  if (img && (!e.relatedTarget || !e.relatedTarget.closest('.doc-photo-grid img'))) hideZoom();
});
document.addEventListener('click', (e) => {
  const img = e.target.closest('.doc-photo-grid img');
  if (img) { e.preventDefault(); pinZoom(img.src); return; }
  if (_zoomPinned) unpinZoom();
});

function photoFigure(url, label) {
  return `<figure><img src="${url}"><figcaption>${label}</figcaption></figure>`;
}

function reasonItemHtml(it, idx, lang) {
  const L = DOC_LABELS[lang];
  const reasonText = (lang === 'en' && it.reason_text_en) ? it.reason_text_en : it.reason_text;
  const photosHtml = (it.photos || []).map(p => `
    ${p.closeup ? photoFigure(p.closeup, 'close-up') : ''}
    ${p.overview ? photoFigure(p.overview, L.overview) : ''}
  `).join('');
  return `
    <div class="doc-reason-item">
      <div class="head">
        <div>${idx + 1}) <span class="tag tag-${it.type}">${it.type}</span> ${escapeHtml(reasonText)}</div>
        <div><b>Qty:</b> ${it.qty} Pcs</div>
      </div>
      ${photosHtml ? `<div class="doc-photo-grid">${photosHtml}</div>` : ''}
      ${(it.video_urls || []).map(url => `<div class="doc-clip">link clip: <a href="${url}" target="_blank" rel="noopener">${url}</a></div>`).join('')}
    </div>`;
}

function signBoxHtml(label, name, signUrl, dateStr) {
  return `<div class="box">
    ${signUrl ? `<img src="${signUrl}">` : `<div class="placeholder-line"></div>`}
    <div>${escapeHtml(name || '-')}</div>
    <div style="color:var(--muted);font-size:12px">${label} · ${fmtDateTH(dateStr)}</div>
  </div>`;
}

// เนื้อหาเอกสารทั้งหมด (header ถึง sign-row) — ไม่รวม doc-actions เพราะปุ่มต่างกันแต่ละหน้า (view.html มีปุ่มอนุมัติ, share.html ไม่มี)
// opts.lang = 'th'|'en', opts.approvedBoxHtml = HTML กล่อง Approved by (แต่ละหน้ากำหนดเอง เช่น อินเทอร์แอกทีฟ/อ่านอย่างเดียว/รออนุมัติ)
function buildDocHtml(report, items, opts) {
  const lang = (opts && opts.lang) || 'th';
  const L = DOC_LABELS[lang];
  const description = (lang === 'en' && report.description_en) ? report.description_en : report.description;
  const supplierName = (lang === 'en' && report.supplier_name_en) ? report.supplier_name_en : report.supplier_name;
  const approvedBoxHtml = (opts && opts.approvedBoxHtml) || signBoxHtml('Approved by', report.approved_by, report.approved_sign_url, report.approved_date);

  return `
    <div class="doc-head">
      <div class="no-box">NO. ${escapeHtml(report.id)}</div>
      <div class="company">APOSTROPHE L CO.,LTD</div>
      <div class="title">${L.title}</div>
    </div>

    <div class="doc-grid">
      <div class="row"><span class="k">Supplier Name</span><span class="v">${escapeHtml(supplierName || '-')}</span></div>
      <div class="row"><span class="k">Supplier Item Code</span><span class="v">${escapeHtml(report.supplier_code)}</span></div>
      <div class="row"><span class="k">Stock Code</span><span class="v">${escapeHtml(report.stock_code)}</span></div>
      <div class="row"><span class="k">EAN 13 Code</span><span class="v">${escapeHtml(report.ean13 || '-')}</span></div>
      <div class="row"><span class="k">Date In</span><span class="v">${fmtDateTH(report.date_in)}</span></div>
      <div class="row"><span class="k">QA Date</span><span class="v">${fmtDateTH(report.date_qa)}</span></div>
    </div>
    <div class="row" style="border-bottom:1px dotted var(--border);padding:4px 0">
      <span class="k">Description</span> <span class="v">${escapeHtml(description)}</span>
    </div>
    <div class="row" style="border-bottom:1px dotted var(--border);padding:4px 0;margin-bottom:10px">
      <span class="k">Order (Pcs)</span><span class="v">${report.order_qty}</span>
    </div>

    <div class="doc-summary">
      <div class="box summary-accepted">Accepted<br>${report.accepted_qty} Pcs</div>
      <div class="box summary-defected">Defected<br>${report.defected_qty} Pcs</div>
      <div class="box summary-rejected">Rejected<br>${report.rejected_qty} Pcs</div>
      <div class="box summary-other">Other<br>${report.other_qty || 0} Pcs</div>
    </div>

    <div class="doc-reason">
      <h3>${L.reasonHeading}</h3>
      ${items.length ? items.map((it, idx) => reasonItemHtml(it, idx, lang)).join('') : `<div class="empty-state">${L.noItems}</div>`}
    </div>

    <div class="doc-sign-row">
      ${signBoxHtml('Verified by', report.verified_by, report.verified_sign_url, report.verified_date)}
      ${approvedBoxHtml}
    </div>
  `;
}
