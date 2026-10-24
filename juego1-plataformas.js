// =====================================================
//  JUEGO 1: EL SALTO DEL SOL (plataformas)
// =====================================================
Juegos.plataformas = (() => {
  const T = 36, FILAS = 15, COLS = 190, ANCHO = 960, ALTO = 540;
  const SOLIDOS = '#BSUXV';
  let ctx, api, parar, t;
  let mapa, jugador, enemigos, monedas, part, textos, rebotes, meta;
  let camX, vidas, soles, puntos, tiempo, estado, reloj, checkpoint;
  let huevos, pajaros, huyen, montado, dobleUsado;

  // ---------- Construcción del nivel ----------
  function construirMapa() {
    mapa = Array.from({ length: FILAS }, () => Array(COLS).fill(' '));
    monedas = [];
    enemigos = [];
    const pon = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < FILAS) mapa[y][x] = c; };
    const fila = (x1, x2, y, c) => { for (let x = x1; x <= x2; x++) pon(x, y, c); };
    const columna = (x, alto) => { for (let i = 0; i < alto; i++) pon(x, 12 - i, 'X'); };
    const hoyo = (a, b) => { fila(a, b, 13, ' '); fila(a, b, 14, ' '); };
    const sol = (x, y) => monedas.push({ x: x * T + T / 2, y: y * T + T / 2, tomada: false });
    const enemigo = x => enemigos.push({ x: x * T, y: 13 * T - 28, w: 30, h: 28, vx: -55, vy: 0, vivo: true, aplastado: 0 });

    fila(0, COLS - 1, 13, '#');
    fila(0, COLS - 1, 14, '#');

    pon(8, 9, 'S'); fila(11, 15, 9, 'B'); pon(12, 9, 'S'); pon(14, 9, 'S'); pon(13, 5, 'S');
    enemigo(19);
    columna(23, 2); columna(31, 3); columna(39, 3);
    enemigo(27); enemigo(35);
    hoyo(44, 46);
    fila(49, 54, 9, 'B'); for (let x = 49; x <= 54; x++) sol(x, 8);
    enemigo(53); enemigo(57);
    pon(55, 9, 'V'); // bloque verde (mitad del nivel)
    hoyo(61, 63);
    fila(65, 67, 10, 'B'); fila(70, 73, 7, 'B'); pon(71, 7, 'S');
    hoyo(76, 79); fila(77, 78, 10, 'X');
    for (let i = 0; i < 6; i++) sol(81 + i, 10 - (i % 2));
    enemigo(85); enemigo(88); enemigo(91);
    for (let i = 0; i < 5; i++) columna(96 + i, i + 1);
    hoyo(101, 102);
    for (let i = 0; i < 5; i++) columna(103 + i, 5 - i);
    fila(112, 118, 9, 'B'); pon(115, 9, 'S'); fila(114, 116, 5, 'B'); for (let x = 114; x <= 116; x++) sol(x, 4);
    enemigo(116); enemigo(121);
    hoyo(125, 128); fila(126, 127, 10, 'B');
    columna(133, 3); columna(141, 3); enemigo(137); enemigo(145); enemigo(147);
    hoyo(151, 153);
    for (let x = 156; x <= 161; x++) if (x !== 158) sol(x, 9);
    pon(158, 9, 'V'); // bloque verde (cerca del final)
    for (let i = 0; i < 8; i++) columna(165 + i, i + 1);
    columna(173, 8);
    pon(182, 12, 'X');
    meta = { x: 182 * T, top: 3 * T };
  }

  function reiniciarJugador(x) {
    jugador = { x, y: 13 * T - 34, w: 22, h: 34, vx: 0, vy: 0, enSuelo: false, dir: 1, paso: 0, inv: 2 };
    montado = false;
    dobleUsado = false;
  }

  // ---------- Física con bloques ----------
  function solido(tx, ty) {
    if (tx < 0 || tx >= COLS) return true;
    if (ty < 0 || ty >= FILAS) return false;
    return SOLIDOS.includes(mapa[ty][tx]);
  }

  function mover(e, dt, alTecho) {
    e.choqueX = false;
    e.x += e.vx * dt;
    let y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) if (solido(tx, ty)) { e.x = tx * T - e.w; e.choqueX = true; break; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / T);
      for (let ty = y0; ty <= y1; ty++) if (solido(tx, ty)) { e.x = (tx + 1) * T; e.choqueX = true; break; }
    }
    e.y += e.vy * dt;
    e.enSuelo = false;
    const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / T);
      for (let tx = x0; tx <= x1; tx++) if (solido(tx, ty)) { e.y = ty * T - e.h; e.vy = 0; e.enSuelo = true; break; }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / T);
      let golpe = -1;
      for (let tx = x0; tx <= x1; tx++) if (solido(tx, ty)) golpe = tx;
      if (golpe >= 0) {
        const centro = Math.floor((e.x + e.w / 2) / T);
        if (solido(centro, ty)) golpe = centro;
        e.y = (ty + 1) * T;
        e.vy = 0;
        if (alTecho) alTecho(golpe, ty);
      }
    }
  }

  function golpearTecho(tx, ty) {
    if (ty < 0 || tx < 0 || tx >= COLS) return;
    const c = mapa[ty][tx];
    rebotes.push({ tx, ty, t: 0.2 });
    if (c === 'S') {
      mapa[ty][tx] = 'U';
      soles++; puntos += 200;
      Sonido.moneda();
      textos.agregar(tx * T + T / 2, ty * T - 12, '+1 ☀', '#ffd23f', 0.9);
      part.emitir(tx * T + T / 2, ty * T, '#ffd23f', 10, 160, 400, 0.6, 4);
    } else if (c === 'V') {
      mapa[ty][tx] = 'U';
      puntos += 200;
      Sonido.tono(500, 0.15, 'square', 0.1, 900);
      Sonido.tono(750, 0.25, 'square', 0.08, 1300, 0.12);
      huevos.push({ x: tx * T + T / 2 - 11, y: ty * T - 26, w: 22, h: 26, vx: (jugador.dir || 1) * 70, vy: -360, t: 0 });
      part.emitir(tx * T + T / 2, ty * T, '#34c759', 10, 160, 400, 0.6, 4);
    } else if (c === 'B') {
      mapa[ty][tx] = ' ';
      puntos += 50;
      Sonido.romper();
      part.emitir(tx * T + T / 2, ty * T + T / 2, '#c8642a', 14, 220, 900, 0.9, 6);
    } else {
      Sonido.golpe();
    }
    for (const en of enemigos) {
      if (en.vivo && Math.abs(en.x + en.w / 2 - (tx * T + T / 2)) < T && Math.abs(en.y + en.h - ty * T) < 4) aplastar(en);
    }
  }

  function aplastar(e) {
    e.vivo = false;
    e.aplastado = 0.6;
    puntos += 100;
    Sonido.pisar();
    textos.agregar(e.x + 15, e.y - 6, '+100', '#fff', 0.8);
  }

  function morir(caida) {
    if (estado !== 'jugando') return;
    estado = 'muerto';
    reloj = 2;
    vidas--;
    Sonido.muerte();
    jugador.vy = caida ? 0 : -650;
  }

  // ---------- Pajarito del sol ----------
  function perderPajaro() {
    montado = false;
    jugador.inv = 1.5;
    huyen.push({ x: jugador.x - 4, y: jugador.y + 9, vx: -jugador.dir * 180, vy: -240, t: 0, dir: -jugador.dir });
    Sonido.dano();
    textos.agregar(jugador.x + 11, jugador.y - 14, '¡Pío!', '#ffd23f', 1);
  }

  function actualizarCompanero(dt) {
    const j = jugador;
    for (const e of huevos) {
      e.t += dt;
      e.vy = Math.min(e.vy + 1500 * dt, 900);
      mover(e, dt);
      if (e.choqueX) e.vx = -e.vx;
      if (e.enSuelo) e.vx *= Math.pow(0.02, dt);
      if (e.y > FILAS * T) { e.fuera = true; continue; }
      if (e.t > 1.8) {
        e.fuera = true;
        part.emitir(e.x + 11, e.y + 13, '#fff6e0', 14, 160, 400, 0.7, 5);
        Sonido.campanita();
        pajaros.push({ x: e.x - 4, y: e.y + e.h - 26, w: 30, h: 26, vx: 0, vy: -220, t: 0 });
        textos.agregar(e.x + 11, e.y - 10, '¡Nació el pajarito del sol!', '#ffd23f', 1.6);
      }
    }
    huevos = huevos.filter(e => !e.fuera);

    for (const p of pajaros) {
      p.t += dt;
      p.vy = Math.min(p.vy + 1500 * dt, 900);
      mover(p, dt);
      if (p.enSuelo && Math.random() < dt * 1.5) p.vy = -260;
      if (p.y > FILAS * T) { p.fuera = true; continue; }
      if (!montado && estado === 'jugando' && choque(j, p)) {
        p.fuera = true;
        montado = true;
        Sonido.desplegar();
        Sonido.moneda();
        textos.agregar(j.x + 11, j.y - 16, '¡Doble salto!', '#7ee89a', 1.4);
      }
    }
    pajaros = pajaros.filter(p => !p.fuera);

    for (const h of huyen) { h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; }
    huyen = huyen.filter(h => h.t < 3);
  }

  // ---------- Actualización ----------
  function actualizar(dt) {
    t += dt;
    part.actualizar(dt);
    textos.actualizar(dt);
    for (const r of rebotes) r.t -= dt;
    rebotes = rebotes.filter(r => r.t > 0);

    if (estado === 'meta') {
      reloj -= dt;
      if (Math.random() < 0.25) part.emitir(meta.x + T / 2 + azar(-120, 120), azar(80, 250), ['#ffd23f', '#ff5fa2', '#7fd3ff'][Math.floor(Math.random() * 3)], 14, 180, 120, 1, 4);
      if (reloj <= 0) api.ganar();
      return;
    }
    if (estado === 'muerto') {
      reloj -= dt;
      jugador.vy += 1800 * dt;
      jugador.y += jugador.vy * dt;
      if (reloj <= 0) {
        if (vidas <= 0) api.perder('Se acabaron las vidas... ¡pero el niño del sol nunca se rinde!');
        else { reiniciarJugador(checkpoint); estado = 'jugando'; }
      }
      return;
    }

    tiempo -= dt;
    if (tiempo <= 0) { api.perder('Se acabó el tiempo. ¡Corre más rápido con Shift!'); return; }

    const k = Entrada.teclas, p = Entrada.presionadas, j = jugador;
    const izq = k.ArrowLeft || k.KeyA, der = k.ArrowRight || k.KeyD;
    const correr = k.ShiftLeft || k.ShiftRight || k.KeyX;
    const saltoP = p.Space || p.ArrowUp || p.KeyW || p.KeyZ;
    const saltoM = k.Space || k.ArrowUp || k.KeyW || k.KeyZ;
    const max = correr ? 290 : 185;

    if (der && !izq) { j.vx = Math.min(max, j.vx + 1300 * dt); j.dir = 1; }
    else if (izq && !der) { j.vx = Math.max(-max, j.vx - 1300 * dt); j.dir = -1; }
    else {
      const f = (j.enSuelo ? 1500 : 500) * dt;
      j.vx = Math.abs(j.vx) <= f ? 0 : j.vx - Math.sign(j.vx) * f;
    }
    if (saltoP && j.enSuelo) { j.vy = -760; Sonido.salto(); }
    else if (saltoP && montado && !dobleUsado) {
      j.vy = -680;
      dobleUsado = true;
      Sonido.tono(700, 0.12, 'triangle', 0.1, 1100);
      part.emitir(j.x + j.w / 2, j.y + j.h, '#ffd23f', 8, 120, 200, 0.5, 4);
    }
    if (!saltoM && j.vy < -280) j.vy = -280;
    j.vy = Math.min(j.vy + 2100 * dt, 900);
    mover(j, dt, golpearTecho);
    if (j.enSuelo) dobleUsado = false;
    if (j.enSuelo && Math.abs(j.vx) > 10) j.paso += Math.abs(j.vx) * dt * 0.06;
    if (j.inv > 0) j.inv -= dt;
    if (j.x > 94 * T) checkpoint = 94 * T;

    if (j.y > FILAS * T + 40) { morir(true); return; }
    if (j.x + j.w >= meta.x + T / 2 - 3) {
      estado = 'meta';
      reloj = 3;
      puntos += Math.ceil(tiempo) * 10;
      Sonido.victoria();
      return;
    }

    for (const e of enemigos) {
      if (e.aplastado > 0) { e.aplastado -= dt; continue; }
      if (!e.vivo) continue;
      if (Math.abs(e.x - j.x) > ANCHO) continue; // lejos: dormido
      e.vy = Math.min(e.vy + 2100 * dt, 900);
      mover(e, dt);
      if (e.choqueX) e.vx = -e.vx;
      if (e.y > FILAS * T) { e.vivo = false; continue; }
      if (choque(j, e)) {
        if (j.vy > 0 && j.y + j.h - e.y < 16) {
          aplastar(e);
          j.vy = saltoM ? -620 : -420;
        } else if (j.inv <= 0) {
          if (montado) perderPajaro();
          else { morir(false); return; }
        }
      }
    }

    actualizarCompanero(dt);

    for (const m of monedas) {
      if (!m.tomada && Math.abs(m.x - (j.x + j.w / 2)) < 20 && Math.abs(m.y - (j.y + j.h / 2)) < 26) {
        m.tomada = true;
        soles++; puntos += 100;
        Sonido.moneda();
      }
    }

    camX = Math.max(0, Math.min(j.x - ANCHO * 0.4, COLS * T - ANCHO));
  }

  // ---------- Dibujo ----------
  function nube(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 26, y - 10, 28, 0, Math.PI * 2);
    ctx.arc(x + 56, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function dibujarTile(c, x, y) {
    const r = rebotes.find(o => o.tx === x && o.ty === y);
    const px = x * T, py = y * T + (r ? -Math.sin((0.2 - r.t) / 0.2 * Math.PI) * 8 : 0);
    if (c === '#') {
      ctx.fillStyle = '#b8652a'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#9a4f1c';
      ctx.fillRect(px + ((x * 7 + y * 3) % 4) * 7 + 4, py + 14, 5, 5);
      ctx.fillRect(px + ((x * 3 + y) % 3) * 9 + 6, py + 26, 4, 4);
      if (y === 0 || mapa[y - 1][x] !== '#') {
        ctx.fillStyle = '#52c447'; ctx.fillRect(px, py, T, 10);
        ctx.fillStyle = '#3a9a32'; ctx.fillRect(px, py + 10, T, 3);
      }
    } else if (c === 'B') {
      ctx.fillStyle = '#d0703a'; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = '#7a3410'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2);
      ctx.moveTo(px + T / 2, py); ctx.lineTo(px + T / 2, py + T / 2);
      ctx.moveTo(px + T / 4, py + T / 2); ctx.lineTo(px + T / 4, py + T);
      ctx.moveTo(px + 3 * T / 4, py + T / 2); ctx.lineTo(px + 3 * T / 4, py + T);
      ctx.stroke();
      ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
    } else if (c === 'S') {
      ctx.fillStyle = '#a8720a'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#ffc22e'; ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      dibujarSolIcono(ctx, px + T / 2, py + T / 2, 7, t * 1.5, '#ff8c1a');
    } else if (c === 'V') {
      ctx.fillStyle = '#1b6b30'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#34c759'; ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      ctx.fillStyle = '#7ee89a'; ctx.fillRect(px + 2, py + 2, T - 4, 4); ctx.fillRect(px + 2, py + 2, 4, T - 4);
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.ellipse(px + T / 2, py + T / 2 + 1, 7, 9 + Math.sin(t * 4) * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(px + T / 2 - 4, py + T / 2 - 3, 3, 3); ctx.fillRect(px + T / 2 + 1, py + T / 2 + 3, 3, 3);
    } else if (c === 'U') {
      ctx.fillStyle = '#5a3f26'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#8a6a4a'; ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      ctx.fillStyle = '#5a3f26';
      ctx.fillRect(px + 5, py + 5, 4, 4); ctx.fillRect(px + T - 9, py + 5, 4, 4);
      ctx.fillRect(px + 5, py + T - 9, 4, 4); ctx.fillRect(px + T - 9, py + T - 9, 4, 4);
    } else if (c === 'X') {
      ctx.fillStyle = '#9b9bab'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#c8c8d4'; ctx.fillRect(px, py, T, 4); ctx.fillRect(px, py, 4, T);
      ctx.fillStyle = '#6a6a7a'; ctx.fillRect(px, py + T - 4, T, 4); ctx.fillRect(px + T - 4, py, 4, T);
    }
  }

  function dibujarPajarito(x, y, dir, aleteo) {
    const cx = x + 15;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(dir, 1);
    // patitas
    ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, 22); ctx.lineTo(-5, 27); ctx.moveTo(4, 22); ctx.lineTo(5, 27); ctx.stroke();
    // cuerpo
    ctx.fillStyle = '#ffc22e';
    ctx.beginPath(); ctx.ellipse(-2, 15, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff1b8';
    ctx.beginPath(); ctx.ellipse(2, 18, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    // ala
    ctx.save();
    ctx.translate(-5, 13);
    ctx.rotate(-0.3 - aleteo * 0.8);
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath(); ctx.ellipse(-6, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // cabeza con cresta de sol
    ctx.fillStyle = '#ff9f1c';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(8 + i * 4 - 2, -1); ctx.lineTo(8 + i * 5, -8); ctx.lineTo(8 + i * 4 + 2, -1); ctx.fill();
    }
    ctx.fillStyle = '#ffc22e';
    ctx.beginPath(); ctx.arc(9, 5, 8, 0, Math.PI * 2); ctx.fill();
    // pañuelito verde
    ctx.fillStyle = '#2fae4f';
    ctx.fillRect(2, 10, 13, 4);
    ctx.beginPath(); ctx.moveTo(3, 12); ctx.lineTo(-6, 9 + Math.sin(t * 10) * 2); ctx.lineTo(-5, 15); ctx.closePath(); ctx.fill();
    // pico y ojo
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(23, 6); ctx.lineTo(16, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(11, 2, 3, 3);
    ctx.restore();
  }

  function dibujarHuevo(e) {
    const tiembla = e.t > 1 ? Math.sin(t * 50) * 2 : 0;
    const cx = e.x + 11 + tiembla, cy = e.y + 13;
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath(); ctx.ellipse(cx, cy, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0c48a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath(); ctx.arc(cx - 4, cy - 4, 2.5, 0, Math.PI * 2); ctx.arc(cx + 4, cy + 3, 3, 0, Math.PI * 2); ctx.arc(cx - 2, cy + 7, 2, 0, Math.PI * 2); ctx.fill();
    if (e.t > 1.3) {
      ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 1); ctx.lineTo(cx - 4, cy - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx + 4, cy - 4); ctx.lineTo(cx + 9, cy - 1); ctx.stroke();
    }
  }

  function dibujarGrunon(e) {
    const x = e.x, y = e.y;
    if (e.aplastado > 0) {
      ctx.fillStyle = '#6a3d9a';
      ctx.beginPath(); ctx.ellipse(x + 15, y + 24, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const pata = Math.sin(t * 12 + e.x) * 3;
    ctx.fillStyle = '#3b1f5c';
    ctx.fillRect(x + 4 + pata, y + 22, 8, 6);
    ctx.fillRect(x + 18 - pata, y + 22, 8, 6);
    ctx.fillStyle = '#7b47b5';
    ctx.beginPath(); ctx.ellipse(x + 15, y + 14, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 7, y + 9, 6, 7); ctx.fillRect(x + 17, y + 9, 6, 7);
    ctx.fillStyle = '#111';
    const mira = e.vx < 0 ? 0 : 2;
    ctx.fillRect(x + 8 + mira, y + 11, 3, 4); ctx.fillRect(x + 18 + mira, y + 11, 3, 4);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + 13, y + 9);
    ctx.moveTo(x + 24, y + 6); ctx.lineTo(x + 17, y + 9);
    ctx.stroke();
  }

  function dibujar() {
    const g = ctx.createLinearGradient(0, 0, 0, ALTO);
    g.addColorStop(0, '#4aa8ff'); g.addColorStop(1, '#c9ecff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);

    dibujarSolIcono(ctx, 830 - camX * 0.03, 95, 36, t * 0.3, '#ffe066');

    ctx.fillStyle = '#8fd18b';
    const offC = (camX * 0.25) % 320;
    for (let i = -1; i < 5; i++) {
      ctx.beginPath(); ctx.ellipse(i * 320 - offC + 160, 480, 200, 140, 0, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    const base = Math.floor(camX * 0.5 / 260), offN = (camX * 0.5) % 260;
    for (let i = -1; i < 6; i++) {
      const idx = i + base;
      nube(i * 260 - offN + 40, 60 + (((idx % 3) + 3) % 3) * 40);
    }

    ctx.save();
    ctx.translate(-Math.round(camX), 0);
    const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(COLS - 1, c0 + Math.ceil(ANCHO / T) + 1);
    for (let y = 0; y < FILAS; y++) for (let x = c0; x <= c1; x++) if (mapa[y][x] !== ' ') dibujarTile(mapa[y][x], x, y);

    // meta: poste con el sol y la bandera del 28
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(meta.x + T / 2 - 3, meta.top, 6, 12 * T - meta.top);
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.moveTo(meta.x + T / 2 - 3, meta.top + 14);
    ctx.lineTo(meta.x + T / 2 - 70, meta.top + 34);
    ctx.lineTo(meta.x + T / 2 - 3, meta.top + 54);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('28', meta.x + T / 2 - 26, meta.top + 35);
    ctx.textAlign = 'left';
    dibujarSolIcono(ctx, meta.x + T / 2, meta.top - 8, 16, t, '#ffc400');

    for (const m of monedas) {
      if (m.tomada || m.x < camX - T || m.x > camX + ANCHO + T) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(Math.abs(Math.cos(t * 3 + m.x)) * 0.7 + 0.3, 1);
      dibujarSolIcono(ctx, 0, 0, 7, 0, '#ffcf2e');
      ctx.restore();
    }

    for (const e of enemigos) if (e.vivo || e.aplastado > 0) dibujarGrunon(e);
    for (const e of huevos) dibujarHuevo(e);
    for (const p of pajaros) dibujarPajarito(p.x, p.y, 1, p.enSuelo ? 0 : Math.sin(t * 20));
    for (const h of huyen) dibujarPajarito(h.x, h.y, h.dir, Math.sin(t * 25));

    const j = jugador;
    if (!(estado === 'jugando' && j.inv > 0 && Math.floor(t * 12) % 2)) {
      if (montado) {
        dibujarPajarito(j.x - 4, j.y + 9, j.dir, j.enSuelo ? Math.sin(j.paso) * 0.3 : Math.sin(t * 22));
        dibujarNinoSol(ctx, j.x, j.y - 10, j.w, j.h, j.dir, 0.6);
      } else {
        dibujarNinoSol(ctx, j.x, j.y, j.w, j.h, j.dir, j.enSuelo ? j.paso : 1.2);
      }
    }
    part.dibujar(ctx);
    textos.dibujar(ctx);
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, ANCHO, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('PUNTOS ' + String(puntos).padStart(6, '0'), 16, 21);
    dibujarSolIcono(ctx, 330, 20, 7, t, '#ffd23f');
    ctx.fillStyle = '#fff';
    ctx.fillText('x ' + soles, 346, 21);
    ctx.fillText('VIDAS ' + vidas, 500, 21);
    ctx.fillText('TIEMPO ' + Math.ceil(tiempo), 720, 21);
    if (montado) { ctx.font = '20px serif'; ctx.fillText('🐤', 650, 21); }

    if (estado === 'meta') {
      ctx.textAlign = 'center';
      ctx.font = '26px "Press Start 2P", monospace';
      ctx.fillStyle = '#000'; ctx.fillText('¡NIVEL SUPERADO!', ANCHO / 2 + 3, 203);
      ctx.fillStyle = '#ffd23f'; ctx.fillText('¡NIVEL SUPERADO!', ANCHO / 2, 200);
      ctx.textAlign = 'left';
    }
  }

  return {
    emoji: '☀️',
    titulo: 'El salto del sol',
    recuerdo: 'Correr, saltar y no rendirse: así empezó todo.',
    intro: 'Corre, salta sobre los gruñones y llega hasta el sol del final. Golpea los bloques dorados para ganar soles. Busca los bloques VERDES: de ahí sale el pajarito del sol, que te da doble salto y te protege de un golpe. Tienes 3 vidas.',
    ayuda: '← → mover · Espacio / ↑ saltar (con el pajarito, salta otra vez en el aire) · Shift correr',
    iniciar(c, a) {
      ctx = c; api = a; t = 0;
      construirMapa();
      part = new Particulas();
      textos = new TextosFlotantes();
      rebotes = [];
      huevos = []; pajaros = []; huyen = [];
      vidas = 3; soles = 0; puntos = 0; tiempo = 300;
      checkpoint = 3 * T;
      reiniciarJugador(checkpoint);
      jugador.inv = 0;
      camX = 0;
      estado = 'jugando';
      parar = crearBucle(actualizar, dibujar);
    },
    detener() { if (parar) parar(); },
  };
})();
