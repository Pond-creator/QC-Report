// ============================================================
//  QC Report — reports.html logic (ค้นหา/รายการเอกสาร)
// ============================================================

if (!Auth.requireAuth()) { /* redirected */ }

document.getElementById('userName').textContent = (Auth.getUser() || {}).name || '';
document.getElementById('userRole').textContent = Auth.getRoleLabel((Auth.getUser() || {}).role);

const listWrap = document.getElementById('listWrap');
let all = [];

// monitor เห็นได้แค่เอกสารที่อนุมัติแล้ว (เซ็นครบ) — เซิร์ฟเวอร์บังคับอยู่แล้ว, ล็อก UI ให้ตรงกันด้วย
if ((Auth.getUser() || {}).role === 'monitor') {
  const sf = document.getElementById('statusFilter');
  sf.value = 'approved';
  sf.disabled = true;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadList() {
  const res = await API.listReports();
  if (!res.success) { listWrap.innerHTML = `<div class="empty-state">${escapeHtml(res.message || 'โหลดข้อมูลไม่สำเร็จ')}</div>`; return; }
  all = res.data;
  render();
}

function render() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let rows = all;
  if (status) rows = rows.filter(r => r.status === status);
  if (q) {
    rows = rows.filter(r =>
      String(r.id).toLowerCase().includes(q) ||
      String(r.supplier_code).toLowerCase().includes(q) ||
      String(r.stock_code).toLowerCase().includes(q) ||
      String(r.ean13).toLowerCase().includes(q) ||
      String(r.description).toLowerCase().includes(q)
    );
  }
  if (!rows.length) { listWrap.innerHTML = `<div class="empty-state">ไม่พบเอกสาร</div>`; return; }

  listWrap.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>NO.</th><th>Supplier Code</th><th>Stock Code</th><th>Description</th>
          <th>Order</th><th>Accepted</th><th>Defected</th><th>Rejected</th>
          <th>สถานะ</th><th>วันที่สร้าง</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr onclick="window.location.href='view.html?id=${encodeURIComponent(r.id)}'">
            <td>${escapeHtml(r.id)}</td>
            <td>${escapeHtml(r.supplier_code)}</td>
            <td>${escapeHtml(r.stock_code)}</td>
            <td>${escapeHtml(r.description)}</td>
            <td>${r.order_qty}</td>
            <td>${r.accepted_qty}</td>
            <td>${r.defected_qty}</td>
            <td>${r.rejected_qty}</td>
            <td><span class="badge badge-${r.status === 'approved' ? 'approved' : 'pending'}">${statusLabel(r.status)}</span></td>
            <td>${fmtDateTimeTH(r.created_at)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

document.getElementById('q').addEventListener('input', render);
document.getElementById('statusFilter').addEventListener('change', render);

loadList();
