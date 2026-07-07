// ============================================================
//  QC Report — Signature Pad (popup วาดลายเซ็นด้วยเมาส์/นิ้ว)
// ============================================================

const SignaturePad = {
  open(onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'sign-overlay';
    overlay.innerHTML = `
      <div class="sign-modal">
        <div class="sign-modal-title">เซ็นชื่อ</div>
        <canvas class="sign-canvas"></canvas>
        <div class="sign-modal-actions">
          <button type="button" class="btn btn-ghost" data-act="clear">ล้าง</button>
          <button type="button" class="btn btn-ghost" data-act="cancel">ยกเลิก</button>
          <button type="button" class="btn btn-primary" data-act="confirm">ยืนยันลายเซ็น</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('.sign-canvas');
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1b1f24';
    }
    // ต้อง resize หลัง element ถูก layout แล้ว
    requestAnimationFrame(resize);

    let drawing = false, hasDrawn = false, lastX = 0, lastY = 0;

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    function start(e) {
      e.preventDefault();
      drawing = true;
      const p = pos(e);
      lastX = p.x; lastY = p.y;
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
      hasDrawn = true;
    }
    function end() { drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    function close() {
      window.removeEventListener('mouseup', end);
      overlay.remove();
    }

    overlay.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (act === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); hasDrawn = false; }
      else if (act === 'cancel') close();
      else if (act === 'confirm') {
        if (!hasDrawn) { toast('กรุณาเซ็นชื่อก่อนยืนยัน', 'error'); return; }
        const dataUrl = canvas.toDataURL('image/png');
        close();
        onConfirm(dataUrl);
      } else if (e.target === overlay) {
        close();
      }
    });
  }
};
