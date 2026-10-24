// =====================================================
//  JUEGO 3: BATALLA DE TORRES (cartas y energía)
// =====================================================
Juegos.torres = (() => {
  const ANCHO = 960, ALTO = 540, ARENA = 440, RIO1 = 455, RIO2 = 505, CARRILES = [110, 330];
  const CARTAS = [
    { id: 'guerrero', nombre: 'Guerrero', emoji: '⚔️', costo: 3 },
    { id: 'arqueras', nombre: 'Arqueras', emoji: '🏹', costo: 3 },
    { id: 'gigante',  nombre: 'Gigante',  emoji: '🗿', costo: 5 },
    { id: 'lobos',    nombre: 'Manada',   emoji: '🐺', costo: 2 },
    { id: 'fuego',    nombre: 'Fuego',    emoji: '🔥', costo: 4 },
  ];
  const STATS = {
    guerrero: { vida: 650,  dano: 80,  rango: 26,  vel: 48, cadencia: 1.1, radio: 14, cantidad: 1, emoji: '⚔️' },
    arqueras: { vida: 260,  dano: 48,  rango: 150, vel: 48, cadencia: 1.0, radio: 11, cantidad: 2, emoji: '🏹', proyectil: true },
    gigante:  { vida: 2100, dano: 130, rango: 26,  vel: 32, cadencia: 1.5, radio: 20, cantidad: 1, emoji: '🗿', soloTorres: true },
    lobos:    { vida: 130,  dano: 42,  rango: 22,  vel: 85, cadencia: 0.9, radio: 9,  cantidad: 3, emoji: '🐺' },
  };
  const FORMACION = [[[0, 0]], [[-10, -8], [10, 8]], [[0, -12], [-11, 8], [11, 8]]];

  let ctx, api, parar, t;
  let torres, unidades, proyectiles, efectos, part, energia, energiaIA, tiempo, seleccion, iaReloj, estado, reloj, resultado, msgFin, mensaje;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const costoDe = id => CARTAS.find(c => c.id === id).costo;

  function crearTorres() {
    const t0 = (lado, tipo, x, y) => ({
      lado, tipo, x, y, esTorre: true,
      vida: tipo === 'rey' ? 2400 : 1400, max: tipo === 'rey' ? 2400 : 1400,
      rango: tipo === 'rey' ? 210 : 230, dano: tipo === 'rey' ? 70 : 50, cad: tipo === 'rey' ? 1 : 0.8,
      cd: 0, activa: tipo !== 'rey', radio: tipo === 'rey' ? 30 : 22, flash: 0,
    });
    return [
      t0(0, 'rey', 60, 220), t0(0, 'princesa', 170, 110), t0(0, 'princesa', 170, 330),
      t0(1, 'rey', 900, 220), t0(1, 'princesa', 790, 110), t0(1, 'princesa', 790, 330),
    ];
  }

  function avisar(txt) { mensaje = { txt, t: 1.8 }; }

  function crearUnidad(tipo, lado, x, y) {
    const s = STATS[tipo];
    for (const [ox, oy] of FORMACION[s.cantidad - 1]) {
      unidades.push({ ...s, tipo, lado, x: x + ox, y: y + oy, max: s.vida, cd: 0.4, listo: 0.8, obj: null, reevaluar: 0, golpeAnim: 0, flash: 0 });
    }
  }

  function lanzarFuego(lado, x, y) {
    const rey = torres.find(o => o.lado === lado && o.tipo === 'rey');
    efectos.push({ tipo: 'bola', lado, x: rey.x, y: rey.y, tx: x, ty: y });
  }

  function danar(o, d) {
    if (o.vida <= 0) return;
    o.vida -= d;
    o.flash = 0.1;
    if (o.vida <= 0) {
      o.vida = 0;
      if (o.esTorre) {
        Sonido.explosion();
        part.emitir(o.x, o.y, '#8a8a96', 30, 220, 300, 1, 6);
        avisar(o.lado === 1 ? '¡Torre enemiga destruida! 👑' : 'Perdiste una torre...');
      } else {
        part.emitir(o.x, o.y, '#ffffff', 8, 120, 0, 0.4, 4);
      }
    }
  }

  function buscarObjetivo(u) {
    if (!u.soloTorres) {
      let mejor = null, md = 170;
      for (const o of unidades) {
        if (o.lado !== u.lado && o.vida > 0 && o.listo <= 0) {
          const d = dist(u, o);
          if (d < md) { md = d; mejor = o; }
        }
      }
      if (mejor) return mejor;
    }
    let mejor = null, md = Infinity;
    for (const o of torres) {
      if (o.lado !== u.lado && o.vida > 0) {
        const d = dist(u, o);
        if (d < md) { md = d; mejor = o; }
      }
    }
    return mejor;
  }

  // Para cruzar el río hay que pasar por un puente
  function moverHacia(u, tx, ty, dt) {
    let wx = tx, wy = ty;
    const ladoU = u.x < 480 ? 0 : 1, ladoT = tx < 480 ? 0 : 1;
    if (ladoU !== ladoT) {
      const py = Math.abs(u.y - CARRILES[0]) < Math.abs(u.y - CARRILES[1]) ? CARRILES[0] : CARRILES[1];
      const entrada = ladoU === 0 ? RIO1 - 12 : RIO2 + 12;
      const salida = ladoU === 0 ? RIO2 + 14 : RIO1 - 14;
      const enPuente = Math.abs(u.y - py) < 10 && (ladoU === 0 ? u.x >= entrada - 4 : u.x <= entrada + 4);
      wx = enPuente ? salida : entrada;
      wy = py;
    }
    const dx = wx - u.x, dy = wy - u.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    const paso = Math.min(d, u.vel * dt);
    u.x += dx / d * paso;
    u.y += dy / d * paso;
  }

  function actualizarUnidad(u, dt) {
    if (u.vida <= 0) return;
    if (u.flash > 0) u.flash -= dt;
    if (u.golpeAnim > 0) u.golpeAnim -= dt;
    if (u.listo > 0) { u.listo -= dt; return; }
    if (!u.obj || u.obj.vida <= 0 || t > u.reevaluar) {
      u.obj = buscarObjetivo(u);
      u.reevaluar = t + 0.4;
    }
    const o = u.obj;
    if (!o) return;
    const d = dist(u, o) - (o.radio || 12) - u.radio;
    if (d <= u.rango) {
      u.cd -= dt;
      if (u.cd <= 0) {
        u.cd = u.cadencia;
        u.golpeAnim = 0.15;
        if (u.proyectil) proyectiles.push({ x: u.x, y: u.y, obj: o, dano: u.dano, vel: 480, color: '#fff2a8' });
        else { danar(o, u.dano); part.emitir(o.x + azar(-6, 6), o.y + azar(-6, 6), '#fff', 3, 80, 0, 0.25, 3); }
      }
    } else {
      moverHacia(u, o.x, o.y, dt);
    }
  }

  function separar() {
    for (let i = 0; i < unidades.length; i++) {
      for (let k = i + 1; k < unidades.length; k++) {
        const a = unidades[i], b = unidades[k];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        const min = a.radio + b.radio;
        if (d < min) {
          const emp = (min - d) / 2;
          const wa = b.radio / min, wb = a.radio / min;
          a.x -= dx / d * emp * wa * 2; a.y -= dy / d * emp * wa * 2;
          b.x += dx / d * emp * wb * 2; b.y += dy / d * emp * wb * 2;
        }
      }
    }
    for (const u of unidades) u.y = Math.max(12, Math.min(ARENA - 12, u.y));
  }

  function coronasDe(lado) {
    // coronas que ganó "lado" = torres destruidas del otro lado
    return torres.filter(o => o.lado !== lado && o.vida <= 0).length;
  }

  function terminar(res, msg) {
    if (estado === 'fin') return;
    estado = 'fin';
    resultado = res;
    msgFin = msg;
    reloj = 2.5;
    if (res === 'gana') Sonido.victoria(); else Sonido.muerte();
  }

  function entrada() {
    const p = Entrada.presionadas;
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((k, i) => { if (p[k]) { seleccion = seleccion === i ? -1 : i; Sonido.click(); } });
    for (const c of Entrada.tomarClicks()) {
      if (c.y >= ARENA) {
        const i = Math.floor((c.x - 20) / 122);
        if (i >= 0 && i < CARTAS.length && c.x - 20 - i * 122 < 112) { seleccion = seleccion === i ? -1 : i; Sonido.click(); }
        continue;
      }
      if (seleccion < 0) { avisar('Primero elige una carta abajo'); continue; }
      const carta = CARTAS[seleccion];
      if (energia < carta.costo) { avisar('No tienes suficiente energía ⚡'); Sonido.error(); continue; }
      if (carta.id === 'fuego') {
        lanzarFuego(0, c.x, c.y);
      } else {
        if (c.x > RIO1 - 10 || c.y < 15 || c.y > ARENA - 15) { avisar('Solo puedes desplegar en tu lado'); Sonido.error(); continue; }
        crearUnidad(carta.id, 0, c.x, c.y);
      }
      energia -= carta.costo;
      Sonido.desplegar();
    }
  }

  function ia(dt) {
    iaReloj -= dt;
    if (iaReloj > 0) return;
    iaReloj = azar(0.9, 2.2);
    const amenazas = unidades.filter(u => u.lado === 0 && u.x > 380);
    if (amenazas.length) {
      const a = amenazas.reduce((m, u) => (u.x > m.x ? u : m));
      const grupo = unidades.filter(u => u.lado === 0 && dist(u, a) < 75).length;
      if (grupo >= 3 && energiaIA >= 4 && Math.random() < 0.5) { lanzarFuego(1, a.x, a.y); energiaIA -= 4; return; }
      const op = ['guerrero', 'arqueras', 'lobos'][Math.floor(Math.random() * 3)];
      if (energiaIA >= costoDe(op)) {
        crearUnidad(op, 1, Math.max(RIO2 + 30, Math.min(900, a.x + 90)), Math.max(30, Math.min(410, a.y)));
        energiaIA -= costoDe(op);
      }
      return;
    }
    if (energiaIA >= 8 || (energiaIA >= 5 && Math.random() < 0.25)) {
      const op = ['guerrero', 'arqueras', 'gigante', 'lobos'][Math.floor(Math.random() * 4)];
      if (energiaIA < costoDe(op)) return;
      const carril = CARRILES[Math.random() < 0.5 ? 0 : 1];
      crearUnidad(op, 1, op === 'gigante' ? 860 : 820, carril + azar(-25, 25));
      energiaIA -= costoDe(op);
    }
  }

  // ---------- Actualización ----------
  function actualizar(dt) {
    t += dt;
    part.actualizar(dt);
    if (mensaje) { mensaje.t -= dt; if (mensaje.t <= 0) mensaje = null; }
    for (const e of efectos) if (e.tipo === 'boom') e.t -= dt;

    if (estado === 'fin') {
      reloj -= dt;
      if (reloj <= 0) { if (resultado === 'gana') api.ganar(); else api.perder(msgFin); }
      return;
    }

    tiempo -= dt;
    const mult = tiempo <= 60 ? 2 : 1;
    energia = Math.min(10, energia + dt / 2.8 * mult);
    energiaIA = Math.min(10, energiaIA + dt / 3.6 * mult);

    entrada();
    ia(dt);

    for (const lado of [0, 1]) {
      const rey = torres.find(o => o.lado === lado && o.tipo === 'rey');
      if (!rey.activa && (rey.vida < rey.max || torres.some(o => o.lado === lado && o.tipo === 'princesa' && o.vida <= 0))) rey.activa = true;
    }

    for (const to of torres) {
      if (to.flash > 0) to.flash -= dt;
      if (to.vida <= 0 || !to.activa) continue;
      to.cd -= dt;
      if (to.cd > 0) continue;
      let obj = null, md = to.rango;
      for (const u of unidades) {
        if (u.lado !== to.lado && u.vida > 0) {
          const d = dist(to, u);
          if (d < md) { md = d; obj = u; }
        }
      }
      if (obj) {
        to.cd = to.cad;
        proyectiles.push({ x: to.x, y: to.y - 20, obj, dano: to.dano, vel: 520, color: to.lado === 0 ? '#9fd3ff' : '#ffb0a0' });
      }
    }

    for (const u of unidades) actualizarUnidad(u, dt);
    separar();

    for (const p of proyectiles) {
      const o = p.obj;
      if (o.vida <= 0) { p.muerto = true; continue; }
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
      if (d < 10) { danar(o, p.dano); p.muerto = true; }
      else { p.x += dx / d * p.vel * dt; p.y += dy / d * p.vel * dt; }
    }
    proyectiles = proyectiles.filter(p => !p.muerto);

    for (const e of efectos) {
      if (e.tipo !== 'bola') continue;
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      const paso = 650 * dt;
      if (d <= paso) {
        e.muerto = true;
        efectos.push({ tipo: 'boom', x: e.tx, y: e.ty, t: 0.4 });
        Sonido.explosion();
        part.emitir(e.tx, e.ty, '#ff8c1a', 26, 220, 100, 0.7, 6);
        for (const u of unidades) if (u.lado !== e.lado && dist(u, { x: e.tx, y: e.ty }) < 70) danar(u, 320);
        for (const o of torres) if (o.lado !== e.lado && dist(o, { x: e.tx, y: e.ty }) < 70 + o.radio) danar(o, 110);
      } else {
        e.x += dx / d * paso;
        e.y += dy / d * paso;
      }
    }
    efectos = efectos.filter(e => !e.muerto && !(e.tipo === 'boom' && e.t <= 0));
    unidades = unidades.filter(u => u.vida > 0);

    const reyJ = torres[0], reyIA = torres[3];
    if (reyIA.vida <= 0) terminar('gana', '');
    else if (reyJ.vida <= 0) terminar('pierde', 'Cayó tu torre del rey... ¡revancha!');
    else if (tiempo <= 0) {
      tiempo = 0;
      const cj = coronasDe(0), ci = coronasDe(1);
      if (cj > ci) terminar('gana', '');
      else terminar('pierde', cj === ci ? '¡Empate! Necesitas destruir más torres que el rival.' : 'El rival destruyó más torres que tú...');
    }
  }

  // ---------- Dibujo ----------
  function barra(x, y, w, frac, color) {
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, frac), 5);
  }

  function dibujarTorre(o) {
    const col = o.lado === 0 ? '#2f6fd6' : '#d63a3a';
    if (o.vida <= 0) {
      ctx.fillStyle = '#6d6d78';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(o.x + Math.cos(i * 2.1) * 14, o.y + Math.sin(i * 1.7) * 10, 8, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    const s = o.tipo === 'rey' ? 30 : 22;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(o.x, o.y + s, s + 4, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.flash > 0 ? '#fff' : '#9a9aa8';
    ctx.fillRect(o.x - s, o.y - s, s * 2, s * 2);
    ctx.fillStyle = '#7a7a88';
    for (let i = 0; i < 4; i++) ctx.fillRect(o.x - s + i * (s / 2) + 2, o.y - s - 7, s / 4, 7);
    ctx.fillStyle = col;
    ctx.fillRect(o.x - s + 5, o.y - s + 5, s * 2 - 10, s * 2 - 10);
    ctx.font = (o.tipo === 'rey' ? 26 : 18) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.tipo === 'rey' ? '👑' : '🏹', o.x, o.y + 2);
    barra(o.x - s, o.y - s - 18, s * 2, o.vida / o.max, o.lado === 0 ? '#5fb0ff' : '#ff6b6b');
    if (o.tipo === 'rey' && !o.activa) {
      ctx.fillStyle = '#fff'; ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('zzz', o.x + s, o.y - s - 26 + Math.sin(t * 2) * 3);
    }
  }

  function dibujarUnidad(u) {
    const col = u.lado === 0 ? '#3d7fe6' : '#e64a4a';
    const bob = u.listo > 0 ? 0 : Math.sin(t * 10 + u.x) * 1.5;
    const golpe = u.golpeAnim > 0 ? 3 : 0;
    ctx.globalAlpha = u.listo > 0 ? 0.55 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(u.x, u.y + u.radio, u.radio, u.radio * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.flash > 0 ? '#fff' : col;
    ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.radio + golpe * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = Math.round(u.radio * 1.3) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.emoji, u.x, u.y + bob + 1);
    ctx.globalAlpha = 1;
    if (u.vida < u.max) barra(u.x - u.radio, u.y - u.radio - 9, u.radio * 2, u.vida / u.max, u.lado === 0 ? '#5fb0ff' : '#ff6b6b');
  }

  function dibujar() {
    for (let y = 0; y < ARENA; y += 40) {
      for (let x = 0; x < ANCHO; x += 40) {
        ctx.fillStyle = ((x + y) / 40) % 2 ? '#6cc24a' : '#62b843';
        ctx.fillRect(x, y, 40, 40);
      }
    }
    ctx.fillStyle = '#d2bb85';
    for (const cy of CARRILES) ctx.fillRect(140, cy - 14, 680, 28);
    ctx.fillStyle = '#3d9be0';
    ctx.fillRect(RIO1, 0, RIO2 - RIO1, ARENA);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let y = (t * 30) % 30 - 30; y < ARENA; y += 30) {
      ctx.beginPath(); ctx.moveTo(RIO1 + 10, y); ctx.lineTo(RIO1 + 22, y + 8); ctx.lineTo(RIO1 + 34, y); ctx.stroke();
    }
    for (const cy of CARRILES) {
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(RIO1 - 8, cy - 24, RIO2 - RIO1 + 16, 48);
      ctx.fillStyle = '#6a4220';
      for (let x = RIO1 - 4; x < RIO2 + 8; x += 10) ctx.fillRect(x, cy - 24, 2, 48);
    }
    if (seleccion >= 0 && CARTAS[seleccion].id !== 'fuego') {
      ctx.fillStyle = 'rgba(255,0,0,.13)';
      ctx.fillRect(RIO1 - 10, 0, ANCHO - RIO1 + 10, ARENA);
    }

    for (const o of torres) dibujarTorre(o);
    [...unidades].sort((a, b) => a.y - b.y).forEach(dibujarUnidad);

    for (const p of proyectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of efectos) {
      if (e.tipo === 'bola') {
        ctx.fillStyle = '#ff7a1a';
        ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, e.t / 0.4);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.arc(e.x, e.y, 70 * (1.2 - e.t), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    part.dibujar(ctx);

    // vista previa del despliegue
    const m = Entrada.mouse;
    if (seleccion >= 0 && m.y < ARENA && m.x > 0) {
      const esFuego = CARTAS[seleccion].id === 'fuego';
      const valido = esFuego || m.x < RIO1 - 10;
      ctx.strokeStyle = valido ? 'rgba(255,255,255,.8)' : 'rgba(255,60,60,.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(m.x, m.y, esFuego ? 70 : 18, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // tiempo y coronas
    const seg = Math.max(0, Math.ceil(tiempo));
    rectRedondo(ctx, ANCHO / 2 - 80, 8, 160, 34, 10);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
    ctx.fillStyle = tiempo <= 60 ? '#ffd45c' : '#fff';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'), ANCHO / 2, 26);
    ctx.fillStyle = '#9fd3ff'; ctx.fillText('👑 ' + coronasDe(0), 60, 26);
    ctx.fillStyle = '#ffb0a0'; ctx.fillText(coronasDe(1) + ' 👑', ANCHO - 60, 26);
    if (tiempo <= 60 && estado !== 'fin') {
      ctx.fillStyle = '#ffd45c'; ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('¡ENERGÍA x2!', ANCHO / 2, 54);
    }

    // barra de cartas
    ctx.fillStyle = '#2a1f4f'; ctx.fillRect(0, ARENA, ANCHO, ALTO - ARENA);
    CARTAS.forEach((c, i) => {
      const x = 20 + i * 122, y = ARENA + 12, w = 112, h = 76;
      const puede = energia >= c.costo;
      rectRedondo(ctx, x, y, w, h, 10);
      ctx.fillStyle = seleccion === i ? '#ffd45c' : '#4a3a8a';
      ctx.fill();
      ctx.globalAlpha = puede ? 1 : 0.4;
      ctx.font = '30px serif';
      ctx.fillText(c.emoji, x + w / 2, y + 30);
      ctx.fillStyle = seleccion === i ? '#2a1800' : '#fff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(c.nombre, x + w / 2, y + 62);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c03ad8';
      ctx.beginPath(); ctx.arc(x + 12, y + 12, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText(c.costo, x + 12, y + 13);
    });
    const ex = 650, ey = ARENA + 36, ew = 290, eh = 26;
    ctx.fillStyle = '#15102e'; ctx.fillRect(ex, ey, ew, eh);
    ctx.fillStyle = '#d04fe0'; ctx.fillRect(ex, ey, ew * energia / 10, eh);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 1; i < 10; i++) ctx.fillRect(ex + i * ew / 10, ey, 2, eh);
    ctx.fillStyle = '#fff'; ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText('⚡ ' + Math.floor(energia), ex + ew / 2, ey + eh / 2 + 1);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('ENERGÍA', ex + ew / 2, ey - 12);

    if (mensaje) {
      ctx.globalAlpha = Math.min(1, mensaje.t * 2);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(ANCHO / 2 - 270, 380, 540, 36);
      ctx.fillStyle = '#fff'; ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText(mensaje.txt, ANCHO / 2, 399);
      ctx.globalAlpha = 1;
    }
    if (estado === 'fin') {
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, ANCHO, ARENA);
      ctx.font = '30px "Press Start 2P", monospace';
      ctx.fillStyle = resultado === 'gana' ? '#ffd45c' : '#ff8a8a';
      ctx.fillText(resultado === 'gana' ? '¡VICTORIA!' : 'DERROTA', ANCHO / 2, ARENA / 2);
    }
    ctx.textAlign = 'left';
  }

  return {
    emoji: '⚔️',
    titulo: 'Batalla de torres',
    recuerdo: 'Cartas, estrategia y mucha energía.',
    intro: 'Elige una carta y luego toca tu lado del campo para desplegarla. La energía se recarga sola. Destruye la torre del rey rival, o más torres que él antes de que acaben los 3 minutos.',
    ayuda: 'Clic en una carta (o teclas 1-5) y después clic en tu lado del campo · El fuego se puede lanzar a cualquier parte',
    iniciar(c, a) {
      ctx = c; api = a; t = 0;
      torres = crearTorres();
      unidades = []; proyectiles = []; efectos = [];
      part = new Particulas();
      energia = 5; energiaIA = 4; tiempo = 180; seleccion = -1; iaReloj = 4;
      estado = 'jugando'; mensaje = { txt: '¡Elige una carta para empezar!', t: 3 };
      parar = crearBucle(actualizar, dibujar);
    },
    detener() { if (parar) parar(); },
  };
})();
