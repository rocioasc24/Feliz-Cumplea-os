// =====================================================
//  JUEGO 2: LA DIMENSIÓN FINAL (bloques)
//  El dragón no está... pero dejó su huevo. Hay que romperlo.
// =====================================================
Juegos.dimension = (() => {
  const T = 32, FILAS = 17, COLS = 86, ANCHO = 960, ALTO = 540;
  const ALCANCE = 4.6 * T;
  const SOLIDOS = 'PC';
  const INICIO = { x: 3 * T, y: 11 * T - 54 };
  let ctx, api, parar, t;
  let mapa, dureza, jugador, sombras, part, textos, camX, corazones, bloques, modo, huevo;
  let spawn, estado, reloj, seguro, estrellas, aviso, brazo;

  // ---------- Mundo ----------
  function isla(x1, x2, top) {
    for (let x = x1; x <= x2; x++) { mapa[top][x] = 'P'; mapa[top + 1][x] = 'P'; }
    for (let x = x1 + 1; x <= x2 - 1; x++) mapa[top + 2][x] = 'P';
    for (let x = x1 + 3; x <= x2 - 3; x++) mapa[top + 3][x] = 'P';
  }
  function pilar(x, top, alto) { for (let i = 1; i <= alto; i++) mapa[top - i][x] = 'C'; }

  function construir() {
    mapa = Array.from({ length: FILAS }, () => Array(COLS).fill(' '));
    isla(1, 14, 11); pilar(11, 11, 4);
    isla(24, 29, 12);
    isla(40, 52, 10); pilar(46, 10, 5);
    isla(63, 80, 11); pilar(66, 11, 3); pilar(78, 11, 3);
    dureza = Array.from({ length: FILAS }, () => Array(COLS).fill(0));
    huevo = { x: 72 * T + 2, y: 11 * T - 40, w: 28, h: 40, vida: 15, max: 15, temblor: 0 };
    estrellas = [];
    for (let i = 0; i < 160; i++) estrellas.push({ x: Math.random() * (ANCHO + COLS * T * 0.2), y: Math.random() * ALTO, b: Math.random() * 6 });
  }

  function solido(tx, ty) {
    if (tx < 0 || tx >= COLS) return true;
    if (ty < 0 || ty >= FILAS) return false;
    return SOLIDOS.includes(mapa[ty][tx]);
  }

  function mover(e, dt) {
    e.x += e.vx * dt;
    const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) if (solido(tx, ty)) { e.x = tx * T - e.w; break; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / T);
      for (let ty = y0; ty <= y1; ty++) if (solido(tx, ty)) { e.x = (tx + 1) * T; break; }
    }
    e.y += e.vy * dt;
    e.enSuelo = false;
    const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / T);
      for (let tx = x0; tx <= x1; tx++) if (solido(tx, ty)) { e.y = ty * T - e.h; e.vy = 0; e.enSuelo = true; break; }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / T);
      for (let tx = x0; tx <= x1; tx++) if (solido(tx, ty)) { e.y = (ty + 1) * T; e.vy = 0; break; }
    }
  }

  // ---------- Acciones ----------
  function picar(tx, ty) {
    const necesita = mapa[ty][tx] === 'C' ? 4 : 2;
    dureza[ty][tx]++;
    const cx = tx * T + T / 2, cy = ty * T + T / 2;
    if (dureza[ty][tx] >= necesita) {
      part.emitir(cx, cy, mapa[ty][tx] === 'C' ? '#5b2a8a' : '#cbbde6', 12, 160, 700, 0.7, 5);
      mapa[ty][tx] = ' ';
      dureza[ty][tx] = 0;
      bloques++;
      Sonido.romper();
    } else {
      part.emitir(cx, cy, '#e4dbf5', 4, 90, 500, 0.4, 3);
      Sonido.golpe();
    }
  }

  function colocar(tx, ty) {
    if (bloques <= 0) { textos.agregar(Entrada.mouse.x + camX, Entrada.mouse.y - 10, 'Sin bloques: pica alguno', '#ff9a9a', 1.2); Sonido.error(); return; }
    const vecino = solido(tx - 1, ty) && tx - 1 >= 0 || solido(tx + 1, ty) && tx + 1 < COLS || solido(tx, ty - 1) || solido(tx, ty + 1);
    if (!vecino) { textos.agregar(tx * T + T / 2, ty * T, 'Debe tocar otro bloque', '#ff9a9a', 1.2); Sonido.error(); return; }
    if (choque(jugador, { x: tx * T, y: ty * T, w: T, h: T })) return;
    mapa[ty][tx] = 'P';
    bloques--;
    Sonido.poner();
  }

  function golpearHuevo() {
    huevo.vida--;
    huevo.temblor = 0.25;
    Sonido.golpe();
    part.emitir(huevo.x + huevo.w / 2, huevo.y + huevo.h / 2, '#ffb84d', 8, 160, 400, 0.6, 4);
    if (huevo.vida === huevo.max - 1) textos.agregar(huevo.x + 14, huevo.y - 20, '¡Las sombras despertaron!', '#e070ff', 2);
    if (huevo.vida <= 0) {
      estado = 'ganado';
      reloj = 3;
      Sonido.victoria();
      part.emitir(huevo.x + 14, huevo.y + 20, '#ffd45c', 60, 380, 200, 1.6, 6);
      part.emitir(huevo.x + 14, huevo.y + 20, '#ff6a2b', 40, 300, 200, 1.4, 5);
      for (const s of sombras) part.emitir(s.x + 15, s.y + 15, '#b04aff', 10, 160, 0, 0.8, 5);
      sombras = [];
    }
  }

  function herir(n) {
    corazones -= n;
    jugador.inv = 1.2;
    Sonido.dano();
    if (corazones <= 0) { corazones = 0; estado = 'perdido'; reloj = 1.5; }
  }

  // ---------- Actualización ----------
  function actualizar(dt) {
    t += dt;
    part.actualizar(dt);
    textos.actualizar(dt);
    if (aviso > 0) aviso -= dt;
    if (brazo > 0) brazo -= dt;
    if (huevo.temblor > 0) huevo.temblor -= dt;

    if (estado === 'ganado') {
      reloj -= dt;
      if (Math.random() < 0.3) part.emitir(huevo.x + 14 + azar(-60, 60), huevo.y + azar(-80, 10), '#ffd45c', 6, 120, -60, 1, 4);
      if (reloj <= 0) api.ganar();
      return;
    }
    if (estado === 'perdido') {
      reloj -= dt;
      if (reloj <= 0) api.perder('Las sombras te ganaron esta vez... ¡construye más rápido y golpéalas con clic!');
      return;
    }

    const k = Entrada.teclas, p = Entrada.presionadas, j = jugador;
    if (p.KeyQ) { modo = modo === 'picar' ? 'construir' : 'picar'; Sonido.click(); }

    let vx = 0;
    if (k.ArrowLeft || k.KeyA) vx -= 170;
    if (k.ArrowRight || k.KeyD) vx += 170;
    if (vx) j.dir = Math.sign(vx);
    j.empuje *= Math.pow(0.02, dt);
    j.vx = vx + j.empuje;
    if ((p.Space || p.ArrowUp || p.KeyW) && j.enSuelo) { j.vy = -560; Sonido.salto(); }
    j.vy = Math.min(j.vy + 1800 * dt, 800);
    mover(j, dt);
    if (j.enSuelo) seguro = { x: j.x, y: j.y };
    if (j.inv > 0) j.inv -= dt;

    // caída al vacío
    if (j.y > FILAS * T + 60) {
      herir(2);
      if (estado !== 'jugando') return;
      const bajo = solido(Math.floor((seguro.x + j.w / 2) / T), Math.floor((seguro.y + j.h + 2) / T));
      const destino = bajo ? seguro : INICIO;
      j.x = destino.x; j.y = destino.y - 2; j.vy = 0; j.empuje = 0;
      textos.agregar(j.x + 10, j.y - 10, '-2 ❤', '#ff6b6b', 1.2);
    }

    // clics: atacar sombras, golpear el huevo, picar o poner bloques
    for (const c of Entrada.tomarClicks()) {
      const wx = c.x + camX, wy = c.y;
      const cx = j.x + j.w / 2, cy = j.y + 16;
      const dist = Math.hypot(wx - cx, wy - cy);
      brazo = 0.25;

      let atendido = false;
      for (const s of sombras) {
        if (wx > s.x - 4 && wx < s.x + s.w + 4 && wy > s.y - 4 && wy < s.y + s.h + 4) {
          atendido = true;
          if (dist <= ALCANCE) {
            s.vida--;
            s.golpe = 0.15;
            s.vx = Math.sign(s.x - cx || 1) * 260;
            Sonido.golpe();
            part.emitir(s.x + 15, s.y + 15, '#b04aff', 6, 140, 0, 0.5, 4);
            if (s.vida <= 0) {
              bloques += 2;
              textos.agregar(s.x + 15, s.y, '+2 bloques', '#cbbde6', 1);
              part.emitir(s.x + 15, s.y + 15, '#e070ff', 16, 200, 0, 0.8, 5);
            }
          } else textos.agregar(wx, wy - 10, 'Muy lejos', '#ff9a9a', 0.8);
          break;
        }
      }
      if (atendido) continue;

      if (huevo.vida > 0 && wx > huevo.x - 6 && wx < huevo.x + huevo.w + 6 && wy > huevo.y - 6 && wy < huevo.y + huevo.h + 6) {
        if (dist <= ALCANCE + T) golpearHuevo();
        else textos.agregar(wx, wy - 10, 'Acércate más', '#ff9a9a', 0.8);
        continue;
      }

      const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= FILAS) continue;
      if (Math.hypot(tx * T + T / 2 - cx, ty * T + T / 2 - cy) > ALCANCE) { textos.agregar(wx, wy - 10, 'Muy lejos', '#ff9a9a', 0.8); continue; }
      const construirAqui = c.boton === 2 || modo === 'construir';
      if (!construirAqui && mapa[ty][tx] !== ' ') picar(tx, ty);
      else if (construirAqui && mapa[ty][tx] === ' ') colocar(tx, ty);
    }
    if (estado !== 'jugando') return;

    // sombras enemigas
    const despierto = huevo.vida < huevo.max;
    spawn -= dt;
    if (spawn <= 0 && sombras.length < (despierto ? 6 : 4)) {
      spawn = despierto ? 2.8 : 4.5;
      const izq = Math.random() < 0.5;
      sombras.push({ x: camX + (izq ? -40 : ANCHO + 10), y: azar(60, 380), w: 30, h: 30, vida: 3, vx: 0, vy: 0, golpe: 0, fase: Math.random() * 6 });
    }
    for (const s of sombras) {
      const dx = j.x + j.w / 2 - (s.x + s.w / 2), dy = j.y + 20 - (s.y + s.h / 2), d = Math.hypot(dx, dy) || 1;
      const vel = 75;
      s.vx += ((dx / d) * vel - s.vx) * Math.min(1, dt * 2);
      s.vy += ((dy / d) * vel - s.vy) * Math.min(1, dt * 2);
      s.x += s.vx * dt;
      s.y += (s.vy + Math.sin(t * 3 + s.fase) * 30) * dt;
      if (s.golpe > 0) s.golpe -= dt;
      if (j.inv <= 0 && s.vida > 0 && choque(j, s)) {
        herir(1);
        j.empuje = -Math.sign(dx || 1) * 320;
        j.vy = -300;
        s.vx = Math.sign(dx || 1) * -200;
        if (estado !== 'jugando') return;
      }
    }
    sombras = sombras.filter(s => s.vida > 0);

    camX = Math.max(0, Math.min(j.x - ANCHO / 2, COLS * T - ANCHO));
  }

  // ---------- Dibujo ----------
  function dibujarPersonaje() {
    const j = jugador;
    if (j.inv > 0 && Math.floor(t * 14) % 2) return;
    const x = j.x, y = j.y;
    const caminar = j.enSuelo && Math.abs(j.vx) > 5 ? Math.sin(t * 12) * 4 : 0;
    ctx.fillStyle = '#34345e';
    ctx.fillRect(x + 3 + caminar, y + 36, 7, 18);
    ctx.fillRect(x + 11 - caminar, y + 36, 7, 18);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(x, y + 17, 20, 20);
    ctx.fillStyle = '#e8b98a';
    ctx.fillRect(x + 1, y, 18, 17);
    ctx.fillStyle = '#4a2f17';
    ctx.fillRect(x + 1, y, 18, 5);
    ctx.fillStyle = '#222';
    ctx.fillRect(j.dir > 0 ? x + 13 : x + 4, y + 8, 3, 3);
    // brazo con herramienta
    const hx = x + 10, hy = y + 20;
    const ang = brazo > 0 ? -1.6 + (0.25 - brazo) * 8 : -0.2;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(j.dir, 1);
    ctx.rotate(ang);
    ctx.fillStyle = '#e8b98a';
    ctx.fillRect(-3, 0, 6, 16);
    if (modo === 'picar') {
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(-1, 12, 3, 14);
      ctx.fillStyle = '#9fe6ff'; ctx.fillRect(-8, 24, 18, 4);
    } else {
      ctx.fillStyle = '#cbbde6'; ctx.fillRect(-6, 14, 12, 12);
    }
    ctx.restore();
  }

  function dibujarSombra(s) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = s.golpe > 0 ? '#ffffff' : '#2a0f45';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#5d1f8f';
    ctx.fillRect(s.x + 3, s.y + 3, s.w - 6, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f07bff';
    ctx.shadowColor = '#f07bff';
    ctx.shadowBlur = 10;
    ctx.fillRect(s.x + 6, s.y + 11, 6, 4);
    ctx.fillRect(s.x + 18, s.y + 11, 6, 4);
    ctx.restore();
  }

  function dibujarHuevo() {
    if (huevo.vida <= 0) return;
    const sx = huevo.temblor > 0 ? Math.sin(t * 80) * 3 : 0;
    const cx = huevo.x + huevo.w / 2 + sx, cy = huevo.y + huevo.h / 2;
    const brillo = 18 + Math.sin(t * 3) * 8;
    ctx.save();
    ctx.shadowColor = '#ff7a2b';
    ctx.shadowBlur = brillo;
    const g = ctx.createRadialGradient(cx - 5, cy - 8, 3, cx, cy, 24);
    g.addColorStop(0, '#c4381f'); g.addColorStop(1, '#3b0d0d');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, 14, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffcf5a';
    [[-6, -8], [5, -3], [-3, 6], [7, 10], [-8, 12]].forEach(([a, b]) => ctx.fillRect(cx + a, cy + b, 3, 3));
    const grietas = Math.floor((1 - huevo.vida / huevo.max) * 6);
    ctx.strokeStyle = '#ffd45c'; ctx.lineWidth = 2;
    for (let i = 0; i < grietas; i++) {
      const a = i * 1.1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 9);
      ctx.lineTo(cx + Math.cos(a + 0.4) * 12, cy + Math.sin(a + 0.4) * 17);
      ctx.stroke();
    }
    if (huevo.vida < huevo.max) {
      ctx.fillStyle = '#000'; ctx.fillRect(huevo.x - 10, huevo.y - 14, 48, 6);
      ctx.fillStyle = '#ffb84d'; ctx.fillRect(huevo.x - 10, huevo.y - 14, 48 * huevo.vida / huevo.max, 6);
    }
  }

  function dibujar() {
    const g = ctx.createLinearGradient(0, 0, 0, ALTO);
    g.addColorStop(0, '#07030f'); g.addColorStop(1, '#1d0d36');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);
    for (const s of estrellas) {
      ctx.globalAlpha = 0.4 + Math.sin(t * 2 + s.b) * 0.3;
      ctx.fillStyle = '#e8dcff';
      ctx.fillRect(s.x - camX * 0.2, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#160a29';
    for (let i = 0; i < 6; i++) {
      const x = i * 520 - camX * 0.4 + 200;
      ctx.beginPath(); ctx.ellipse(x, 470 - (i % 2) * 60, 140, 24, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.save();
    ctx.translate(-Math.round(camX), 0);
    const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(COLS - 1, c0 + Math.ceil(ANCHO / T) + 1);
    for (let y = 0; y < FILAS; y++) {
      for (let x = c0; x <= c1; x++) {
        const c = mapa[y][x];
        if (c === ' ') continue;
        const px = x * T, py = y * T;
        if (c === 'P') {
          ctx.fillStyle = '#cbbde6'; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = '#a898c9';
          ctx.fillRect(px + ((x * 5 + y * 3) % 5) * 5 + 3, py + 8, 4, 4);
          ctx.fillRect(px + ((x * 3 + y * 7) % 4) * 6 + 5, py + 20, 5, 4);
          if (y === 0 || mapa[y - 1][x] === ' ') { ctx.fillStyle = '#e8e0f7'; ctx.fillRect(px, py, T, 4); }
        } else {
          ctx.fillStyle = '#24123a'; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = '#5b2a8a'; ctx.fillRect(px + 6, py + 6, 5, 5); ctx.fillRect(px + 19, py + 18, 4, 4);
        }
        if (dureza[y][x] > 0) {
          ctx.strokeStyle = '#2a1840'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + 16, py + 14); ctx.lineTo(px + 26, py + 10);
          ctx.moveTo(px + 16, py + 14); ctx.lineTo(px + 14, py + 26);
          ctx.stroke();
        }
      }
    }

    // casilla bajo el puntero
    const mx = Entrada.mouse.x + camX, my = Entrada.mouse.y;
    const htx = Math.floor(mx / T), hty = Math.floor(my / T);
    const enRango = Math.hypot(htx * T + T / 2 - (jugador.x + jugador.w / 2), hty * T + T / 2 - (jugador.y + 16)) <= ALCANCE;
    ctx.strokeStyle = enRango ? 'rgba(255,255,255,.8)' : 'rgba(255,90,90,.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(htx * T + 1, hty * T + 1, T - 2, T - 2);

    dibujarHuevo();
    dibujarPersonaje();
    for (const s of sombras) dibujarSombra(s);
    part.dibujar(ctx);
    textos.dibujar(ctx);
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, ANCHO, 44);
    for (let i = 0; i < 6; i++) dibujarCorazon(ctx, 22 + i * 26, 12, 20, i < corazones ? '#ff3b5c' : '#3a2a40');
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('BLOQUES ' + bloques, 190, 23);
    ctx.fillText('MODO: ' + (modo === 'picar' ? 'PICAR' : 'CONSTRUIR') + ' (Q)', 360, 23);
    ctx.fillStyle = '#ffb84d';
    ctx.fillText('HUEVO ' + huevo.vida + '/' + huevo.max, 760, 23);

    if (aviso > 0) {
      ctx.globalAlpha = Math.min(1, aviso);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8dcff';
      ctx.font = '15px "Press Start 2P", monospace';
      ctx.fillText('El dragón no está... pero dejó su huevo.', ANCHO / 2, 110);
      ctx.fillStyle = '#ffb84d';
      ctx.fillText('Cruza las islas y rómpelo →', ANCHO / 2, 145);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
    if (estado === 'ganado') {
      ctx.textAlign = 'center';
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd45c';
      ctx.fillText('¡ROMPISTE EL HUEVO!', ANCHO / 2, 200);
      ctx.textAlign = 'left';
    }
  }

  return {
    emoji: '🥚',
    titulo: 'La dimensión final',
    recuerdo: 'Picar bloques hasta llegar al fin del mundo.',
    intro: 'Llegaste a la dimensión final. El dragón no está... pero dejó su huevo en la isla más lejana. Construye puentes con bloques, defiéndete de las sombras y rompe el huevo (15 golpes).',
    ayuda: 'A D mover · W / Espacio saltar · Clic izq: picar o atacar · Clic der: poner bloque · Q: cambiar modo',
    iniciar(c, a) {
      ctx = c; api = a; t = 0;
      construir();
      jugador = { x: INICIO.x, y: INICIO.y, w: 20, h: 54, vx: 0, vy: 0, enSuelo: false, dir: 1, inv: 0, empuje: 0 };
      seguro = { ...INICIO };
      sombras = [];
      part = new Particulas();
      textos = new TextosFlotantes();
      corazones = 6; bloques = 20; modo = 'picar';
      spawn = 6; estado = 'jugando'; aviso = 5; brazo = 0; camX = 0;
      parar = crearBucle(actualizar, dibujar);
    },
    detener() { if (parar) parar(); },
  };
})();
