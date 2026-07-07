// ============================================================
//  QC Report — view.html logic (ดู / อนุมัติ / แชร์ / แปลภาษา / ปริ้น)
// ============================================================

if (!Auth.requireAuth()) { /* redirected */ }

document.getElementById('userName').textContent = (Auth.getUser() || {}).name || '';
document.getElementById('userRole').textContent = Auth.getRoleLabel((Auth.getUser() || {}).role);

const appEl = document.getElementById('app');
const qs = new URLSearchParams(window.location.search);
const docId = qs.get('id');

let approvedSign = null;
let curLang = 'th';
let curReport = null, curItems = null;

async function load() {
  if (!docId) { appEl.innerHTML = `<div class="empty-state">ไม่พบเลขที่เอกสาร</div>`; return; }
  const res = await API.getReport(docId);
  if (!res.success) { appEl.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'ไม่พบเอกสาร')}</div>`; return; }
  curReport = res.report; curItems = res.items;
  render();
}

function render() {
  const report = curReport, items = curItems;
  const role = (Auth.getUser() || {}).role;
  const canApprove = report.status === 'pending_approval' && role === 'admin';
  const isApproved = report.status === 'approved';
  const canShare = ['admin', 'monitor'].includes(role);

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

  const docBody = buildDocHtml(report, items, { lang: curLang, approvedBoxHtml });

  appEl.innerHTML = `
    <div class="doc-a4">
      ${docBody}
      ${!isApproved && !canApprove ? `<div class="pending-note">⏳ เอกสารนี้อยู่ระหว่างรออนุมัติ</div>` : ''}
      <div class="doc-actions no-print">
        ${canApprove ? `<button type="button" class="btn btn-primary" id="btnApprove">ส่งเข้าระบบ</button>` : ''}
        ${isApproved ? `<button type="button" class="btn btn-ghost" onclick="window.print()">🖨️ ปริ้นเอกสาร</button>` : ''}
        <button type="button" class="btn btn-ghost" id="btnLang">${curLang === 'th' ? '🌐 English' : '🌐 ภาษาไทย'}</button>
        ${canShare ? `<button type="button" class="btn btn-ghost" id="btnShare">🔗 แชร์ลิงก์</button>` : ''}
        <a href="reports.html" class="btn btn-ghost">กลับไปหน้ารายงาน</a>
      </div>
    </div>
  `;

  document.getElementById('btnLang').addEventListener('click', onToggleLang);
  if (canShare) document.getElementById('btnShare').addEventListener('click', onShare);

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

async function onToggleLang() {
  const wantEn = curLang === 'th';
  if (wantEn && needsTranslation(curReport, curItems)) {
    const res = await API.translateReport({ id: curReport.id });
    if (!res.success) { toast(res.message || 'แปลภาษาไม่สำเร็จ', 'error'); return; }
    curReport = Object.assign({}, curReport, { description_en: res.report.description_en, supplier_name_en: res.report.supplier_name_en });
    curItems = res.items;
  }
  curLang = wantEn ? 'en' : 'th';
  render();
}

async function onShare() {
  const res = await API.shareReport({ id: curReport.id });
  if (!res.success) { toast(res.message || 'สร้างลิงก์ไม่สำเร็จ', 'error'); return; }
  // แชร์ไปตามภาษาที่กำลังดูอยู่ตอนนี้ (curLang) — คนรับลิงก์เห็นแค่ภาษานั้น ไม่มีปุ่มสลับให้
  const url = window.location.origin + window.location.pathname.replace(/view\.html$/, '') + 'share.html?token=' + res.token + '&lang=' + curLang;
  showShareModal(url, res);
}

function showShareModal(url, meta) {
  const overlay = document.createElement('div');
  overlay.className = 'sign-overlay';
  const usageLine = meta
    ? `ใช้ไปแล้ว ${meta.shareCount}/${meta.shareLimit} ครั้ง · ลิงก์นี้หมดอายุ ${fmtDateTimeTH(meta.expiresAt)}`
    : '';
  overlay.innerHTML = `
    <div class="sign-modal">
      <div class="sign-modal-title">🔗 ลิงก์แชร์</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">คัดลอกไปส่งได้เลย — กดปุ่มแชร์ซ้ำจะได้ลิงก์ใหม่ ลิงก์เก่าจะใช้ไม่ได้ทันที<br>${usageLine}</div>
      <input type="text" readonly value="${url.replace(/"/g, '&quot;')}" id="shareLinkInput" style="width:100%;box-sizing:border-box">
      <div class="sign-modal-actions">
        <button type="button" class="btn btn-ghost" data-act="close">ปิด</button>
        <button type="button" class="btn btn-primary" data-act="copy">📋 คัดลอกลิงก์</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#shareLinkInput');
  input.addEventListener('click', () => input.select());

  overlay.addEventListener('click', async (e) => {
    const act = e.target.dataset.act;
    if (act === 'close' || e.target === overlay) { overlay.remove(); }
    else if (act === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        toast('คัดลอกลิงก์แล้ว', 'success');
      } catch (err) {
        input.select();
        document.execCommand('copy');
        toast('คัดลอกลิงก์แล้ว', 'success');
      }
    }
  });
}

load();
