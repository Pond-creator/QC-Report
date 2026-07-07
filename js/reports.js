// ============================================================
//  QC Report — reports.html logic (ค้นหา/รายการเอกสาร)
// ============================================================

if (!Auth.requireAuth()) { /* redirected */ }

document.getElementById('userName').textContent = (Auth.getUser() || {}).name || '';
document.getElementById('userRole').textContent = Auth.getRoleLabel((Auth.getUser() || {}).role);

const listWrap = document.getElementById('listWrap');
let all = [];
const PAGE_SIZE = 50;
let curPage = 1;

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

  const isAdmin = (Auth.getUser() || {}).role === 'admin';
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (curPage > totalPages) curPage = totalPages;
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  listWrap.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>NO.</th><th>Supplier Code</th><th>Stock Code</th><th>Description</th>
          <th>Order</th><th>Accepted</th><th>Defected</th><th>Rejected</th>
          <th>สถานะ</th><th>วันที่สร้าง</th>${isAdmin ? '<th>จัดการ</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${pageRows.map(r => `
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
            ${isAdmin ? `<td class="row-actions">
              <button type="button" class="icon-btn" title="แก้ไข" data-act="edit" data-id="${escapeHtml(r.id)}">✏️</button>
              <button type="button" class="icon-btn" title="ลบ" data-act="delete" data-id="${escapeHtml(r.id)}">🗑</button>
            </td>` : ''}
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="pagination">
      <button type="button" class="btn btn-ghost btn-sm" id="btnPrevPage" ${curPage <= 1 ? 'disabled' : ''}>← ก่อนหน้า</button>
      <span>หน้า ${curPage} / ${totalPages} (ทั้งหมด ${rows.length} รายการ)</span>
      <button type="button" class="btn btn-ghost btn-sm" id="btnNextPage" ${curPage >= totalPages ? 'disabled' : ''}>ถัดไป →</button>
    </div>`;

  document.getElementById('btnPrevPage').addEventListener('click', () => { curPage--; render(); });
  document.getElementById('btnNextPage').addEventListener('click', () => { curPage++; render(); });
}

listWrap.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  e.stopPropagation();
  const id = btn.dataset.id;
  if (btn.dataset.act === 'edit') {
    window.location.href = 'form.html?id=' + encodeURIComponent(id);
  } else if (btn.dataset.act === 'delete') {
    if (!confirm(`ลบเอกสาร ${id} ถาวร? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    const res = await API.deleteReport({ id });
    if (res.success) { toast('ลบเอกสารแล้ว', 'success'); loadList(); }
    else toast(res.message || 'ลบไม่สำเร็จ', 'error');
  }
});

document.getElementById('q').addEventListener('input', () => { curPage = 1; render(); });
document.getElementById('statusFilter').addEventListener('change', () => { curPage = 1; render(); });

loadList();
