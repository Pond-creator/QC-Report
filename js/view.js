// ============================================================
//  QC Report — view.html logic (ดู / อนุมัติ / ปริ้น)
// ============================================================

if (!Auth.requireAuth()) { /* redirected */ }

document.getElementById('userName').textContent = (Auth.getUser() || {}).name || '';
document.getElementById('userRole').textContent = Auth.getRoleLabel((Auth.getUser() || {}).role);

const appEl = document.getElementById('app');
const qs = new URLSearchParams(window.location.search);
const docId = qs.get('id');

let approvedSign = null;

function photoFigure(url, label) {
  return `<figure><img src="${url}" onclick="window.open('${url}','_blank')"><figcaption>${label}</figcaption></figure>`;
}

function reasonItemHtml(it, idx) {
  const photosHtml = (it.photos || []).map(p => `
    ${p.closeup ? photoFigure(p.closeup, 'close-up') : ''}
    ${p.overview ? photoFigure(p.overview, 'ภาพรวม') : ''}
  `).join('');
  return `
    <div class="doc-reason-item">
      <div class="head">
        <div>${idx + 1}) <span class="tag tag-${it.type}">${it.type}</span> ${escapeHtml(it.reason_text)}</div>
        <div><b>Qty:</b> ${it.qty} Pcs</div>
      </div>
      ${photosHtml ? `<div class="doc-photo-grid">${photosHtml}</div>` : ''}
      ${it.video_url ? `<div class="doc-clip">link clip: <a href="${it.video_url}" target="_blank" rel="noopener">${it.video_url}</a></div>` : ''}
    </div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function signBoxHtml(label, name, signUrl, dateStr) {
  return `<div class="box">
    ${signUrl ? `<img src="${signUrl}">` : `<div class="placeholder-line"></div>`}
    <div>${name || '-'}</div>
    <div style="color:var(--muted);font-size:12px">${label} · ${fmtDateTH(dateStr)}</div>
  </div>`;
}

async function load() {
  if (!docId) { appEl.innerHTML = `<div class="empty-state">ไม่พบเลขที่เอกสาร</div>`; return; }
  const res = await API.getReport(docId);
  if (!res.success) { appEl.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'ไม่พบเอกสาร')}</div>`; return; }
  render(res.report, res.items);
}

function render(report, items) {
  const canApprove = report.status === 'pending_approval' && (Auth.getUser() || {}).role === 'admin';
  const isApproved = report.status === 'approved';

  const approvedBoxHtml = isApproved
    ? signBoxHtml('Approved by', report.approved_by, report.approved_sign_url, report.approved_date)
    : canApprove
      ? `<div class="box no-print">
           <div class="sign-canvas-preview" id="approvedPreview" style="max-width:100%"><span class="placeholder">ยังไม่เซ็นชื่อ</span></div>
           <button type="button" class="btn btn-ghost btn-sm" id="btnSignApproved">✍️ Sign</button>
           <div class="sign-name-label" style="color:var(--green)">Approved by</div>
           <input type="text" id="approved_by" value="${escapeHtml((Auth.getUser() || {}).name || '')}" style="max-width:220px;margin:0 auto 8px">
           <input type="text" id="approved_date" placeholder="Date" readonly style="max-width:200px;margin:0 auto">
         </div>`
      : `<div class="box"><div class="placeholder-line"></div><div style="color:var(--muted)">รออนุมัติ</div></div>`;

  appEl.innerHTML = `
    <div class="doc-a4">
      <div class="doc-head">
        <div class="no-box">NO. ${escapeHtml(report.id)}</div>
        <div class="company">APOSTROPHE L CO.,LTD</div>
        <div class="title">รายงานตรวจสอบคุณภาพสินค้า (QC REPORT)</div>
      </div>

      <div class="doc-grid">
        <div class="row"><span class="k">Supplier Code</span><span class="v">${escapeHtml(report.supplier_code)}</span></div>
        <div class="row"><span class="k">Date In</span><span class="v">${fmtDateTH(report.date_in)}</span></div>
        <div class="row"><span class="k">Stock Code</span><span class="v">${escapeHtml(report.stock_code)}</span></div>
        <div class="row"><span class="k">QA Date</span><span class="v">${fmtDateTH(report.date_qa)}</span></div>
        <div class="row"><span class="k">EAN 13 Code</span><span class="v">${escapeHtml(report.ean13 || '-')}</span></div>
        <div class="row"><span class="k">Order (Pcs)</span><span class="v">${report.order_qty}</span></div>
      </div>
      <div class="row" style="border-bottom:1px dotted var(--border);padding:4px 0;margin-bottom:10px">
        <span class="k">Description</span> <span class="v">${escapeHtml(report.description)}</span>
      </div>

      <div class="doc-summary">
        <div class="box summary-accepted">Accepted<br>${report.accepted_qty} Pcs</div>
        <div class="box summary-defected">Defected<br>${report.defected_qty} Pcs</div>
        <div class="box summary-rejected">Rejected<br>${report.rejected_qty} Pcs</div>
      </div>

      <div class="doc-reason">
        <h3>Reason for Defected and Rejected</h3>
        ${items.length ? items.map(reasonItemHtml).join('') : '<div class="empty-state">ไม่มีรายการตรวจ (สินค้าผ่านทั้งหมด)</div>'}
      </div>

      <div class="doc-sign-row">
        ${signBoxHtml('Verified by', report.verified_by, report.verified_sign_url, report.verified_date)}
        ${approvedBoxHtml}
      </div>

      ${!isApproved && !canApprove ? `<div class="pending-note">⏳ เอกสารนี้อยู่ระหว่างรออนุมัติ</div>` : ''}

      <div class="doc-actions">
        ${canApprove ? `<button type="button" class="btn btn-primary" id="btnApprove">ส่งเข้าระบบ</button>` : ''}
        ${isApproved ? `<button type="button" class="btn btn-ghost" onclick="window.print()">🖨️ ปริ้นเอกสาร</button>` : ''}
        <a href="reports.html" class="btn btn-ghost">กลับไปหน้ารายงาน</a>
      </div>
    </div>
  `;

  if (canApprove) {
    flatpickr('#approved_date', {
      dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y', defaultDate: 'today',
      locale: (window.flatpickr && flatpickr.l10ns && flatpickr.l10ns.th) ? 'th' : 'default', allowInput: true
    });
    document.getElementById('btnSignApproved').addEventListener('click', () => {
      SignaturePad.open(dataUrl => {
        approvedSign = dataUrl;
        document.getElementById('approvedPreview').innerHTML = `<img src="${dataUrl}">`;
      });
    });
    document.getElementById('btnApprove').addEventListener('click', async () => {
      if (!approvedSign) { toast('กรุณาเซ็นชื่อผู้อนุมัติ (Approved by) ก่อนส่งเข้าระบบ', 'error'); return; }
      const approved_date = document.getElementById('approved_date').value;
      if (!approved_date) { toast('กรุณาเลือก Date สำหรับ Approved by', 'error'); return; }
      const approved_by = document.getElementById('approved_by').value.trim() || (Auth.getUser() || {}).name;
      const res = await API.approveReport({ id: report.id, approved_by, approved_sign: approvedSign, approved_date });
      if (res.success) {
        toast('อนุมัติเอกสารสำเร็จ', 'success');
        setTimeout(load, 400);
      } else {
        toast(res.message || 'บันทึกไม่สำเร็จ', 'error');
      }
    });
  }
}

load();
