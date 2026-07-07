// ============================================================
//  QC Report — share.html logic (ลิงก์แชร์สาธารณะ อ่านอย่างเดียว ไม่ต้อง login)
// ============================================================

const qs = new URLSearchParams(window.location.search);
const token = qs.get('token');
// ภาษาถูกกำหนดตายตัวจากตอนแชร์ (คนกดแชร์เลือกไว้แล้ว) — ผู้รับลิงก์ดูได้แค่ภาษานั้น ไม่มีปุ่มสลับ
const fixedLang = qs.get('lang') === 'en' ? 'en' : 'th';
const appEl = document.getElementById('app');

let curReport = null, curItems = null;

async function load() {
  if (!token) { appEl.innerHTML = `<div class="empty-state">ลิงก์ไม่ถูกต้อง</div>`; return; }
  // ส่ง translate เฉพาะตอนต้องการ true เท่านั้น (ส่ง false จะกลายเป็น string "false" ที่ยังเป็นค่า truthy ฝั่ง GAS)
  const params = fixedLang === 'en' ? { token, translate: true } : { token };
  const res = await apiCallPublic('getSharedReport', params);
  if (!res.success) { appEl.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'ไม่พบเอกสาร')}</div>`; return; }
  curReport = res.report; curItems = res.items;
  render();
}

function render() {
  const docBody = buildDocHtml(curReport, curItems, { lang: fixedLang });
  appEl.innerHTML = `
    <div class="doc-a4">
      ${docBody}
      <div class="doc-actions no-print">
        <button type="button" class="btn btn-ghost" onclick="window.print()">🖨️ ปริ้นเอกสาร</button>
      </div>
    </div>`;
}

load();
