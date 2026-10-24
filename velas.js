// =====================================================
//  SOPLIDO (micrófono), MÚSICA, LAS 28 VELAS Y EL PASTEL
// =====================================================
const TOTAL_VELAS = 28;

// Escribe un mensaje de dos líneas letra por letra
function escribirMensaje(el, a = '', b = '', vel = 42) {
  el._token = (el._token || 0) + 1;
  const tok = el._token;
  el.innerHTML = '<span class="l1"></span><span class="l2"></span>';
  const s1 = el.querySelector('.l1'), s2 = el.querySelector('.l2');
  const A = Array.from(a || ''), B = Array.from(b || '');
  return new Promise(res => {
    let i = 0;
    const paso = () => {
      if (el._token !== tok) return res();
      i++;
      s1.textContent = A.slice(0, Math.min(i, A.length)).join('');
      s2.textContent = i > A.length ? B.slice(0, i - A.length).join('') : '';
      if (i < A.length + B.length) setTimeout(paso, vel); else res();
    };
    paso();
  });
}

// ---------- Detección del soplido con el micrófono ----------
const Soplido = {
  ok: false,
  umbral: 0.06,
  ambiente: 0,
  analizador: null,
  datos: null,

  async iniciar() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Navegador sin micrófono');
      const stream = await navigator.mediaDevices.getUserMedia({
        // echoCancellation ayuda a que la música no se confunda con un soplido
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
      const fuente = Sonido.ctx.createMediaStreamSource(stream);
      this.analizador = Sonido.ctx.createAnalyser();
      this.analizador.fftSize = 1024;
      fuente.connect(this.analizador);
      this.datos = new Float32Array(this.analizador.fftSize);
      this.ok = true;
    } catch (e) {
      console.warn('Micrófono no disponible:', e);
      this.ok = false;
    }
    return this.ok;
  },

  nivel() {
    if (!this.ok) return 0;
    this.analizador.getFloatTimeDomainData(this.datos);
    let s = 0;
    for (const v of this.datos) s += v * v;
    return Math.sqrt(s / this.datos.length);
  },

  // Escucha el cuarto (con la música sonando) para saber cuánto ruido hay
  calibrar() {
    return new Promise(res => {
      if (!this.ok) return res();
      let suma = 0, max = 0, n = 0;
      const fin = performance.now() + 1500;
      const paso = () => {
        const v = this.nivel();
        suma += v; max = Math.max(max, v); n++;
        if (performance.now() < fin) requestAnimationFrame(paso);
        else {
          this.ambiente = suma / n;
          this.umbral = Math.min(0.35, Math.max(0.05, this.ambiente * 4, max * 1.6));
          res();
        }
      };
      paso();
    });
  },
};

