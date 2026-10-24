// =====================================================
//  SOPLIDO (micrófono), MÚSICA, LAS 28 VELAS Y EL PASTEL
// =====================================================
const TOTAL_VELAS = 28;
 
// Escribe un mensaje de dos líneas letra por letra
function escribirMensaje(el, a, b, vel = 42) {
  el._token = (el._token || 0) + 1;
  const tok = el._token;
  el.innerHTML = '<span class="l1"></span><span class="l2"></span>';
  const s1 = el.querySelector('.l1'), s2 = el.querySelector('.l2');
  const A = Array.from(a), B = Array.from(b);
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
    esc.addEventListener('pointerdown', () => { this.presionando = true; if (this.fase === 'r') this.teclaR(); });
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
    this.fase = 'normal';
    const [a, b] = this.esUltima() ? CONFIG.ultimaVela.pedir : (CONFIG.velas[this.i] || ['', '']);
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
    const puedeSoplar = this.listo && !this.apagando && this.fase !== 'r';
 
    if (puedeSoplar) {
      this.fuerza += soplando ? dt * 1.8 : -dt * 0.9;
      this.fuerza = Math.max(0, Math.min(1, this.fuerza));
      if (this.fuerza >= 1) this.apagar();
    }
 
    if (this.fase === 'r') {
      // la vela tramposa se burla moviéndose
      const w = Math.sin(ahora / 90);
      this.llama.style.transform = `rotate(${w * 12}deg) scale(${1 - this.teclasR * 0.2})`;
    } else {
      const viento = this.apagando ? 0 : Math.max(this.fuerza, Math.min(1, nivel / (Soplido.umbral * 2)) * 0.5);
      this.llama.style.transform = `skewX(${-viento * 28}deg) scale(${1 - viento * 0.35}, ${1 - viento * 0.25})`;
    }
    this.relleno.style.width = (this.fuerza * 100) + '%';
 
    requestAnimationFrame(this._b);
  },
 
  apagar() {
    this.apagando = true;
    if (this.esUltima() && this.fase === 'normal') { this.truco(); return; }
 
    this.llama.classList.add('apagada');
    this.humo.classList.add('activo');
    Sonido.soplo();
    Sonido.campanita();
 
    if (this.esUltima()) { this.liberarDeseos(); return; }
 
    setTimeout(() => this.vela.classList.add('saliendo'), 1700);
    setTimeout(() => { this.i++; this.mostrar(); }, 2500);
  },
 
  // La última vela se vuelve a prender sola
  truco() {
    this.llama.classList.add('apagada');
    this.humo.classList.add('activo');
    Sonido.soplo();
    setTimeout(() => {
      this.humo.classList.remove('activo');
      this.llama.classList.remove('apagada');
      Sonido.tono(260, 0.35, 'triangle', 0.14, 620);
      const [a, b] = CONFIG.ultimaVela.truco;
      escribirMensaje(this.msg, a, b);
      this.fase = 'r';
      this.teclasR = 0;
      this.fuerza = 0;
      this.apagando = false;
      this.nota.textContent = 'Presiona R:  ⚪ ⚪';
    }, 1100);
  },
 
  teclaR() {
    if (this.fase !== 'r') return;
    this.teclasR++;
    Sonido.click();
    this.nota.textContent = 'Presiona R:  ' + (this.teclasR >= 1 ? '🔴' : '⚪') + ' ' + (this.teclasR >= 2 ? '🔴' : '⚪');
    if (this.teclasR >= 2) {
      this.fase = 'lista';
      this.fuerza = 0;
      Sonido.desplegar();
      const [a, b] = CONFIG.ultimaVela.lista;
      escribirMensaje(this.msg, a, b);
      setTimeout(() => { this.nota.textContent = this.textoNota; }, 700);
    }
  },
 
  // Los deseos salen de la mecha y se esfuman con el humo
  async liberarDeseos() {
    const [a, b] = CONFIG.ultimaVela.deseos;
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
    CONFIG.deseos.forEach((txt, k) => setTimeout(() => this.deseoAlHumo(txt, x0, y0, k, dur), espera + k * intervalo));
 
    await esperar(espera + CONFIG.deseos.length * intervalo + dur - 2000);
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
 
// ---------- El pastel con las 28 velas ya apagadas ----------
const Pastel = {
  construir() {
    const cont = document.getElementById('velas-pastel');
    cont.innerHTML = '';
    for (let k = 0; k < 28; k++) {
      const fila = k < 14 ? 0 : 1, idx = k % 14;
      const v = document.createElement('div');
      v.className = 'mini-vela';
      v.style.left = (8 + idx * 17 + (fila ? 8 : 0)) + 'px';
      v.style.bottom = (fila ? 0 : 16) + 'px';
      v.style.zIndex = fila ? 2 : 1;
      v.style.setProperty('--c', Velas.colores[k % Velas.colores.length]);
      const h = document.createElement('div');
      h.className = 'humito';
      h.style.animationDelay = (Math.random() * 2.4) + 's';
      v.appendChild(h);
      cont.appendChild(v);
    }
  },
 
  async mostrar(alTerminar) {
    this.construir();
    const el = document.getElementById('mensaje-pastel');
    await esperar(1500);
    const lista = CONFIG.pastel;
    for (let k = 0; k < lista.length; k++) {
      await escribirMensaje(el, lista[k][0], lista[k][1], 45);
      await esperar(k === lista.length - 1 ? 600 : 2700);
    }
    alTerminar();
  },
};
