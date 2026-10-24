// =====================================================
//  PISTOLA CON EL TELÉFONO (lado de la computadora)
//  Muestra un código QR. El teléfono lo escanea, se conecta
//  y envía hacia dónde apunta y cuándo dispara.
// =====================================================
const Remoto = {
  peer: null,
  conn: null,
  id: null,
  listo: false,
  activo: false,

  iniciar() {
    if (this.peer) return;
    if (typeof Peer === 'undefined') { this.estado('No se pudo cargar la conexión. Puedes jugar con el mouse.'); return; }
    this.id = 'cumple-' + Math.random().toString(36).slice(2, 8);
    this.peer = new Peer(this.id);
    this.peer.on('open', () => {
      this.listo = true;
      this.pintarQR();
      this.estado('Escanea el código con la cámara del teléfono');
    });
    this.peer.on('connection', c => {
      if (this.conn) this.conn.close();
      this.conn = c;
      c.on('open', () => { this.estado('📱 ¡Pistola conectada! Dispara para empezar'); Sonido.moneda(); });
      c.on('data', d => this.recibir(d));
      c.on('close', () => { this.conn = null; this.estado('El teléfono se desconectó. Escanea otra vez.'); });
    });
    this.peer.on('disconnected', () => { if (!this.peer.destroyed) this.peer.reconnect(); });
    this.peer.on('error', e => {
      console.warn('Remoto:', e);
      this.estado('No se pudo conectar el teléfono. Puedes jugar con el mouse.');
    });
  },

  url() {
    return new URL('control.html', location.href).href.split('?')[0] + '?id=' + this.id;
  },

  pintarQR() {
    const caja = document.getElementById('qr-codigo');
    if (!caja || !this.id) return;
    caja.innerHTML = '';
    if (typeof QRCode !== 'undefined') new QRCode(caja, { text: this.url(), width: 170, height: 170 });
    else caja.textContent = this.url();
  },

  // Se llama desde main.js al abrir o cerrar el juego de los patos
  mostrar(si) {
    const caja = document.getElementById('qr-remoto');
    if (caja) caja.classList.toggle('oculto', !si);
    if (si) this.iniciar();
  },

  estado(txt) {
    const e = document.getElementById('qr-estado');
    if (e) e.textContent = txt;
    const ayuda = document.getElementById('ayuda-juego');
    if (ayuda && this.activo && this.conn) ayuda.textContent = '📱 Pistola conectada · apunta moviendo el teléfono y toca el botón rojo';
  },

  recibir(d) {
    if (!this.activo || !d || typeof d !== 'object') return;
    const lim = v => Math.max(0, Math.min(1, Number(v) || 0));
    if (d.tipo === 'mira') {
      Entrada.mouse.x = lim(d.x) * 960;
      Entrada.mouse.y = lim(d.y) * 540;
    } else if (d.tipo === 'disparo') {
      const ov = document.getElementById('overlay');
      if (ov && !ov.classList.contains('oculto')) {
        document.getElementById('overlay-btn').click(); // "¡A jugar!" / "Intentar de nuevo"
        return;
      }
      Entrada.clicks.push({ x: Entrada.mouse.x, y: Entrada.mouse.y, boton: 0 });
    }
  },
};
