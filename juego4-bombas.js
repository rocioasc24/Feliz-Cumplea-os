// =====================================================
//  JUEGO 4: LABERINTO EXPLOSIVO (bombas)
// =====================================================
Juegos.bombas = (() => {
  const T = 44, C = 17, F = 11, OX = (960 - C * T) / 2, OY = 52;
  let ctx, api, parar, t;
  let mapa, objetos, jugador, enemigos, bombas, fuegos, part, textos;
  let vidas, maxBombas, rango, velJugador, tiempo, estado, reloj, puntos, avisoPuerta;

  const clave = (x, y) => x + ',' + y;

  function crearEnte(x, y, vel) { return { tx: x, ty: y, nx: x, ny: y, prog: 0, moviendo: false, vel, dx: 0, dy: 0 }; }
  function posicion(e) { return { x: e.tx + (e.nx - e.tx) * e.prog, y: e.ty + (e.ny - e.ty) * e.prog }; }
  function tileDe(e) { return e.prog > 0.5 ? [e.nx, e.ny] : [e.tx, e.ty]; }
  function hayBomba(x, y) { return bombas.some(b => b.x === x && b.y === y); }
  function hayFuego(x, y) { return fuegos.some(f => f.x === x && f.y === y); }
  function libre(x, y) { return !!mapa[y] && mapa[y][x] === 0 && !hayBomba(x, y); }

  function intentarMover(e, dx, dy) {
    if (!libre(e.tx + dx, e.ty + dy)) return false;
    e.nx = e.tx + dx; e.ny = e.ty + dy; e.prog = 0; e.moviendo = true; e.dx = dx; e.dy = dy;
    return true;
  }
  function avanzar(e, dt) {
    if (!e.moviendo) return false;
    e.prog += e.vel * dt;
    if (e.prog >= 1) { e.tx = e.nx; e.ty = e.ny; e.prog = 0; e.moviendo = false; return true; }
    return false;
  }

  // 0 = piso, 1 = muro fijo, 2 = bloque que se puede romper
  function generar() {
    mapa = [];
    objetos = {};
    for (let y = 0; y < F; y++) {
      mapa.push([]);
      for (let x = 0; x < C; x++) {
        let v = 0;
        if (x === 0 || y === 0 || x === C - 1 || y === F - 1 || (x % 2 === 0 && y % 2 === 0)) v = 1;
        else if (x + y <= 3) v = 0;
        else if (Math.random() < 0.5) v = 2;
        mapa[y].push(v);
      }
    }
    const blandos = [];
    for (let y = 0; y < F; y++) for (let x = 0; x < C; x++) if (mapa[y][x] === 2) blandos.push([x, y]);
    mezclar(blandos);
    ['puerta', 'bomba', 'bomba', 'fuego', 'fuego', 'velocidad'].forEach((it, i) => {
      if (blandos[i]) objetos[clave(blandos[i][0], blandos[i][1])] = it;
    });
    enemigos = [];
    const pisos = [];
    for (let y = 0; y < F; y++) for (let x = 0; x < C; x++) if (mapa[y][x] === 0 && x + y > 8) pisos.push([x, y]);
    mezclar(pisos);
    for (let i = 0; i < 6 && i < pisos.length; i++) {
      const tipo = i < 4 ? 'gota' : 'fantasma';
      const e = crearEnte(pisos[i][0], pisos[i][1], tipo === 'gota' ? 1.8 : 2.6);
      e.tipo = tipo;
      enemigos.push(e);
    }
  }

  function ponerBomba() {
    const [x, y] = tileDe(jugador);
    if (bombas.length >= maxBombas || hayBomba(x, y)) return;
    bombas.push({ x, y, t: 2.4, rango, exploto: false });
    Sonido.poner();
  }

  function explotar(b) {
    b.exploto = true;
    Sonido.explosion();
    const agregar = (x, y) => fuegos.push({ x, y, t: 0.55 });
    agregar(b.x, b.y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= b.rango; i++) {
        const x = b.x + dx * i, y = b.y + dy * i;
        if (mapa[y][x] === 1) break;
        if (mapa[y][x] === 2) {
          mapa[y][x] = 0;
          puntos += 10;
          agregar(x, y);
          part.emitir(OX + (x + 0.5) * T, OY + (y + 0.5) * T, '#c0692f', 12, 180, 500, 0.7, 6);
          break;
        }
        agregar(x, y);
        const otra = bombas.find(o => o.x === x && o.y === y && !o.exploto);
        if (otra) otra.t = 0;
      }
    }
  }

  function recoger() {
    const k = clave(jugador.tx, jugador.ty), it = objetos[k];
    if (!it || it === 'puerta') return;
    delete objetos[k];
    const cx = OX + (jugador.tx + 0.5) * T, cy = OY + jugador.ty * T;
    if (it === 'bomba') { maxBombas++; textos.agregar(cx, cy, '+1 BOMBA', '#ffd45c', 1.2); }
    if (it === 'fuego') { rango++; textos.agregar(cx, cy, '+ALCANCE', '#ff8c1a', 1.2); }
    if (it === 'velocidad') { velJugador += 1; jugador.vel = velJugador; textos.agregar(cx, cy, '+VELOCIDAD', '#7fd3ff', 1.2); }
    Sonido.moneda();
  }

  function morir() {
    estado = 'muerto';
    reloj = 1.8;
    vidas--;
    Sonido.muerte();
    const p = posicion(jugador);
    part.emitir(OX + (p.x + 0.5) * T, OY + (p.y + 0.5) * T, '#ff8c1a', 20, 200, 200, 0.9, 5);
  }

  function revivir() {
    jugador = crearEnte(1, 1, velJugador);
    jugador.dir = 1; jugador.inv = 2.5; jugador.paso = 0;
    bombas = []; fuegos = [];
    estado = 'jugando';
  }

  // ---------- Actualización ----------
  function actualizar(dt) {
    t += dt;
    part.actualizar(dt);
    textos.actualizar(dt);

    if (estado === 'gano') { reloj -= dt; if (reloj <= 0) api.ganar(); return; }
    if (estado === 'muerto') {
      reloj -= dt;
      if (reloj <= 0) {
        if (vidas <= 0) { api.perder('Te alcanzó la explosión... ¡pero un buen estratega siempre vuelve!'); return; }
        revivir();
      }
      return;
    }
    tiempo -= dt;
    if (tiempo <= 0) { api.perder('Se acabó el tiempo. ¡Tú puedes, inténtalo otra vez!'); return; }

    const k = Entrada.teclas, p = Entrada.presionadas, j = jugador;
    if (j.inv > 0) j.inv -= dt;
    if (!j.moviendo) {
      let dx = 0, dy = 0;
      if (k.ArrowLeft || k.KeyA) dx = -1;
      else if (k.ArrowRight || k.KeyD) dx = 1;
      else if (k.ArrowUp || k.KeyW) dy = -1;
      else if (k.ArrowDown || k.KeyS) dy = 1;
      if (dx) j.dir = dx;
      if (dx || dy) intentarMover(j, dx, dy);
    }
    if (j.moviendo) j.paso += dt * 14;
    if (avanzar(j, dt)) recoger();
    if (p.Space || p.KeyX) ponerBomba();

    for (const b of bombas) { b.t -= dt; if (b.t <= 0 && !b.exploto) explotar(b); }
    bombas = bombas.filter(b => !b.exploto);
    for (const f of fuegos) f.t -= dt;
    fuegos = fuegos.filter(f => f.t > 0);

    for (const e of enemigos) {
      if (!e.moviendo) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => libre(e.tx + dx, e.ty + dy));
        if (dirs.length) {
          const sigue = dirs.find(([dx, dy]) => dx === e.dx && dy === e.dy);
          const [dx, dy] = (sigue && Math.random() < 0.7) ? sigue : dirs[Math.floor(Math.random() * dirs.length)];
          intentarMover(e, dx, dy);
        }
      }
      avanzar(e, dt);
      const [ex, ey] = tileDe(e);
      if (hayFuego(ex, ey)) {
        e.muerto = true;
        puntos += 100;
        const pe = posicion(e);
        part.emitir(OX + (pe.x + 0.5) * T, OY + (pe.y + 0.5) * T, e.tipo === 'gota' ? '#5fc8ff' : '#ff9ad5', 16, 180, 100, 0.8, 5);
        textos.agregar(OX + (pe.x + 0.5) * T, OY + pe.y * T, '+100', '#fff', 0.8);
        Sonido.pisar();
      }
    }
    enemigos = enemigos.filter(e => !e.muerto);
    if (enemigos.length === 0 && !avisoPuerta) {
      avisoPuerta = true;
      textos.agregar(480, 300, '¡Ahora busca la puerta!', '#ffd45c', 2.5);
      Sonido.moneda();
    }

    if (j.inv <= 0) {
      const [jx, jy] = tileDe(j);
      if (hayFuego(jx, jy)) { morir(); return; }
      const pj = posicion(j);
      for (const e of enemigos) {
        const pe = posicion(e);
        if (Math.hypot(pe.x - pj.x, pe.y - pj.y) < 0.65) { morir(); return; }
      }
    }

    if (!j.moviendo && objetos[clave(j.tx, j.ty)] === 'puerta' && enemigos.length === 0) {
      estado = 'gano';
      reloj = 2.5;
      Sonido.victoria();
    }
  }

  // ---------- Dibujo ----------
  function dibujarEnemigo(e) {
    const p = posicion(e);
    const cx = OX + (p.x + 0.5) * T, cy = OY + (p.y + 0.5) * T;
    const bob = Math.sin(t * 6 + e.tx) * 2;
    if (e.tipo === 'gota') {
      ctx.fillStyle = '#3aa8f0';
      ctx.beginPath();
      ctx.arc(cx, cy + 5 + bob, 14, 0, Math.PI);
      ctx.quadraticCurveTo(cx - 14, cy - 6 + bob, cx, cy - 18 + bob);
      ctx.quadraticCurveTo(cx + 14, cy - 6 + bob, cx + 14, cy + 5 + bob);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff8fd0';
      ctx.beginPath();
      ctx.arc(cx, cy - 2 + bob, 14, Math.PI, 0);
      ctx.lineTo(cx + 14, cy + 14 + bob);
      for (let i = 0; i < 4; i++) ctx.lineTo(cx + 14 - (i + 0.5) * 7, cy + (i % 2 ? 14 : 9) + bob);
      ctx.lineTo(cx - 14, cy + 14 + bob);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 7, cy - 3 + bob, 5, 6); ctx.fillRect(cx + 2, cy - 3 + bob, 5, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 6 + e.dx, cy - 1 + bob + e.dy, 3, 3); ctx.fillRect(cx + 3 + e.dx, cy - 1 + bob + e.dy, 3, 3);
  }

  function dibujar() {
    ctx.fillStyle = '#1b1238'; ctx.fillRect(0, 0, 960, 540);

    for (let y = 0; y < F; y++) {
      for (let x = 0; x < C; x++) {
        const px = OX + x * T, py = OY + y * T, v = mapa[y][x];
        if (v === 1) {
          ctx.fillStyle = '#8e8ea0'; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = '#c4c4d2'; ctx.fillRect(px, py, T, 4); ctx.fillRect(px, py, 4, T);
          ctx.fillStyle = '#5c5c6e'; ctx.fillRect(px, py + T - 4, T, 4); ctx.fillRect(px + T - 4, py, 4, T);
        } else if (v === 2) {
          ctx.fillStyle = '#c0692f'; ctx.fillRect(px, py, T, T);
          ctx.strokeStyle = '#7a3a12'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py + T / 3); ctx.lineTo(px + T, py + T / 3);
          ctx.moveTo(px, py + 2 * T / 3); ctx.lineTo(px + T, py + 2 * T / 3);
          ctx.moveTo(px + T / 2, py); ctx.lineTo(px + T / 2, py + T / 3);
          ctx.moveTo(px + T / 4, py + T / 3); ctx.lineTo(px + T / 4, py + 2 * T / 3);
          ctx.moveTo(px + 3 * T / 4, py + T / 3); ctx.lineTo(px + 3 * T / 4, py + 2 * T / 3);
          ctx.moveTo(px + T / 2, py + 2 * T / 3); ctx.lineTo(px + T / 2, py + T);
          ctx.stroke();
          ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
        } else {
          ctx.fillStyle = (x + y) % 2 ? '#3f8f3f' : '#3a873a'; ctx.fillRect(px, py, T, T);
          if (y > 0 && mapa[y - 1][x] !== 0) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(px, py, T, 7); }
          const it = objetos[clave(x, y)];
          if (it === 'puerta') {
            const lista = enemigos.length === 0;
            ctx.fillStyle = '#5a3a1a'; ctx.fillRect(px + 6, py + 8, T - 12, T - 8);
            ctx.fillStyle = lista ? `rgba(255,212,92,${0.5 + Math.sin(t * 5) * 0.3})` : '#20130a';
            ctx.fillRect(px + 11, py + 13, T - 22, T - 13);
            dibujarSolIcono(ctx, px + T / 2, py + 9, 5, t, '#ffd45c');
          } else if (it) {
            rectRedondo(ctx, px + 5, py + 5, T - 10, T - 10, 6);
            ctx.fillStyle = '#ffefc2'; ctx.fill();
            ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(it === 'bomba' ? '💣' : it === 'fuego' ? '🔥' : '⚡', px + T / 2, py + T / 2 + 1);
            ctx.textAlign = 'left';
          }
        }
      }
    }

    for (const b of bombas) {
      const cx = OX + (b.x + 0.5) * T, cy = OY + (b.y + 0.5) * T;
      const s = 1 + Math.sin(t * (b.t < 0.8 ? 25 : 10)) * 0.07;
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx, cy + 2, 15 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a07040'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + 6, cy - 10); ctx.quadraticCurveTo(cx + 12, cy - 18, cx + 8, cy - 22); ctx.stroke();
      ctx.fillStyle = Math.random() < 0.5 ? '#ffd45c' : '#ff6a1a';
      ctx.beginPath(); ctx.arc(cx + 8, cy - 22, 4, 0, Math.PI * 2); ctx.fill();
    }

    for (const f of fuegos) {
      const px = OX + f.x * T, py = OY + f.y * T;
      ctx.globalAlpha = Math.min(1, f.t / 0.3);
      ctx.fillStyle = '#ff6a00'; ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(px + 11, py + 11, T - 22, T - 22);
      ctx.globalAlpha = 1;
    }

    for (const e of enemigos) dibujarEnemigo(e);

    if (estado !== 'muerto' && !(jugador.inv > 0 && Math.floor(t * 12) % 2)) {
      const p = posicion(jugador);
      const cx = OX + (p.x + 0.5) * T, cy = OY + (p.y + 0.5) * T;
      dibujarNinoSol(ctx, cx - 13, cy - 16, 26, 36, jugador.dir, jugador.moviendo ? jugador.paso : 0);
    }
    part.dibujar(ctx);
    textos.dibujar(ctx);

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIDAS ' + vidas, 30, 26);
    ctx.fillText('TIEMPO ' + Math.ceil(tiempo), 190, 26);
    ctx.fillText('💣 ' + maxBombas + '   🔥 ' + rango, 420, 26);
    ctx.fillText('ENEMIGOS ' + enemigos.length, 640, 26);
    ctx.fillText(String(puntos).padStart(5, '0'), 860, 26);

    if (estado === 'gano') {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 230, 960, 80);
      ctx.textAlign = 'center';
      ctx.font = '22px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd45c';
      ctx.fillText('¡SALISTE DEL LABERINTO!', 480, 270);
      ctx.textAlign = 'left';
    }
  }

  return {
    emoji: '💣',
    titulo: 'Laberinto explosivo',
    recuerdo: 'Bombas, laberintos y escapadas por un pelo.',
    intro: 'Pon bombas para abrir camino y eliminar a todos los enemigos. Después encuentra la puerta escondida bajo uno de los bloques. ¡No te quedes cerca de tus propias bombas!',
    ayuda: 'Flechas / WASD mover · Espacio poner bomba',
    iniciar(c, a) {
      ctx = c; api = a; t = 0;
      bombas = []; fuegos = [];
      generar();
      part = new Particulas();
      textos = new TextosFlotantes();
      vidas = 3; maxBombas = 1; rango = 2; velJugador = 4.2; tiempo = 200; puntos = 0; avisoPuerta = false;
      revivir();
      jugador.inv = 0;
      parar = crearBucle(actualizar, dibujar);
    },
    detener() { if (parar) parar(); },
  };
})();
