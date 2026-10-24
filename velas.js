// =====================================================
//  SOPLIDO (micrófono), LAS 28 VELAS Y EL PASTEL
// =====================================================

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
// Al soplar cerca del micrófono se produce un ruido fuerte y "sordo".
// Medimos el volumen (RMS) y si supera el ruido ambiente, cuenta como soplido.
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
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const fuente = Sonido.ctx.createMediaStreamSource(stream);
      this.analizador = Sonido.ctx.createAnalyser();
      this.analizador.fftSize = 1024;
      fuente.connect(this.analizador);
      this.datos = new Float32Array(this.analizador.fftSize);
      this.ok = true;
      await this.calibrar();
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

  // Escucha 1.2 segundos de silencio para conocer el ruido del cuarto
  calibrar() {
    return new Promise(res => {
      let suma = 0, n = 0;
      const fin = performance.now() + 1200;
      const paso = () => {
        suma += this.nivel(); n++;
        if (performance.now() < fin) requestAnimationFrame(paso);
        else {
          this.ambiente = suma / n;
          this.umbral = Math.min(0.3, Math.max(0.05, this.ambiente * 4));
          res();
        }
      };
      paso();
    });
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
  colores: ['#ff5fa2', '#5fc8ff', '#ffd45c', '#9b7bff', '#5fe0a0', '#ff8a5c', '#ff6b6b'],

  iniciar(alTerminar) {
    this.alTerminar = alTerminar;
    this.i = 0;
    this.activo = true;
    this.vela = document.getElementById('vela');
    this.llama = document.getElementById('llama');
    this.humo = document.getElementById('humo');
    this.msg = document.getElementById('mensaje-vela');
    this.relleno = document.getElementById('medidor-relleno');

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

    document.getElementById('nota-soplo').textContent = Soplido.ok
      ? '🎤 Sopla cerca del micrófono de la computadora para apagar la vela'
      : '⌨️ No se detectó micrófono: mantén presionada la barra espaciadora (o la vela) para soplar';

    this.mostrar();
    this.ultimo = performance.now();
    this._b = this.bucle.bind(this);
    requestAnimationFrame(this._b);
  },

  mostrar() {
    const v = this.vela;
    v.style.setProperty('--color-raya', this.colores[this.i % this.colores.length]);
    v.classList.remove('saliendo');
    void v.offsetWidth; // reinicia la animación
    v.classList.add('entrando');
    this.llama.classList.remove('apagada');
    this.humo.classList.remove('activo');
    document.getElementById('num-vela').textContent = this.i + 1;
    const [a, b] = CONFIG.velas[this.i];
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

    if (this.listo && !this.apagando) {
      this.fuerza += soplando ? dt * 1.8 : -dt * 0.9;
      this.fuerza = Math.max(0, Math.min(1, this.fuerza));
      if (this.fuerza >= 1) this.apagar();
    }

    // La llama se dobla según qué tan fuerte soplas
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
    setTimeout(() => this.vela.classList.add('saliendo'), 1700);
    setTimeout(() => {
      this.i++;
      if (this.i >= CONFIG.velas.length) {
        this.activo = false;
        this.alTerminar();
      } else {
        this.mostrar();
      }
    }, 2500);
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
