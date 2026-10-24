// =====================================================
//  MOTOR COMPARTIDO: teclado, ratón, bucle, sonidos y dibujos
// =====================================================
window.Juegos = {};

const azar = (a, b) => a + Math.random() * (b - a);
const choque = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const esperar = ms => new Promise(r => setTimeout(r, ms));
function mezclar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[k]] = [arr[k], arr[i]];
  }
  return arr;
}

// ---------- Teclado y ratón ----------
const Entrada = {
  teclas: {},
  presionadas: {},
  clicks: [],
  mouse: { x: 0, y: 0, abajo: false },

  init(lienzo) {
    addEventListener('keydown', e => {
      if (!this.teclas[e.code]) this.presionadas[e.code] = true;
      this.teclas[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.teclas[e.code] = false; });
    addEventListener('blur', () => { this.teclas = {}; });

    const pos = (cx, cy) => {
      const r = lienzo.getBoundingClientRect();
      return { x: (cx - r.left) * lienzo.width / r.width, y: (cy - r.top) * lienzo.height / r.height };
    };
    lienzo.addEventListener('mousemove', e => {
      const p = pos(e.clientX, e.clientY);
      this.mouse.x = p.x; this.mouse.y = p.y;
    });
    lienzo.addEventListener('mousedown', e => {
      const p = pos(e.clientX, e.clientY);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.abajo = true;
      this.clicks.push({ x: p.x, y: p.y, boton: e.button });
    });
    addEventListener('mouseup', () => { this.mouse.abajo = false; });
    lienzo.addEventListener('contextmenu', e => e.preventDefault());
    lienzo.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const tq of e.changedTouches) {
        const p = pos(tq.clientX, tq.clientY);
        this.mouse.x = p.x; this.mouse.y = p.y;
        this.clicks.push({ x: p.x, y: p.y, boton: 0 });
      }
    }, { passive: false });
  },
  tomarClicks() { const c = this.clicks; this.clicks = []; return c; },
  limpiar() { this.presionadas = {}; this.clicks = []; },
};

// ---------- Bucle de juego ----------
function crearBucle(actualizar, dibujar) {
  let vivo = true, ultimo = performance.now(), id;
  function paso(ahora) {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    actualizar(dt);
    if (!vivo) return;
    dibujar();
    Entrada.presionadas = {};
    id = requestAnimationFrame(paso);
  }
  id = requestAnimationFrame(paso);
  return () => { vivo = false; cancelAnimationFrame(id); };
}

// ---------- Sonidos (sintetizados, sin archivos) ----------
const Sonido = {
  ctx: null,
  maestro: null,
  iniciar() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = 0.8;
      this.maestro.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tono(f, dur = 0.15, tipo = 'square', vol = 0.12, fFin = null, retraso = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + retraso;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t0);
    if (fFin) o.frequency.exponentialRampToValueAtTime(fFin, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.maestro);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  ruido(dur = 0.3, vol = 0.25, frec = 1200, retraso = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + retraso;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = frec;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.maestro);
    s.start(t0);
  },
  salto()     { this.tono(320, 0.18, 'square', 0.08, 680); },
  moneda()    { this.tono(988, 0.07, 'square', 0.08); this.tono(1319, 0.3, 'square', 0.08, null, 0.07); },
  golpe()     { this.tono(180, 0.08, 'square', 0.1, 90); },
  romper()    { this.ruido(0.18, 0.25, 2500); this.tono(140, 0.1, 'square', 0.08, 70); },
  pisar()     { this.tono(500, 0.1, 'square', 0.1, 150); },
  muerte()    { [660, 520, 400, 300, 220].forEach((f, i) => this.tono(f, 0.16, 'square', 0.1, null, i * 0.14)); },
  dano()      { this.tono(220, 0.2, 'sawtooth', 0.12, 110); },
  explosion() { this.ruido(0.7, 0.45, 700); this.tono(90, 0.4, 'sine', 0.25, 40); },
  disparo()   { this.ruido(0.25, 0.5, 3500); this.tono(160, 0.15, 'square', 0.1, 60); },
  poner()     { this.tono(240, 0.06, 'triangle', 0.15); },
  click()     { this.tono(700, 0.05, 'triangle', 0.08); },
  error()     { this.tono(160, 0.18, 'square', 0.08); },
  desplegar() { this.tono(440, 0.08, 'triangle', 0.12, 880); },
  graznido()  { this.tono(420, 0.12, 'sawtooth', 0.07, 300); this.tono(400, 0.12, 'sawtooth', 0.07, 280, 0.16); },
  caer()      { this.tono(600, 0.6, 'square', 0.06, 150); this.ruido(0.15, 0.3, 400, 0.6); },
  risa()      { for (let i = 0; i < 8; i++) { const f = i % 2 ? 470 : 560; this.tono(f, 0.11, 'sawtooth', 0.09, f * 0.72, i * 0.15); } },
  victoria()  { [523, 659, 784, 1047].forEach((f, i) => this.tono(f, i === 3 ? 0.5 : 0.14, 'square', 0.09, null, i * 0.13)); },
  soplo()     { this.ruido(0.6, 0.18, 900); },
  campanita() { this.tono(1568, 0.6, 'sine', 0.12, null, 0.15); this.tono(2093, 0.8, 'sine', 0.08, null, 0.3); },
};

