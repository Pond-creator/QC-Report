// ============================================================
//  QC Report — share.html logic (ลิงก์แชร์สาธารณะ อ่านอย่างเดียว ไม่ต้อง login)
// ============================================================

const qs = new URLSearchParams(window.location.search);
const token = qs.get('token');
const appEl = document.getElementById('app');

let curReport = null, curItems = null, curLang = 'th';

async function load() {
  if (!token) { appEl.innerHTML = `<div class="empty-state">ลิงก์ไม่ถูกต้อง</div>`; return; }
  const res = await apiCallPublic('getSharedReport', { token });
  if (!res.success) { appEl.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'ไม่พบเอกสาร')}</div>`; return; }
  curReport = res.report; curItems = res.items;
  render();
}

function render() {
  const docBody = buildDocHtml(curReport, curItems, { lang: curLang });
  appEl.innerHTML = `
    <div class="doc-a4">
      ${docBody}
      <div class="doc-actions no-print">
        <button type="button" class="btn btn-ghost" onclick="window.print()">🖨️ ปริ้นเอกสาร</button>
        <button type="button" class="btn btn-ghost" id="btnLang">${curLang === 'th' ? '🌐 English' : '🌐 ภาษาไทย'}</button>
      </div>
    </div>`;
  document.getElementById('btnLang').addEventListener('click', onToggleLang);
}

async function onToggleLang() {
  const wantEn = curLang === 'th';
  if (wantEn) {
    const needsTranslate = !curReport.description_en || curItems.some(it => it.reason_text && !it.reason_text_en);
    if (needsTranslate) {
      const res = await apiCallPublic('getSharedReport', { token, translate: true });
      if (!res.success) { toast(res.message || 'แปลภาษาไม่สำเร็จ', 'error'); return; }
      curReport = res.report; curItems = res.items;
    }
  }
  curLang = wantEn ? 'en' : 'th';
  render();
}

load();
