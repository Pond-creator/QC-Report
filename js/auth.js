// ============================================================
//  QC Report — Auth Manager
// ============================================================

const Auth = {
  getToken: () => localStorage.getItem('qc_token'),
  getUser: () => JSON.parse(localStorage.getItem('qc_user') || 'null'),

  setSession: (token, user) => {
    localStorage.setItem('qc_token', token);
    localStorage.setItem('qc_user', JSON.stringify(user));
  },

  clear: () => {
    localStorage.removeItem('qc_token');
    localStorage.removeItem('qc_user');
  },

  isLoggedIn: () => !!localStorage.getItem('qc_token'),

  hasRole: (roles) => {
    const user = Auth.getUser();
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  },

  requireAuth: () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  logout: () => {
    Auth.clear();
    window.location.href = 'index.html';
  },

  getRoleLabel: (role) => {
    const labels = { admin: 'Admin', user: 'ผู้ปฏิบัติงาน', monitor: 'ผู้ดูรายงาน' };
    return labels[role] || role;
  },

  // สิทธิ์เข้าถึงแต่ละหน้า (key = ชื่อไฟล์ .html) — monitor ดูได้แค่ reports.html/view.html (เอกสารที่อนุมัติแล้ว)
  pageRoles: {
    'form.html': ['admin', 'user']
  },
  canPage: (page) => {
    const roles = Auth.pageRoles[page];
    if (!roles) return true; // ไม่ระบุ = เข้าได้ทุก role ที่ login แล้ว
    return roles.includes((Auth.getUser() || {}).role);
  },

  landing: () => 'reports.html',

  requirePage: (page) => {
    if (!Auth.requireAuth()) return false;
    if (!Auth.canPage(page)) { window.location.href = Auth.landing(); return false; }
    return true;
  }
};

// ซ่อนเมนูที่ role นี้เข้าไม่ได้
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) return;
  Object.keys(Auth.pageRoles).forEach(page => {
    if (!Auth.canPage(page))
      document.querySelectorAll(`a[href="${page}"]`).forEach(a => a.style.display = 'none');
  });
});