// ---------- Partículas y textos flotantes ----------
class Particulas {
  constructor() { this.lista = []; }
  emitir(x, y, color, n = 10, vel = 200, grav = 600, vida = 0.8, tam = 4) {
    for (let i = 0; i < n; i++) {
      this.lista.push({ x, y, vx: azar(-1, 1) * vel, vy: azar(-1, 0.3) * vel, color, vida, max: vida, tam, grav });
    }
  }
  actualizar(dt) {
    for (const p of this.lista) {
      p.vida -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.lista = this.lista.filter(p => p.vida > 0);
  }
  dibujar(ctx) {
    for (const p of this.lista) {
      ctx.globalAlpha = Math.max(0, p.vida / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam);
    }
    ctx.globalAlpha = 1;
  }
}

class TextosFlotantes {
  constructor() { this.lista = []; }
  agregar(x, y, txt, color = '#fff', vida = 1) { this.lista.push({ x, y, txt, color, vida, max: vida }); }
  actualizar(dt) {
    for (const p of this.lista) { p.vida -= dt; p.y -= 35 * dt; }
    this.lista = this.lista.filter(p => p.vida > 0);
  }
  dibujar(ctx) {
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.lista) {
      ctx.globalAlpha = Math.min(1, p.vida / p.max * 2);
      ctx.fillStyle = '#000';
      ctx.fillText(p.txt, p.x + 2, p.y + 2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.txt, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

// ---------- Dibujos compartidos ----------
function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dibujarSolIcono(ctx, x, y, r, rot = 0, color = '#ffd23f') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 1.05);
    ctx.lineTo(0, -r * 1.65);
    ctx.lineTo(r * 0.3, -r * 1.05);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// El "niño del sol": el protagonista de los juegos
function dibujarNinoSol(ctx, x, y, w, h, dir = 1, paso = 0) {
  const s = h / 34;
  const p = Math.sin(paso) * 3;
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale(dir * s, s);
  // piernas y zapatos
  ctx.fillStyle = '#2c4a8c';
  ctx.fillRect(-7 + p, 25, 6, 8);
  ctx.fillRect(1 - p, 25, 6, 8);
  ctx.fillStyle = '#5a2d0c';
  ctx.fillRect(-8 + p, 31, 8, 3);
  ctx.fillRect(0 - p, 31, 8, 3);
  // camisa
  ctx.fillStyle = '#ff8c1a';
  ctx.fillRect(-9, 14, 18, 12);
  // brazos
  ctx.fillStyle = '#f1c27d';
  ctx.fillRect(-12, 15 - p * 0.5, 4, 9);
  ctx.fillRect(8, 15 + p * 0.5, 4, 9);
  // cabeza
  ctx.beginPath();
  ctx.arc(0, 9, 7, 0, Math.PI * 2);
  ctx.fill();
  // gorrito de sol con rayos
  ctx.fillStyle = '#ffd23f';
  ctx.save();
  ctx.translate(0, 4);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + i * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.22) * 7, Math.sin(a - 0.22) * 7);
    ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
    ctx.lineTo(Math.cos(a + 0.22) * 7, Math.sin(a + 0.22) * 7);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, Math.PI, 0);
  ctx.fill();
  ctx.restore();
  // ojo y sonrisa
  ctx.fillStyle = '#222';
  ctx.fillRect(3, 8, 2, 3);
  ctx.strokeStyle = '#8a4b2a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(2, 11, 2.5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

function dibujarCorazon(ctx, x, y, tam, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + tam * 0.35);
  ctx.bezierCurveTo(x, y, x - tam * 0.5, y, x - tam * 0.5, y + tam * 0.35);
  ctx.bezierCurveTo(x - tam * 0.5, y + tam * 0.65, x, y + tam * 0.8, x, y + tam);
  ctx.bezierCurveTo(x, y + tam * 0.8, x + tam * 0.5, y + tam * 0.65, x + tam * 0.5, y + tam * 0.35);
  ctx.bezierCurveTo(x + tam * 0.5, y, x, y, x, y + tam * 0.35);
  ctx.fill();
}
