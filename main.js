// =====================================================
//  FLUJO PRINCIPAL: inicio → velas → pastel → juegos → final
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const lienzo = $('lienzo');
  const ctx = lienzo.getContext('2d');
  Entrada.init(lienzo);
 
  const LISTA = [Juegos.plataformas, Juegos.dimension, Juegos.torres, Juegos.bombas, Juegos.patos];
  let desbloqueados = 1;
  const superados = new Set();
  let actual = -1, fallos = 0, enJuego = false;
 
  function mostrar(id) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p.id === id));
  }
 
  // ---------- Inicio ----------
  $('btn-empezar').addEventListener('click', async () => {
    Sonido.iniciar();
    $('btn-empezar').disabled = true;
    $('estado-inicio').textContent = 'Preparando el micrófono… guarda silencio un momento 🤫';
    await Soplido.iniciar();
    mostrar('pantalla-velas');
    Velas.iniciar(() => {
      mostrar('pantalla-pastel');
      Pastel.mostrar(() => $('btn-jugar').classList.remove('oculto'));
    });
  });
 
  $('btn-jugar').addEventListener('click', () => {
    Sonido.click();
    mostrar('pantalla-mapa');
    pintarMapa();
  });
 
  // ---------- Mapa de juegos ----------
  function pintarMapa() {
    const cont = $('lista-juegos');
    cont.innerHTML = '';
    LISTA.forEach((j, i) => {
      const bloqueado = i >= desbloqueados;
      const d = document.createElement('div');
      d.className = 'tarjeta' + (bloqueado ? ' bloqueada' : '') + (superados.has(i) ? ' completada' : '');
      d.innerHTML =
        `<div class="emoji">${bloqueado ? '🔒' : j.emoji}</div>` +
        `<div class="num">Juego ${i + 1} de 5</div>` +
        `<h3>${j.titulo}</h3>` +
        `<p>${j.recuerdo}</p>` +
        (superados.has(i) ? '<div class="ok">✔ Superado</div>' : '');
      if (!bloqueado) d.addEventListener('click', () => abrirJuego(i));
      cont.appendChild(d);
    });
  }
 
  // ---------- Ventana emergente ----------
  function overlay(titulo, texto, boton, cb, extra) {
    $('overlay-titulo').textContent = titulo;
    $('overlay-texto').textContent = texto;
    const b = $('overlay-btn');
    b.textContent = boton;
    b.onclick = () => { ocultarOverlay(); Sonido.click(); cb(); };
    const b2 = $('overlay-btn2');
    if (extra) {
      b2.classList.remove('oculto');
      b2.textContent = extra.texto;
      b2.onclick = () => { ocultarOverlay(); extra.cb(); };
    } else {
      b2.classList.add('oculto');
    }
    $('overlay').classList.remove('oculto');
    b.focus();
  }
  function ocultarOverlay() { $('overlay').classList.add('oculto'); }
 
  // ---------- Juegos ----------
  function detenerActual() {
    if (enJuego && actual >= 0) LISTA[actual].detener();
    enJuego = false;
    lienzo.style.cursor = '';
  }
 
  function abrirJuego(i) {
    detenerActual();
    actual = i;
    fallos = 0;
    const j = LISTA[i];
    mostrar('pantalla-juego');
    $('titulo-juego').textContent = `${i + 1}. ${j.titulo}`;
    const esPatos = j === Juegos.patos;
    Remoto.activo = esPatos;
    Remoto.mostrar(esPatos);
    $('ayuda-juego').textContent = j.ayuda + (esPatos ? ' (o usa tu teléfono como pistola)' : '');
    ctx.fillStyle = '#07051f';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    overlay(j.titulo, j.intro, '¡A jugar!', arrancar);
  }
 
  function arrancar() {
    Entrada.teclas = {};
    Entrada.limpiar();
    enJuego = true;
    LISTA[actual].iniciar(ctx, { ganar, perder });
  }
 
  function marcarSuperado() {
    superados.add(actual);
    desbloqueados = Math.max(desbloqueados, Math.min(LISTA.length, actual + 2));
  }
 
  function siguiente() {
    if (actual >= LISTA.length - 1) final();
    else abrirJuego(actual + 1);
  }
 
  function ganar() {
    detenerActual();
    marcarSuperado();
    const ultimo = actual === LISTA.length - 1;
    overlay('¡GANASTE!', CONFIG.victorias[actual] || '¡Muy bien!', ultimo ? 'Continuar ✨' : 'Siguiente juego ▶', siguiente);
  }
 
  function perder(msg) {
    detenerActual();
    fallos++;
    const extra = fallos >= 2
      ? { texto: 'Pasar al siguiente juego', cb: () => { marcarSuperado(); siguiente(); } }
      : null;
    overlay('¡Casi!', msg || 'Inténtalo otra vez', 'Intentar de nuevo', arrancar, extra);
  }
 
  $('btn-menu').addEventListener('click', () => {
    detenerActual();
    Remoto.activo = false;
    Remoto.mostrar(false);
    ocultarOverlay();
    mostrar('pantalla-mapa');
    pintarMapa();
  });
 
  // ---------- Final ----------
  let confetiActivo = false;
  function confeti() {
    const cv = $('confeti'), c = cv.getContext('2d');
    const ajustar = () => { cv.width = innerWidth; cv.height = innerHeight; };
    ajustar();
    addEventListener('resize', ajustar);
    const colores = ['#ffd45c', '#ff5fa2', '#7fd3ff', '#9b7bff', '#5fe0a0', '#ffffff'];
    const piezas = Array.from({ length: 160 }, () => ({
      x: Math.random() * cv.width, y: Math.random() * -cv.height, vy: azar(60, 160), vx: azar(-30, 30),
      r: Math.random() * 6, vr: azar(-4, 4), w: azar(6, 11), h: azar(10, 16), col: colores[Math.floor(Math.random() * colores.length)],
    }));
    let ultimo = performance.now();
    confetiActivo = true;
    const paso = ahora => {
      if (!confetiActivo) return;
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      c.clearRect(0, 0, cv.width, cv.height);
      for (const p of piezas) {
        p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(ahora / 600 + p.r) * 0.5; p.r += p.vr * dt;
        if (p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width; }
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
        c.restore();
      }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
 
  async function final() {
    Remoto.activo = false;
    Remoto.mostrar(false);
    mostrar('pantalla-final');
    Sonido.victoria();
    if (!confetiActivo) confeti();
    const el = $('mensaje-final');
    $('firma').classList.remove('visible');
    $('btn-repetir').classList.add('oculto');
    for (const [a, b] of CONFIG.final) {
      await escribirMensaje(el, a, b, 45);
      await esperar(2400);
    }
    $('firma').textContent = '— ' + CONFIG.firma;
    $('firma').classList.add('visible');
    $('btn-repetir').classList.remove('oculto');
  }
 
  $('btn-repetir').addEventListener('click', () => {
    confetiActivo = false;
    mostrar('pantalla-mapa');
    pintarMapa();
  });
});
