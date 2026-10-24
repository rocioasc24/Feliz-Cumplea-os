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
      #pantalla-pastel { gap: 10px; overflow: hidden;
        background: radial-gradient(ellipse 60% 55% at 50% 48%, rgba(80,200,140,.16), transparent 70%),
                    radial-gradient(ellipse at 50% 120%, #0d3b2a 0%, transparent 55%); }
      #pantalla-pastel .deco { position: absolute; pointer-events: none; z-index: 0; }
      #pantalla-pastel > :not(.deco) { position: relative; z-index: 1; }
      #pastel { width: min(1000px, 96vw, calc((100vh - 270px) * 800 / 480)); height: auto; margin-top: 64px; }
      #lienzo-pastel { width: 100%; height: auto; display: block; cursor: pointer; touch-action: manipulation; }
      #pantalla-pastel #btn-fuegos { position: absolute; right: 22px; bottom: 22px; z-index: 6; }
      #pantalla-pastel #fuegos-pastel { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 5; }
      #pantalla-pastel .mensaje { min-height: 2.6em; font-size: clamp(1.6rem, 3.6vw, 2.7rem); }

      .bokeh { border-radius: 50%; filter: blur(6px); animation: bokeh 9s ease-in-out infinite alternate; }
      @keyframes bokeh { from { transform: translate(0, 0); opacity: .25; } to { transform: translate(18px, -26px); opacity: .6; } }

      .foco { width: 9px; height: 13px; border-radius: 50% 50% 45% 45%; animation: titila 1.6s ease-in-out infinite alternate; }
      .foco::before { content: ''; position: absolute; left: 2px; top: -4px; width: 5px; height: 5px; background: #3b4a3f; border-radius: 1px; }
      @keyframes titila { from { opacity: .45; } to { opacity: 1; } }

      .letra { width: 46px; height: 56px; transform-origin: 50% 0; animation: ondear 3s ease-in-out infinite alternate;
               clip-path: polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%);
               display: flex; align-items: flex-start; justify-content: center; padding-top: 9px;
               font-family: 'Quicksand', sans-serif; font-weight: 700; font-size: 26px; line-height: 1; color: #fff;
               text-shadow: 0 1px 2px rgba(0,0,0,.35); }
      .letra::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: rgba(0,0,0,.18); }
      @keyframes ondear { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }

      .globo-svg { animation: flotar 5s ease-in-out infinite alternate; transform-origin: 50% 100%; }
      @keyframes flotar { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-18px) rotate(3deg); } }

      .destello { color: #ffe9a8; animation: brillar 2.2s ease-in-out infinite; }
      @keyframes brillar { 0%, 100% { opacity: .1; transform: scale(.6) rotate(0deg); } 50% { opacity: .95; transform: scale(1.1) rotate(45deg); } }

      .confeti-piso { width: 7px; height: 12px; border-radius: 2px; opacity: .8; }
    `;
    document.head.appendChild(st);
  },

  globoSVG(color, claro, oscuro, ancho) {
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    return `<svg width="${ancho}" height="${ancho * 2.5}" viewBox="0 0 60 150">
      <defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="${claro}"/><stop offset="45%" stop-color="${color}"/><stop offset="100%" stop-color="${oscuro}"/>
      </radialGradient></defs>
      <path d="M30 76 C 33 92, 22 104, 30 118 S 28 140, 32 150" stroke="rgba(255,255,255,.45)" stroke-width="1.2" fill="none"/>
      <path d="M30 2 C 8 2, 2 22, 2 34 C 2 54, 20 70, 30 74 C 40 70, 58 54, 58 34 C 58 22, 52 2, 30 2 Z" fill="url(#${id})"/>
      <path d="M26 79 L30 73 L34 79 Z" fill="${oscuro}"/>
      <ellipse cx="19" cy="20" rx="5" ry="9" fill="rgba(255,255,255,.55)" transform="rotate(25 19 20)"/>
    </svg>`;
  },

  decorar() {
    const p = document.getElementById('pantalla-pastel');
    p.querySelectorAll('.deco').forEach(e => e.remove());
    const W = innerWidth, H = innerHeight;
    const agregar = (el, clase) => { el.classList.add('deco'); if (clase) el.classList.add(clase); p.appendChild(el); return el; };

    // luces de fondo difuminadas
    const tonosBokeh = ['rgba(255,214,120,.5)', 'rgba(120,230,170,.45)', 'rgba(255,160,200,.35)', 'rgba(255,255,255,.3)'];
    for (let k = 0; k < 22; k++) {
      const b = agregar(document.createElement('div'), 'bokeh');
      const s = azar(18, 70);
      Object.assign(b.style, { width: s + 'px', height: s + 'px', left: azar(0, 100) + '%', top: azar(8, 95) + '%',
        background: tonosBokeh[k % tonosBokeh.length], animationDelay: (-azar(0, 9)) + 's' });
    }

    // guirnalda de focos
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', 130);
    svg.style.left = '0'; svg.style.top = '0';
    const cuerda = (y0, sag) => {
      const pa = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pa.setAttribute('d', `M-10 ${y0} Q ${W / 2} ${y0 + sag * 2} ${W + 10} ${y0}`);
      pa.setAttribute('stroke', '#2c3a30'); pa.setAttribute('stroke-width', '2'); pa.setAttribute('fill', 'none');
      svg.appendChild(pa);
    };
    cuerda(6, 34);
    agregar(svg);
    const focos = ['#fff3c4', '#ffd45c', '#9ff0c0', '#ffb3cf'];
    const nf = Math.round(W / 46);
    for (let k = 0; k < nf; k++) {
      const u = (k + 0.5) / nf;
      const x = -10 + u * (W + 20), y = 6 + 4 * u * (1 - u) * 34;
      const f = agregar(document.createElement('div'), 'foco');
      const col = focos[k % focos.length];
      Object.assign(f.style, { left: (x - 4.5) + 'px', top: (y + 4) + 'px', background: col,
        boxShadow: `0 0 10px 3px ${col}, 0 0 22px 6px ${col}55`, animationDelay: (-(k % 5) * 0.37) + 's' });
    }

    // banderín con letras: FELIZ CUMPLE
    const palabra = 'FELIZ CUMPLE';
    const colsB = ['#1f8f4a', '#2fae5f', '#d9a93a', '#1f8f4a', '#2fae5f', '#d9a93a'];
    const ancho = Math.min(46, (W * 0.8) / palabra.length);
    const total = palabra.length * (ancho + 4);
    const x0 = W / 2 - total / 2;
    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg2.setAttribute('width', W); svg2.setAttribute('height', 120);
    svg2.style.left = '0'; svg2.style.top = '0';
    const pa2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pa2.setAttribute('d', `M${x0 - 30} 34 Q ${W / 2} 74 ${x0 + total + 30} 34`);
    pa2.setAttribute('stroke', 'rgba(255,240,200,.7)'); pa2.setAttribute('stroke-width', '1.5'); pa2.setAttribute('fill', 'none');
    svg2.appendChild(pa2);
    agregar(svg2);
    [...palabra].forEach((ch, k) => {
      if (ch === ' ') return;
      const xc = x0 + k * (ancho + 4) + ancho / 2;
      const u = (xc - (x0 - 30)) / (total + 60);
      const y = 34 + 4 * u * (1 - u) * 20;
      const l = agregar(document.createElement('div'), 'letra');
      const col = colsB[k % colsB.length];
      Object.assign(l.style, { left: (xc - ancho / 2) + 'px', top: (y - 1) + 'px', width: ancho + 'px', height: (ancho * 1.22) + 'px',
        fontSize: (ancho * 0.5) + 'px', background: `linear-gradient(160deg, ${col}, ${col}cc)`, animationDelay: (-k * 0.25) + 's' });
      l.textContent = ch;
    });

    // racimos de globos en las esquinas
    const paleta = [
      ['#2fae5f', '#a8f0c6', '#0f5c2c'], ['#d9a93a', '#fff1b0', '#8a6514'], ['#f2f2f2', '#ffffff', '#b9c2bd'],
      ['#7be0a0', '#e0ffe9', '#2f8f57'], ['#1f8f4a', '#7fe0a8', '#0b4022'],
    ];
    const racimo = (lado) => {
      const pos = [[0, 30, 64], [52, 0, 70], [96, 46, 58], [30, 92, 54], [78, 110, 50]];
      pos.forEach(([dx, dy, w], k) => {
        const [c1, c2, c3] = paleta[(k + (lado === 'der' ? 2 : 0)) % paleta.length];
        const g = agregar(document.createElement('div'), 'globo-svg');
        g.innerHTML = this.globoSVG(c1, c2, c3, w);
        const x = W < 700 ? dx * 0.6 : dx;
        if (lado === 'izq') g.style.left = (14 + x) + 'px'; else g.style.right = (14 + x) + 'px';
        g.style.top = (70 + dy) + 'px';
        g.style.animationDelay = (-k * 0.9) + 's';
        if (W < 700) g.style.transform = 'scale(.7)';
      });
    };
    racimo('izq'); racimo('der');

    // destellos
    for (let k = 0; k < 16; k++) {
      const s = agregar(document.createElement('div'), 'destello');
      s.textContent = '✦';
      Object.assign(s.style, { left: azar(4, 96) + '%', top: azar(20, 90) + '%', fontSize: azar(10, 20) + 'px', animationDelay: azar(0, 2.2) + 's' });
    }

    // confeti en el suelo
    const colsC = ['#ffd45c', '#2fae5f', '#a8f0c6', '#ff8fb8', '#ffffff'];
    for (let k = 0; k < 40; k++) {
      const c = agregar(document.createElement('div'), 'confeti-piso');
      Object.assign(c.style, { left: azar(0, 100) + '%', top: azar(H - 70, H - 8) + 'px', background: colsC[k % colsC.length],
        transform: `rotate(${azar(0, 180)}deg)`, opacity: azar(0.35, 0.8) });
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
  azarFijo(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); },

  ladoPiso(c, cx, y1, y2, rx, ry, oscuro, medio, claro) {
    c.save();
    c.beginPath();
    c.moveTo(cx - rx, y1);
    c.lineTo(cx - rx, y2);
    c.ellipse(cx, y2, rx, ry, 0, Math.PI, 0, true);
    c.lineTo(cx + rx, y1);
    c.ellipse(cx, y1, rx, ry, 0, 0, Math.PI, true);
    c.closePath();
    const g = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, oscuro); g.addColorStop(0.22, medio); g.addColorStop(0.4, claro);
    g.addColorStop(0.72, medio); g.addColorStop(1, oscuro);
    c.fillStyle = g;
    c.fill();
    c.clip();
    const v = c.createLinearGradient(0, y1, 0, y2 + ry);
    v.addColorStop(0, 'rgba(255,255,255,.06)'); v.addColorStop(1, 'rgba(0,30,10,.3)');
    c.fillStyle = v;
    c.fillRect(cx - rx, y1 - ry, rx * 2, y2 - y1 + ry * 2);
    c.restore();
  },

  cubierta(c, cx, y1, rx, ry, claro, medio, semilla, maxGota) {
    const n = Math.round(rx / 8.5);
    // gotas que escurren
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (0.02 + 0.96 * k / (n - 1));
      const x = cx + Math.cos(a) * rx, y = y1 + Math.sin(a) * ry;
      const largo = (5 + this.azarFijo(k + semilla) * maxGota) * (0.35 + 0.65 * Math.sin(a));
      const w = 5 + this.azarFijo(k * 3 + semilla) * 2.5;
      c.fillStyle = medio;
      c.beginPath();
      c.moveTo(x - w - 2, y - 3);
      c.quadraticCurveTo(x - w, y + 2, x - w, y + largo * 0.6);
      c.lineTo(x - w, y + largo);
      c.arc(x, y + largo, w, Math.PI, 0, true);
      c.lineTo(x + w, y + largo * 0.6);
      c.quadraticCurveTo(x + w, y + 2, x + w + 2, y - 3);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.fillRect(x - w + 2, y + 3, 1.6, Math.max(0, largo - 4));
    }
    // grosor del glaseado en la orilla
    c.fillStyle = medio;
    c.beginPath(); c.ellipse(cx, y1 + 4, rx + 1, ry + 1, 0, 0, Math.PI * 2); c.fill();
    // tapa
    const g = c.createRadialGradient(cx - rx * 0.35, y1 - ry * 0.4, 4, cx, y1, rx * 1.1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, claro); g.addColorStop(1, medio);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(cx, y1, rx + 2, ry + 2, 0, 0, Math.PI * 2); c.fill();
  },

  conchas(c, cx, y, rx, ry, n, color, sombra) {
    const lista = [];
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (k / (n - 1));
      lista.push([cx + Math.cos(a) * rx, y + Math.sin(a) * ry, a]);
    }
    lista.sort((p, q) => p[1] - q[1]);
    for (const [x, yy, a] of lista) {
      c.save();
      c.translate(x, yy);
      c.rotate((a - Math.PI / 2) * 0.35);
      c.fillStyle = sombra;
      c.beginPath(); c.ellipse(1, 2, 9, 6.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, 0, 8.5, 6, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = sombra; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-5, -2); c.quadraticCurveTo(0, 3, 5, -2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.beginPath(); c.ellipse(-2.5, -2.5, 2.5, 1.5, -0.4, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  },

  liston(c, cx, ya, yb, rx, ry) {
    c.save();
    c.beginPath();
    c.moveTo(cx - rx - 0.5, ya);
    c.ellipse(cx, ya, rx + 0.5, ry, 0, Math.PI, 0, true);
    c.lineTo(cx + rx + 0.5, yb);
    c.ellipse(cx, yb, rx + 0.5, ry, 0, 0, Math.PI, false);
    c.closePath();
    const g = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, '#6e4c0c'); g.addColorStop(0.25, '#d9a93a'); g.addColorStop(0.42, '#fff1b0');
    g.addColorStop(0.62, '#e2b54a'); g.addColorStop(1, '#6e4c0c');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(110,76,12,.7)'; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(cx, ya + 1, rx, ry, 0, 0.05, Math.PI - 0.05); c.stroke();
    c.beginPath(); c.ellipse(cx, yb - 1, rx, ry, 0, 0.05, Math.PI - 0.05); c.stroke();
    c.restore();
    // broche al frente
    const by = (ya + yb) / 2 + ry;
    c.fillStyle = '#8a6514';
    c.beginPath(); c.arc(cx, by, 11, 0, Math.PI * 2); c.fill();
    const gb = c.createRadialGradient(cx - 3, by - 3, 1, cx, by, 10);
    gb.addColorStop(0, '#fff6c8'); gb.addColorStop(1, '#d9a93a');
    c.fillStyle = gb;
    c.beginPath(); c.arc(cx, by, 9.5, 0, Math.PI * 2); c.fill();
    const ge = c.createRadialGradient(cx - 1.5, by - 1.5, 0.5, cx, by, 5.5);
    ge.addColorStop(0, '#b8ffd6'); ge.addColorStop(1, '#0f7a3c');
    c.fillStyle = ge;
    c.beginPath(); c.arc(cx, by, 5.5, 0, Math.PI * 2); c.fill();
  },

  florecita(c, x, y, r, color, centro) {
    c.fillStyle = 'rgba(0,40,20,.25)';
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5 - Math.PI / 2;
      c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.6 + 1, y + Math.sin(a) * r * 0.6 + 1.5, r * 0.55, r * 0.42, a, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5 - Math.PI / 2;
      c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.42, a, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = centro;
    c.beginPath(); c.arc(x, y, r * 0.3, 0, Math.PI * 2); c.fill();
  },

  texto(c, txt, x, y, tam, dorado) {
    c.save();
    c.font = `${tam}px "Great Vibes", cursive`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,30,12,.55)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    if (dorado) {
      const g = c.createLinearGradient(0, y - tam / 2, 0, y + tam / 2);
      g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#ffd45c'); g.addColorStop(1, '#b8862a');
      c.fillStyle = g;
    } else {
      c.fillStyle = '#ffffff';
    }
    c.fillText(txt, x, y);
    c.shadowColor = 'transparent';
    c.lineWidth = 0.8;
    c.strokeStyle = dorado ? 'rgba(110,76,12,.6)' : 'rgba(255,255,255,.4)';
    c.strokeText(txt, x, y);
    c.restore();
  },

  construirPastel() {
    const c = this.cake.getContext('2d');
    const cx = 400;
    c.clearRect(0, 0, this.W, this.H);

    // ----- piso de abajo -----
    this.ladoPiso(c, cx, 270, 400, 185, 26, '#0b4f26', '#1f9a52', '#4fd88c');
    this.liston(c, cx, 362, 380, 185, 26);
    this.conchas(c, cx, 401, 186, 26, 30, '#c9f7dc', '#6cc596');
    this.texto(c, 'Feliz cumpleaños', cx, 344, 44, false);
    this.florecita(c, cx - 156, 336, 9, '#ffffff', '#ffd45c');
    this.florecita(c, cx - 166, 358, 6, '#fff6c8', '#d9a93a');
    this.florecita(c, cx + 156, 336, 9, '#ffffff', '#ffd45c');
    this.florecita(c, cx + 166, 358, 6, '#fff6c8', '#d9a93a');
    this.cubierta(c, cx, 270, 185, 26, '#d9fbe7', '#9fe8bf', 3, 24);

    // ----- piso de arriba -----
    this.ladoPiso(c, cx, 178, 270, 132, 19, '#0f5c2c', '#2fae5f', '#6ee6a2');
    this.conchas(c, cx, 271, 133, 19, 22, '#e3ffee', '#7fd6a3');
    // hojitas de oro
    c.fillStyle = '#e8c45a';
    for (let k = 0; k < 8; k++) {
      const lado = k % 2 ? 1 : -1;
      const x = cx + lado * (102 + this.azarFijo(k + 40) * 20);
      const y = 212 + this.azarFijo(k + 70) * 60;
      c.save(); c.translate(x, y); c.rotate(this.azarFijo(k + 9) * 3);
      c.beginPath(); c.moveTo(-3, -1); c.lineTo(1, -3); c.lineTo(3, 1); c.lineTo(-1, 3); c.closePath(); c.fill();
      c.restore();
    }
    this.texto(c, (CONFIG.nombre || 'Alejandro'), cx, 244, 50, true);
    this.cubierta(c, cx, 178, 132, 19, '#e8fff1', '#b4f0cf', 9, 18);
  },

  crearVelas() {
    const v = [];
    for (let k = 0; k < 28; k++) {
      const fila = k < 14 ? 0 : 1, idx = k % 14;
      v.push({
        x: 400 - 112 + idx * 17.2 + (fila ? 6 : 0),
        y: 178 + (fila ? 8 : -6),
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
    c.fillStyle = 'rgba(0,40,20,.25)';
    c.beginPath(); c.ellipse(1, 0, 6, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fffdf6';
    c.fillRect(-3.5, -40, 7, 40);
    c.save();
    c.beginPath(); c.rect(-3.5, -40, 7, 40); c.clip();
    c.strokeStyle = color; c.lineWidth = 2.6;
    for (let s = -50; s < 12; s += 7) { c.beginPath(); c.moveTo(-6, s); c.lineTo(6, s - 7); c.stroke(); }
    const g = c.createLinearGradient(-3.5, 0, 3.5, 0);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
    c.fillStyle = g; c.fillRect(-3.5, -40, 7, 40);
    c.restore();
    c.fillStyle = '#fffdf6';
    c.beginPath(); c.ellipse(0, -40, 3.5, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, -40); c.quadraticCurveTo(1, -43, 0, -46); c.stroke();
    c.restore();
  },

  dibujarBase(c) {
    c.save();
    c.translate(400, 300);
    c.scale(2, 1);
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 190);
    g.addColorStop(0, 'rgba(140,255,190,.2)'); g.addColorStop(1, 'rgba(140,255,190,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 190, 0, Math.PI * 2); c.fill();
    c.restore();
    // pie de la base
    const gp = c.createLinearGradient(330, 0, 470, 0);
    gp.addColorStop(0, '#8a6514'); gp.addColorStop(0.45, '#ffe9a0'); gp.addColorStop(1, '#8a6514');
    c.fillStyle = gp;
    c.beginPath(); c.ellipse(400, 470, 88, 9, 0, 0, Math.PI * 2); c.fill();
    c.beginPath();
    c.moveTo(384, 436); c.quadraticCurveTo(392, 452, 372, 468); c.lineTo(428, 468); c.quadraticCurveTo(408, 452, 416, 436);
    c.closePath(); c.fill();
    // plato: borde y superficie
    const gr = c.createLinearGradient(168, 0, 632, 0);
    gr.addColorStop(0, '#7a5610'); gr.addColorStop(0.3, '#e2b54a'); gr.addColorStop(0.45, '#fff1b0'); gr.addColorStop(1, '#7a5610');
    c.fillStyle = gr;
    c.beginPath(); c.ellipse(400, 410, 232, 34, 0, 0, Math.PI * 2); c.fill();
    const gs = c.createRadialGradient(330, 395, 10, 400, 404, 230);
    gs.addColorStop(0, '#ffffff'); gs.addColorStop(1, '#dfe9e3');
    c.fillStyle = gs;
    c.beginPath(); c.ellipse(400, 404, 222, 28, 0, 0, Math.PI * 2); c.fill();
    // sombra del pastel sobre el plato
    c.fillStyle = 'rgba(0,50,25,.28)';
    c.beginPath(); c.ellipse(406, 404, 196, 27, 0, 0, Math.PI * 2); c.fill();
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
    const x0 = r.left + 400 * esc, y0 = r.top + 300 * esc;
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
        v.humo = azar(1.6, 4.2);
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
      [[-60, 398], [-20, 405], [30, 400], [70, 408], [5, 412], [-95, 404], [110, 399]].forEach(([dx, y]) => c.fillRect(400 + dx, y, 4, 3));
    }
    for (const v of this.velas) if (v.viva) this.dibujarVela(c, v.x, v.y, v.color);
    for (const o of this.volando) this.dibujarVela(c, o.x, o.y, o.color, Math.max(0, 1 - o.t / 1.2), o.rot);
    for (const h of this.humos) {
      c.fillStyle = `rgba(230,230,245,${0.28 * (1 - h.t / 2.2)})`;
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