// ---------- Música: "Feliz cumpleaños" en cajita musical ----------
const Musica = {
  activo: false,
  silencio: false,
  gain: null,
  temporizador: null,
  PULSO: 0.46,
  CICLO: 28,
  MELODIA: [
    [67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2],
    [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
    [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
    [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 3],
  ],
  BAJO: [[1, 48], [4, 43], [7, 43], [10, 48], [13, 48], [16, 41], [20, 48], [22, 43], [23, 48]],

  iniciar() {
    if (this.activo || !Sonido.ctx) return;
    const c = Sonido.ctx;
    this.gain = c.createGain();
    this.gain.gain.value = this.silencio ? 0 : 0.5;
    this.gain.connect(Sonido.maestro);
    this.activo = true;
    this.programar(c.currentTime + 0.3);
  },

  nota(midi, t0, dur, vol, tipo) {
    const c = Sonido.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.gain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },

  programar(t0) {
    if (!this.activo) return;
    let b = 0;
    for (const [m, d] of this.MELODIA) {
      const t = t0 + b * this.PULSO;
      this.nota(m, t, Math.max(0.35, d * this.PULSO * 1.6), 0.16, 'triangle');
      this.nota(m + 12, t, 0.3, 0.03, 'sine');
      b += d;
    }
    for (const [bt, m] of this.BAJO) this.nota(m, t0 + bt * this.PULSO, this.PULSO * 2.6, 0.08, 'sine');
    const siguiente = t0 + this.CICLO * this.PULSO;
    this.temporizador = setTimeout(() => this.programar(siguiente), Math.max(0, (siguiente - Sonido.ctx.currentTime - 1) * 1000));
  },

  detener() {
    if (!this.activo) return;
    this.activo = false;
    clearTimeout(this.temporizador);
    const g = this.gain, c = Sonido.ctx;
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.setValueAtTime(g.gain.value, c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 2.5);
    setTimeout(() => g.disconnect(), 3000);
  },

  alternar() {
    this.silencio = !this.silencio;
    if (this.gain && this.activo) this.gain.gain.value = this.silencio ? 0 : 0.5;
    return this.silencio;
  },
};

// ---------- Las 28 velas, una por una ----------
const Velas = {
  i: 0,
  fuerza: 0,
  listo: false,
  apagando: false,
  activo: false,
  presionando: false,
  fase: 'normal',   // en la última vela: 'normal' → 'r' (tecla R) → 'lista'
  teclasR: 0,
  colores: ['#ff5fa2', '#5fc8ff', '#ffd45c', '#9b7bff', '#5fe0a0', '#ff8a5c', '#ff6b6b'],

  async iniciar(alTerminar) {
    this.alTerminar = alTerminar;
    this.i = 0;
    this.activo = true;
    this.vela = document.getElementById('vela');
    this.llama = document.getElementById('llama');
    this.humo = document.getElementById('humo');
    this.msg = document.getElementById('mensaje-vela');
    this.relleno = document.getElementById('medidor-relleno');
    this.nota = document.getElementById('nota-soplo');
    this.pantalla = document.getElementById('pantalla-velas');
    this.vela.style.opacity = '0';

    this.humo.innerHTML = '';
    for (let k = 0; k < 10; k++) {
      const s = document.createElement('span');
      s.style.animationDelay = (k * 0.12) + 's';
      s.style.setProperty('--dx', (Math.random() * 50 - 25) + 'px');
      this.humo.appendChild(s);
    }

    // Plan B sin micrófono: mantener presionada la vela o la barra espaciadora
    const esc = document.getElementById('escenario-vela');
    esc.addEventListener('pointerdown', () => { this.presionando = true; });
    addEventListener('pointerup', () => { this.presionando = false; });
    addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat) this.teclaR(); });

    this.botonMusica();
    this.textoNota = Soplido.ok
      ? '🎤 Sopla cerca del micrófono de la computadora para apagar la vela'
      : '⌨️ No se detectó micrófono: mantén presionada la barra espaciadora (o la vela) para soplar';
    this.nota.textContent = '🎵 Preparando las velitas... guarda silencio un momento';

    Musica.iniciar();
    await esperar(400);
    await Soplido.calibrar();
    this.nota.textContent = this.textoNota;

    this.mostrar();
    this.ultimo = performance.now();
    this._b = this.bucle.bind(this);
    requestAnimationFrame(this._b);
  },

  botonMusica() {
    if (document.getElementById('btn-musica')) return;
    const b = document.createElement('button');
    b.id = 'btn-musica';
    b.className = 'boton-chico';
    b.textContent = '🔊 Música';
    Object.assign(b.style, { position: 'absolute', bottom: '20px', right: '24px' });
    b.onclick = () => { b.textContent = Musica.alternar() ? '🔇 Música' : '🔊 Música'; };
    this.pantalla.appendChild(b);
  },

  esUltima() { return this.i === TOTAL_VELAS - 1; },

  // Si falta algún mensaje de la vela 28, no escribe nada (pero sigue funcionando)
  textoUltima(clave) {
    const u = CONFIG.ultimaVela || {};
    return Array.isArray(u[clave]) ? u[clave] : ['', ''];
  },

  mostrar() {
    const v = this.vela;
    v.style.opacity = '';
    v.style.setProperty('--color-raya', this.colores[this.i % this.colores.length]);
    v.classList.remove('saliendo');
    void v.offsetWidth; // reinicia la animación
    v.classList.add('entrando');
    this.llama.classList.remove('apagada');
    this.humo.classList.remove('activo');
    document.getElementById('num-vela').textContent = this.i + 1;
    this.fase = this.esUltima() ? 'r' : 'normal'; // la 28 no se apaga hasta presionar R dos veces
    this.teclasR = 0;
    const [a, b] = (this.esUltima() ? this.textoUltima('pedir') : CONFIG.velas[this.i]) || ['', ''];
    escribirMensaje(this.msg, a, b);
    this.fuerza = 0;
    this.listo = false;
    this.apagando = false;
    setTimeout(() => { v.classList.remove('entrando'); this.listo = true; }, 1000);
  },

  bucle(ahora) {
    if (!this.activo) return;
    const dt = Math.min(0.05, (ahora - this.ultimo) / 1000);
    this.ultimo = ahora;

    const nivel = Soplido.nivel();
    const soplando = nivel > Soplido.umbral || Entrada.teclas.Space || this.presionando;
    const puedeSoplar = this.listo && !this.apagando;

    if (puedeSoplar) {
      this.fuerza += soplando ? dt * 1.8 : -dt * 0.9;
      this.fuerza = Math.max(0, Math.min(this.fase === 'r' ? 0.85 : 1, this.fuerza));
      if (this.fuerza >= 1) this.apagar();
    }

    const viento = this.apagando ? 0 : Math.max(this.fuerza, Math.min(1, nivel / (Soplido.umbral * 2)) * 0.5);
    this.llama.style.transform = `skewX(${-viento * 28}deg) scale(${1 - viento * 0.35}, ${1 - viento * 0.25})`;
    this.relleno.style.width = (this.fuerza * 100) + '%';

    requestAnimationFrame(this._b);
  },

  apagar() {
    this.apagando = true;
    this.llama.classList.add('apagada');
    this.humo.classList.add('activo');
    Sonido.soplo();
    Sonido.campanita();

    if (this.esUltima()) { this.liberarDeseos(); return; }

    setTimeout(() => this.vela.classList.add('saliendo'), 1700);
    setTimeout(() => { this.i++; this.mostrar(); }, 2500);
  },

  // Tecla secreta: R dos veces desbloquea la vela 28 (sin sonido ni avisos)
  teclaR() {
    if (this.fase !== 'r') return;
    this.teclasR++;
    if (this.teclasR >= 2) {
      this.fase = 'lista';
      const [a, b] = this.textoUltima('lista');
      if (a || b) escribirMensaje(this.msg, a, b);
    }
  },

  // Los deseos salen de la mecha y se esfuman con el humo
  async liberarDeseos() {
    const [a, b] = this.textoUltima('deseos');
    escribirMensaje(this.msg, a, b);
    const medidor = document.querySelector('.medidor');
    medidor.style.visibility = 'hidden';
    this.nota.textContent = '';

    const r = this.llama.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.bottom - 6;

    let humoActivo = true;
    const generarHumo = () => {
      if (!humoActivo) return;
      this.bocanada(x0, y0);
      setTimeout(generarHumo, 140);
    };
    generarHumo();

    const intervalo = 1300, dur = 6200, espera = 1500;
    (CONFIG.deseos || []).forEach((txt, k) => setTimeout(() => this.deseoAlHumo(txt, x0, y0, k, dur), espera + k * intervalo));

    await esperar(espera + (CONFIG.deseos || []).length * intervalo + dur - 2000);
    humoActivo = false;
    await esperar(2500);

    this.pantalla.querySelectorAll('.al-humo').forEach(e => e.remove());
    medidor.style.visibility = '';
    this.activo = false;
    Musica.detener();
    this.alTerminar();
  },

  bocanada(x, y) {
    const s = document.createElement('span');
    s.className = 'al-humo';
    const tam = azar(10, 22);
    Object.assign(s.style, {
      position: 'fixed', left: (x - tam / 2) + 'px', top: (y - tam / 2) + 'px', width: tam + 'px', height: tam + 'px',
      borderRadius: '50%', background: 'rgba(225,225,240,.45)', filter: 'blur(3px)', pointerEvents: 'none',
    });
    this.pantalla.appendChild(s);
    const anim = s.animate([
      { transform: 'translate(0,0) scale(.6)', opacity: 0.8 },
      { transform: `translate(${azar(-45, 45)}px, -${azar(160, 280)}px) scale(4)`, opacity: 0 },
    ], { duration: azar(2200, 3400), easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = () => s.remove();
  },

  deseoAlHumo(txt, x, y, k, dur) {
    const el = document.createElement('div');
    el.className = 'al-humo cursiva';
    el.textContent = txt;
    const ancho = Math.min(460, innerWidth * 0.8);
    Object.assign(el.style, {
      position: 'fixed', left: x + 'px', top: (y - 40) + 'px', width: ancho + 'px', marginLeft: (-ancho / 2) + 'px',
      textAlign: 'center', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', lineHeight: '1.25', color: '#fff',
      textShadow: '0 0 16px rgba(255,255,255,.55)', pointerEvents: 'none', opacity: '0', zIndex: '5',
    });
    this.pantalla.appendChild(el);
    const lado = k % 2 ? 1 : -1;
    const dx = lado * azar(40, Math.min(240, innerWidth * 0.25));
    const h = Math.max(220, y - 30);
    const anim = el.animate([
      { transform: 'translate(0,0) scale(.5)', opacity: 0, filter: 'blur(8px)' },
      { transform: `translate(${dx * 0.35}px, ${-h * 0.3}px) scale(1)`, opacity: 1, filter: 'blur(0px)', offset: 0.22 },
      { transform: `translate(${dx * 0.7}px, ${-h * 0.55}px) scale(1.04)`, opacity: 1, filter: 'blur(0px)', offset: 0.62 },
      { transform: `translate(${dx}px, ${-h * 0.9}px) scale(1.35)`, opacity: 0, filter: 'blur(12px)' },
    ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = () => el.remove();
  },
};

// =====================================================
//  EL PASTEL: verde, decorado, velitas que se quitan, mordidas,
//  reparto en platitos y fuegos artificiales
// =====================================================
const Pastel = {
  W: 800,
  H: 480,
  activo: false,
  colores: ['#ff5fa2', '#5fc8ff', '#ffd45c', '#9b7bff', '#ffffff', '#ff8a5c', '#7be0a0'],

  async mostrar(alTerminar) {
    this.alTerminar = alTerminar;
    this.estilos();
    this.decorar();
    this.crearLienzos();
    try { await document.fonts.load('50px "Great Vibes"'); } catch (e) {}
    this.construirPastel();
    this.velas = this.crearVelas();
    this.volando = []; this.humos = []; this.migas = []; this.platos = [];
    this.cohetes = []; this.chispas = [];
    this.fase = 'velas';
    this.mordidas = 0;
    this.alfaPastel = 1;
    this.t = 0;
    this.msg = document.getElementById('mensaje-pastel');
    escribirMensaje(this.msg, '¡Ahora quita las velitas!', 'haz clic sobre cada una');
    this.ayuda();
    this.activo = true;
    this.ultimo = performance.now();
    this._b = this.bucle.bind(this);
    requestAnimationFrame(this._b);
  },

  // ---------- estilos y decoración ----------
  estilos() {
    if (document.getElementById('estilos-pastel')) return;
    const st = document.createElement('style');
    st.id = 'estilos-pastel';
    st.textContent = `
      #pantalla-pastel { gap: 12px; overflow: hidden; }
      #pantalla-pastel .deco { position: absolute; pointer-events: none; z-index: 0; }
      #pantalla-pastel > :not(.deco) { position: relative; z-index: 1; }
      #pastel { width: min(800px, 94vw, calc((100vh - 240px) * 800 / 480)); height: auto; margin-top: 50px; }
      #lienzo-pastel { width: 100%; height: auto; display: block; cursor: pointer; touch-action: manipulation; }
      #pantalla-pastel #btn-fuegos { position: absolute; right: 22px; bottom: 22px; z-index: 6; }
      #pantalla-pastel #fuegos-pastel { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 5; }
      #pantalla-pastel .mensaje { min-height: 2.6em; }
      .bandera { position: absolute; width: 30px; height: 40px; clip-path: polygon(0 0, 100% 0, 50% 100%); transform-origin: 50% 0; animation: ondear 2.4s ease-in-out infinite alternate; }
      @keyframes ondear { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
      .globo { width: 58px; height: 72px; border-radius: 50% 50% 48% 48% / 55% 55% 45% 45%; animation: flotar 4s ease-in-out infinite alternate; }
      .globo::before { content: ''; position: absolute; left: 50%; top: 100%; width: 1px; height: 120px; background: rgba(255,255,255,.35); }
      @keyframes flotar { from { transform: translateY(0) rotate(-4deg); } to { transform: translateY(-24px) rotate(4deg); } }
      .destello { color: #ffe9a8; animation: brillar 1.8s ease-in-out infinite; }
      @keyframes brillar { 0%, 100% { opacity: .15; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.15); } }
    `;
    document.head.appendChild(st);
  },

  decorar() {
    const p = document.getElementById('pantalla-pastel');
    if (p.querySelector('.deco')) return;
    const W = innerWidth;
    // cuerda de banderines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('deco');
    svg.setAttribute('width', W); svg.setAttribute('height', 140);
    svg.style.left = '0'; svg.style.top = '0';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M0 10 Q ${W / 2} 120 ${W} 10`);
    path.setAttribute('stroke', 'rgba(255,255,255,.55)'); path.setAttribute('stroke-width', '2'); path.setAttribute('fill', 'none');
    svg.appendChild(path);
    p.appendChild(svg);
    const cols = ['#2fae4f', '#ffd45c', '#7be0a0', '#ff8fb8', '#ffffff', '#1f8f4a'];
    const n = Math.max(10, Math.round(W / 55));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      const b = document.createElement('div');
      b.className = 'deco bandera';
      b.style.left = (u * W - 15) + 'px';
      b.style.top = (10 + 4 * u * (1 - u) * 55 - 2) + 'px';
      b.style.background = cols[k % cols.length];
      b.style.animationDelay = (-k * 0.3) + 's';
      p.appendChild(b);
    }
    // globos
    const globos = [
      ['3%', '30%', '#2fae4f'], ['9%', '52%', '#ffd45c'], ['4%', '68%', '#7be0a0'],
      ['r3%', '28%', '#7be0a0'], ['r9%', '50%', '#2fae4f'], ['r4%', '70%', '#ffd45c'],
    ];
    globos.forEach(([x, y, c], k) => {
      const g = document.createElement('div');
      g.className = 'deco globo';
      if (x.startsWith('r')) g.style.right = x.slice(1); else g.style.left = x;
      g.style.top = y;
      g.style.background = `radial-gradient(circle at 32% 28%, rgba(255,255,255,.75) 0 7%, transparent 8%), ${c}`;
      g.style.animationDelay = (-k * 0.7) + 's';
      p.appendChild(g);
    });
    // destellos
    for (let k = 0; k < 18; k++) {
      const s = document.createElement('div');
      s.className = 'deco destello';
      s.textContent = '✦';
      s.style.left = azar(2, 96) + '%';
      s.style.top = azar(12, 92) + '%';
      s.style.fontSize = azar(10, 22) + 'px';
      s.style.animationDelay = azar(0, 2) + 's';
      p.appendChild(s);
    }
  },

  crearLienzos() {
    const cont = document.getElementById('pastel');
    cont.innerHTML = '';
    this.lienzo = document.createElement('canvas');
    this.lienzo.id = 'lienzo-pastel';
    this.lienzo.width = this.W; this.lienzo.height = this.H;
    cont.appendChild(this.lienzo);
    this.ctx = this.lienzo.getContext('2d');
    this.cake = document.createElement('canvas');
    this.cake.width = this.W; this.cake.height = this.H;
    this.lienzo.addEventListener('pointerdown', e => this.clic(e));

    const p = document.getElementById('pantalla-pastel');
    if (!document.getElementById('ayuda-pastel')) {
      const a = document.createElement('p');
      a.id = 'ayuda-pastel';
      a.className = 'nota';
      document.getElementById('mensaje-pastel').after(a);
    }
    if (!document.getElementById('fuegos-pastel')) {
      this.fx = document.createElement('canvas');
      this.fx.id = 'fuegos-pastel';
      p.appendChild(this.fx);
      const ajustar = () => { this.fx.width = innerWidth; this.fx.height = innerHeight; };
      ajustar();
      addEventListener('resize', ajustar);
      const b = document.createElement('button');
      b.id = 'btn-fuegos';
      b.className = 'boton';
      b.textContent = '🎆 Fuegos artificiales';
      b.onclick = () => this.lanzarFuegos();
      p.appendChild(b);
    } else {
      this.fx = document.getElementById('fuegos-pastel');
    }
    this.fxc = this.fx.getContext('2d');
  },

  ayuda() {
    const a = document.getElementById('ayuda-pastel');
    if (!a) return;
    if (this.fase === 'velas') {
      const q = this.velas.filter(v => v.viva).length;
      a.textContent = `🕯️ Quedan ${q} velitas · haz clic en cada una para quitarla`;
    } else if (this.fase === 'morder') {
      a.textContent = `😋 Haz clic en el pastel para morderlo · Mordidas: ${this.mordidas} / 5`;
    } else {
      a.textContent = '';
    }
  },

  // ---------- dibujo del pastel (en un lienzo aparte para poder morderlo) ----------
  piso(c, cx, y1, y2, rx, ry, lado) {
    const g = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, lado[0]); g.addColorStop(0.45, lado[1]); g.addColorStop(1, lado[2]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx - rx, y1);
    c.lineTo(cx - rx, y2);
    c.ellipse(cx, y2, rx, ry, 0, Math.PI, 0, true);
    c.lineTo(cx + rx, y1);
    c.ellipse(cx, y1, rx, ry, 0, 0, Math.PI, true);
    c.closePath();
    c.fill();
  },

  glaseado(c, cx, y1, rx, ry, color, semilla) {
    c.fillStyle = color;
    c.beginPath(); c.ellipse(cx, y1, rx + 3, ry + 3, 0, 0, Math.PI * 2); c.fill();
    const n = Math.round(rx / 9);
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (0.04 + 0.92 * k / (n - 1));
      const x = cx + Math.cos(a) * (rx + 1), y = y1 + Math.sin(a) * (ry + 1);
      const largo = 6 + ((k * 37 + semilla) % 5) * 5;
      c.beginPath();
      c.moveTo(x - 6, y - 3);
      c.lineTo(x - 6, y + largo);
      c.arc(x, y + largo, 6, Math.PI, 0, true);
      c.lineTo(x + 6, y - 3);
      c.closePath();
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.ellipse(cx - rx * 0.25, y1 - ry * 0.25, rx * 0.45, ry * 0.35, 0, 0, Math.PI * 2); c.fill();
  },

  perlas(c, cx, y, rx, ry, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (k / (n - 1));
      const x = cx + Math.cos(a) * rx, yy = y + Math.sin(a) * ry;
      c.fillStyle = '#fffbe6';
      c.beginPath(); c.arc(x, yy, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)';
      c.beginPath(); c.arc(x - 2, yy - 2, 2, 0, Math.PI * 2); c.fill();
    }
  },

  texto(c, txt, x, y, tam, relleno) {
    c.font = `${tam}px "Great Vibes", cursive`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.strokeStyle = '#0d4f26';
    c.lineWidth = 5;
    c.strokeText(txt, x, y);
    c.fillStyle = relleno;
    c.fillText(txt, x, y);
  },

  construirPastel() {
    const c = this.cake.getContext('2d');
    const cx = 400;
    c.clearRect(0, 0, this.W, this.H);
    // piso de abajo
    this.piso(c, cx, 290, 410, 190, 22, ['#136b34', '#3fcf78', '#136b34']);
    this.perlas(c, cx, 410, 186, 20, 24);
    this.glaseado(c, cx, 290, 190, 22, '#a8f0c6', 3);
    this.texto(c, 'Feliz cumpleaños', cx, 372, 46, '#ffffff');
    c.fillStyle = '#ffd45c';
    c.font = '18px serif';
    c.fillText('✦', cx - 168, 372); c.fillText('✦', cx + 168, 372);
    // piso de arriba
    this.piso(c, cx, 205, 290, 135, 18, ['#1a8a45', '#5fe096', '#1a8a45']);
    this.glaseado(c, cx, 205, 135, 18, '#c4f7da', 7);
    this.texto(c, (CONFIG.nombre || 'Alejandro'), cx, 270, 52, '#ffd45c');
    // rosetas de crema y perlitas doradas entre los pisos
    for (let k = 0; k < 11; k++) {
      const a = Math.PI * (0.06 + 0.88 * k / 10);
      const x = cx + Math.cos(a) * 163, y = 291 + Math.sin(a) * 19;
      c.fillStyle = '#e3ffee';
      c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#7fd6a3'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, 5, 0.3, Math.PI * 1.7); c.stroke();
      if (k < 10) {
        const b = Math.PI * (0.06 + 0.88 * (k + 0.5) / 10);
        c.fillStyle = '#ffd45c';
        c.beginPath(); c.arc(cx + Math.cos(b) * 163, 291 + Math.sin(b) * 19, 3, 0, Math.PI * 2); c.fill();
      }
    }
  },

  crearVelas() {
    const v = [];
    for (let k = 0; k < 28; k++) {
      const fila = k < 14 ? 0 : 1, idx = k % 14;
      v.push({
        x: 400 - 115 + idx * 17.7 + (fila ? 6 : 0),
        y: 205 + (fila ? 8 : -6),
        color: this.colores[k % this.colores.length],
        viva: true,
        humo: azar(0, 2),
      });
    }
    return v;
  },

  dibujarVela(c, x, y, color, alfa = 1, rot = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = alfa;
    c.fillStyle = '#fff';
    c.fillRect(-4, -38, 8, 38);
    c.save();
    c.beginPath(); c.rect(-4, -38, 8, 38); c.clip();
    c.strokeStyle = color; c.lineWidth = 3;
    for (let s = -48; s < 12; s += 7) { c.beginPath(); c.moveTo(-6, s); c.lineTo(6, s - 8); c.stroke(); }
    c.restore();
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(1, -38, 3, 38);
    c.strokeStyle = '#333'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -38); c.lineTo(0, -44); c.stroke();
    c.restore();
  },

  dibujarBase(c) {
    // resplandor
    c.save();
    c.translate(400, 290);
    c.scale(2, 1);
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 185);
    g.addColorStop(0, 'rgba(120,255,170,.24)'); g.addColorStop(1, 'rgba(120,255,170,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 185, 0, Math.PI * 2); c.fill();
    c.restore();
    // base dorada
    c.fillStyle = '#b8892a';
    c.beginPath(); c.ellipse(400, 466, 85, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9a93a';
    c.beginPath(); c.moveTo(382, 432); c.lineTo(418, 432); c.lineTo(432, 464); c.lineTo(368, 464); c.closePath(); c.fill();
    const gp = c.createLinearGradient(175, 0, 625, 0);
    gp.addColorStop(0, '#b8892a'); gp.addColorStop(0.5, '#ffe08a'); gp.addColorStop(1, '#b8892a');
    c.fillStyle = gp;
    c.beginPath(); c.ellipse(400, 428, 225, 28, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.beginPath(); c.ellipse(400, 424, 205, 20, 0, 0, Math.PI * 2); c.fill();
  },

  // ---------- interacción ----------
  coords(e) {
    const r = this.lienzo.getBoundingClientRect();
    return { x: (e.clientX - r.left) * this.W / r.width, y: (e.clientY - r.top) * this.H / r.height };
  },

  clic(e) {
    const { x, y } = this.coords(e);
    if (this.fase === 'velas') {
      const orden = this.velas.filter(v => v.viva).sort((a, b) => b.y - a.y);
      const v = orden.find(v => Math.abs(x - v.x) < 10 && y > v.y - 50 && y < v.y + 6);
      if (!v) return;
      v.viva = false;
      this.volando.push({ x: v.x, y: v.y, color: v.color, vx: azar(-140, 140), vy: azar(-420, -300), rot: 0, vr: azar(-9, 9), t: 0 });
      Sonido.tono(620, 0.08, 'triangle', 0.12, 1250);
      this.ayuda();
      if (this.velas.every(v => !v.viva)) {
        this.fase = 'esperando';
        this.ayuda();
        setTimeout(() => this.empezarMordidas(), 700);
      }
    } else if (this.fase === 'morder') {
      const a = this.cake.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3];
      if (a < 30) return;
      // la mordida se hace en la orilla más cercana del pastel, como una mordida de verdad
      const fila = this.cake.getContext('2d').getImageData(0, Math.floor(y), this.W, 1).data;
      let izq = Math.floor(x), der = Math.floor(x);
      while (izq > 0 && fila[(izq - 1) * 4 + 3] > 30) izq--;
      while (der < this.W - 1 && fila[(der + 1) * 4 + 3] > 30) der++;
      const bx = (x - izq < der - x) ? izq + 8 : der - 8;
      this.morder(bx, y);
    }
  },

  empezarMordidas() {
    this.fase = 'morder';
    this.ayuda();
    escribirMensaje(this.msg, '¡Que lo muerda!', '¡Que lo muerda! 🎂');
    // palmas
    [0, 0.3, 0.6, 1.2, 1.5, 1.8].forEach(t => Sonido.ruido(0.06, 0.35, 3200, t));
  },

  morder(x, y) {
    const c = this.cake.getContext('2d');
    const r = 30;
    const dientes = [];
    for (let k = 0; k < 7; k++) {
      const a = azar(0, Math.PI * 2);
      dientes.push([x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95, azar(8, 13)]);
    }
    c.save();
    // bizcocho que queda a la vista alrededor de la mordida
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = '#fff1c9';
    c.beginPath();
    c.arc(x, y, r + 9, 0, Math.PI * 2);
    for (const [dx, dy, dr] of dientes) { c.moveTo(dx + dr + 8, dy); c.arc(dx, dy, dr + 8, 0, Math.PI * 2); }
    c.fill();
    c.fillStyle = '#e8c977';
    for (let k = 0; k < 16; k++) {
      const a = azar(0, Math.PI * 2), d = azar(r, r + 8);
      c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2, 2);
    }
    // la mordida
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    for (const [dx, dy, dr] of dientes) { c.moveTo(dx + dr, dy); c.arc(dx, dy, dr, 0, Math.PI * 2); }
    c.fill();
    c.restore();

    for (let k = 0; k < 16; k++) {
      this.migas.push({ x, y, vx: azar(-160, 160), vy: azar(-260, -60), t: 0, color: Math.random() < 0.5 ? '#fff1c9' : '#3fcf78' });
    }
    Sonido.tono(170, 0.14, 'square', 0.1, 110);
    Sonido.ruido(0.1, 0.2, 900, 0.03);
    this.mordidas++;
    this.ayuda();
    if (this.mordidas >= 5) {
      this.fase = 'esperando';
      this.ayuda();
      setTimeout(() => this.repartir(), 900);
    }
  },

  repartir() {
    this.fase = 'repartir';
    escribirMensaje(this.msg, '¡A repartir!', 'un pedacito para cada quien 🍰');
    Sonido.campanita();
    const r = this.lienzo.getBoundingClientRect();
    const esc = r.width / this.W;
    const x0 = r.left + 400 * esc, y0 = r.top + 320 * esc;
    for (let k = 0; k < 8; k++) {
      const lado = k % 2 ? 1 : -1;
      this.platos.push({
        retraso: 0.6 + k * 0.45,
        xs: x0 + (k - 3.5) * 30 * esc, ys: y0 + azar(-20, 20) * esc,
        x1: lado < 0 ? -140 : innerWidth + 140,
        y1: innerHeight * azar(0.25, 0.85),
        esc: Math.max(0.6, esc * 1.2),
        t: 0,
        sonó: false,
      });
    }
    const total = 0.6 + 8 * 0.45 + 2;
    setTimeout(() => this.despuesDeRepartir(), total * 1000);
  },

  async despuesDeRepartir() {
    this.fase = 'final';
    this.platos = [];
    const lista = CONFIG.pastel;
    for (let k = 0; k < lista.length; k++) {
      await escribirMensaje(this.msg, lista[k][0], lista[k][1], 45);
      await esperar(k === lista.length - 1 ? 600 : 2700);
    }
    this.alTerminar();
  },

  // ---------- fuegos artificiales ----------
  lanzarFuegos() {
    Sonido.click();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        this.cohetes.push({
          x: innerWidth * azar(0.12, 0.88), y: innerHeight + 10,
          vy: -azar(innerHeight * 0.9, innerHeight * 1.2),
          meta: innerHeight * azar(0.12, 0.45),
          tono: Math.floor(azar(0, 360)),
        });
        Sonido.tono(500, 0.5, 'sine', 0.04, 1400);
      }, k * 260);
    }
  },

  explotar(c) {
    const verde = Math.random() < 0.4;
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2, v = azar(60, 280);
      this.chispas.push({
        x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: azar(1.1, 1.8),
        color: verde ? `hsl(${azar(110, 150)}, 90%, ${azar(55, 75)}%)` : `hsl(${c.tono + azar(-20, 20)}, 100%, ${azar(55, 72)}%)`,
      });
    }
    Sonido.ruido(0.5, 0.25, 1800);
    Sonido.tono(110, 0.3, 'sine', 0.15, 50);
  },

  // ---------- bucle ----------
  bucle(ahora) {
    if (!this.activo) return;
    const pant = document.getElementById('pantalla-pastel');
    if (!pant.classList.contains('activa')) {
      this.activo = false;
      this.fxc.clearRect(0, 0, this.fx.width, this.fx.height);
      return;
    }
    const dt = Math.min(0.05, (ahora - this.ultimo) / 1000);
    this.ultimo = ahora;
    this.t += dt;
    this.actualizar(dt);
    this.dibujar();
    requestAnimationFrame(this._b);
  },

  actualizar(dt) {
    for (const v of this.velas) {
      if (!v.viva) continue;
      v.humo -= dt;
      if (v.humo <= 0) {
        v.humo = azar(0.8, 2.4);
        this.humos.push({ x: v.x, y: v.y - 46, vx: azar(-8, 8), vy: azar(-35, -20), t: 0 });
      }
    }
    for (const h of this.humos) { h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; }
    this.humos = this.humos.filter(h => h.t < 2.2);
    for (const o of this.volando) { o.t += dt; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt; }
    this.volando = this.volando.filter(o => o.t < 1.2);
    for (const m of this.migas) { m.t += dt; m.vy += 900 * dt; m.x += m.vx * dt; m.y += m.vy * dt; }
    this.migas = this.migas.filter(m => m.t < 1);
    if (this.fase === 'repartir' || this.fase === 'final') this.alfaPastel = Math.max(0, this.alfaPastel - dt * 1.2);
    for (const p of this.platos) {
      p.t += dt;
      if (!p.sonó && p.t > p.retraso) { p.sonó = true; Sonido.tono(880, 0.1, 'triangle', 0.08, 1320); }
    }
    for (const c of this.cohetes) {
      c.y += c.vy * dt;
      c.vy += 300 * dt;
      if (Math.random() < 0.8) this.chispas.push({ x: c.x + azar(-2, 2), y: c.y, vx: azar(-20, 20), vy: azar(20, 60), t: 0, vida: 0.4, color: '#ffe9a8' });
      if (c.y <= c.meta || c.vy > -40) { c.fuera = true; this.explotar(c); }
    }
    this.cohetes = this.cohetes.filter(c => !c.fuera);
    for (const s of this.chispas) { s.t += dt; s.vx *= Math.pow(0.35, dt); s.vy = s.vy * Math.pow(0.35, dt) + 120 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.chispas = this.chispas.filter(s => s.t < s.vida);
  },

  dibujarPlato(c, x, y, s, rot) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.rotate(rot);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(0, 12, 50, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(0, 5, 48, 14, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d8d8e8'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 5, 35, 9, 0, 0, Math.PI * 2); c.stroke();
    // rebanada de pastel
    c.fillStyle = '#136b34';
    c.beginPath(); c.moveTo(22, 6); c.lineTo(32, 0); c.lineTo(32, -30); c.lineTo(22, -24); c.closePath(); c.fill();
    c.fillStyle = '#fff1c9';
    c.fillRect(-28, -24, 50, 30);
    c.fillStyle = '#3fcf78';
    c.fillRect(-28, -6, 50, 4);
    c.fillRect(-28, -16, 50, 4);
    c.fillStyle = '#a8f0c6';
    c.beginPath(); c.moveTo(-30, -24); c.lineTo(22, -24); c.lineTo(32, -30); c.lineTo(-20, -30); c.closePath(); c.fill();
    c.beginPath(); c.arc(-14, -24, 4, 0, Math.PI); c.arc(4, -24, 3, 0, Math.PI); c.fill();
    c.fillStyle = '#ffd45c';
    c.beginPath(); c.arc(4, -32, 3.5, 0, Math.PI * 2); c.fill();
    c.restore();
  },

  dibujar() {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    this.dibujarBase(c);
    if (this.alfaPastel > 0) {
      c.globalAlpha = this.alfaPastel;
      c.drawImage(this.cake, 0, 0);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = '#fff1c9';
      [[-60, 418], [-20, 425], [30, 420], [70, 426], [5, 430]].forEach(([dx, y]) => c.fillRect(400 + dx, y, 4, 3));
    }
    for (const v of this.velas) if (v.viva) this.dibujarVela(c, v.x, v.y, v.color);
    for (const o of this.volando) this.dibujarVela(c, o.x, o.y, o.color, Math.max(0, 1 - o.t / 1.2), o.rot);
    for (const h of this.humos) {
      c.fillStyle = `rgba(230,230,245,${0.5 * (1 - h.t / 2.2)})`;
      c.beginPath(); c.arc(h.x, h.y, 3 + h.t * 5, 0, Math.PI * 2); c.fill();
    }
    for (const m of this.migas) { c.fillStyle = m.color; c.fillRect(m.x, m.y, 4, 4); }

    // capa de pantalla completa: platos y fuegos artificiales
    const f = this.fxc;
    f.clearRect(0, 0, this.fx.width, this.fx.height);
    for (const p of this.platos) {
      const tl = p.t - p.retraso;
      if (tl < 0 || tl > 2) continue;
      let x, y, s;
      if (tl < 0.4) {
        s = p.esc * (tl / 0.4);
        x = p.xs; y = p.ys;
      } else {
        const u = Math.min(1, (tl - 0.4) / 1.5);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        s = p.esc;
        x = p.xs + (p.x1 - p.xs) * e;
        y = p.ys + (p.y1 - p.ys) * e - Math.sin(e * Math.PI) * 70;
      }
      this.dibujarPlato(f, x, y, s, Math.sin(this.t * 6 + p.retraso) * 0.05);
    }
    f.globalCompositeOperation = 'lighter';
    for (const s of this.chispas) {
      f.globalAlpha = Math.max(0, 1 - s.t / s.vida);
      f.fillStyle = s.color;
      f.beginPath(); f.arc(s.x, s.y, 2.2, 0, Math.PI * 2); f.fill();
    }
    f.globalAlpha = 1;
    f.globalCompositeOperation = 'source-over';
    for (const k of this.cohetes) {
      f.fillStyle = '#fff6d0';
      f.beginPath(); f.arc(k.x, k.y, 3, 0, Math.PI * 2); f.fill();
    }
  },
};
