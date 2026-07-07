// ============================================================
//  QC Report — Shared document renderer (ใช้ร่วมกันใน view.html และ share.html)
// ============================================================

const DOC_LABELS = {
  th: { title: 'รายงานตรวจสอบคุณภาพสินค้า (QC REPORT)', noItems: 'ไม่มีรายการตรวจ (สินค้าผ่านทั้งหมด)', reasonHeading: 'Reason for Defected and Rejected', overview: 'ภาพรวม' },
  en: { title: 'Quality Control Report (QC REPORT)', noItems: 'No defects found — product fully accepted', reasonHeading: 'Reason for Defected and Rejected', overview: 'overview' }
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ====== hover-zoom popup รูป (ใช้ร่วมกันทุกรูปในเอกสาร) ======
let _zoomEl = null;
function _ensureZoom() {
  if (_zoomEl) return _zoomEl;
  _zoomEl = document.createElement('div');
  _zoomEl.className = 'photo-zoom-preview';
  document.body.appendChild(_zoomEl);
  return _zoomEl;
}
function showZoom(url, evt) {
  const el = _ensureZoom();
  el.innerHTML = `<img src="${url}">`;
  el.classList.add('show');
  moveZoom(evt);
}
function moveZoom(evt) {
  if (!_zoomEl || !_zoomEl.classList.contains('show')) return;
  const pad = 18;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + 320 > window.innerWidth) x = evt.clientX - 320 - pad;
  if (y + 320 > window.innerHeight) y = evt.clientY - 320 - pad;
  _zoomEl.style.left = Math.max(4, x) + 'px';
  _zoomEl.style.top = Math.max(4, y) + 'px';
}
function hideZoom() {
  if (_zoomEl) _zoomEl.classList.remove('show');
}

function photoFigure(url, label) {
  return `<figure>
    <img src="${url}" onmouseenter="showZoom('${url}', event)" onmousemove="moveZoom(event)" onmouseleave="hideZoom()" onclick="window.open('${url}','_blank')">
    <figcaption>${label}</figcaption>
  </figure>`;
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
      ${it.video_url ? `<div class="doc-clip">link clip: <a href="${it.video_url}" target="_blank" rel="noopener">${it.video_url}</a></div>` : ''}
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
  const approvedBoxHtml = (opts && opts.approvedBoxHtml) || signBoxHtml('Approved by', report.approved_by, report.approved_sign_url, report.approved_date);

  return `
    <div class="doc-head">
      <div class="no-box">NO. ${escapeHtml(report.id)}</div>
      <div class="company">APOSTROPHE L CO.,LTD</div>
      <div class="title">${L.title}</div>
    </div>

    <div class="doc-grid">
      <div class="row"><span class="k">Supplier Code</span><span class="v">${escapeHtml(report.supplier_code)}</span></div>
      <div class="row"><span class="k">Supplier Name</span><span class="v">${escapeHtml(report.supplier_name || '-')}</span></div>
      <div class="row"><span class="k">Stock Code</span><span class="v">${escapeHtml(report.stock_code)}</span></div>
      <div class="row"><span class="k">Date In</span><span class="v">${fmtDateTH(report.date_in)}</span></div>
      <div class="row"><span class="k">EAN 13 Code</span><span class="v">${escapeHtml(report.ean13 || '-')}</span></div>
      <div class="row"><span class="k">QA Date</span><span class="v">${fmtDateTH(report.date_qa)}</span></div>
      <div class="row"><span class="k">Order (Pcs)</span><span class="v">${report.order_qty}</span></div>
    </div>
    <div class="row" style="border-bottom:1px dotted var(--border);padding:4px 0;margin-bottom:10px">
      <span class="k">Description</span> <span class="v">${escapeHtml(description)}</span>
    </div>

    <div class="doc-summary">
      <div class="box summary-accepted">Accepted<br>${report.accepted_qty} Pcs</div>
      <div class="box summary-defected">Defected<br>${report.defected_qty} Pcs</div>
      <div class="box summary-rejected">Rejected<br>${report.rejected_qty} Pcs</div>
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
