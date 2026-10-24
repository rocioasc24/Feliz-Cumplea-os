// =====================================================
//  JUEGO 5: CACERÍA DE PATOS
//  Si un pato se escapa, el mapache sale a reírse de ti.
// =====================================================
Juegos.patos = (() => {
  const ANCHO = 960, ALTO = 540, PISO = 440, TOTAL = 10, META = 6;
  let ctx, api, parar, t;
  let pato, n, aciertos, balas, puntos, mapache, estado, reloj, destello, part, juncos;

  function nuevoPato() {
    const vel = 190 + n * 18;
    const ang = azar(-2.4, -0.7);
    pato = { x: azar(200, 760), y: 400, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vel, t: 0, giro: azar(0.8, 1.6), estado: 'vuelo' };
    balas = 3;
    estado = 'vuelo';
    Sonido.graznido();
  }

  function mostrarMapache(modo) {
    mapache = { modo, t: 0, x: azar(260, 700) };
    estado = 'mapache';
    if (modo === 'risa') Sonido.risa(); else Sonido.moneda();
  }

  function siguiente() {
    n++;
    if (n >= TOTAL) {
      const total = aciertos.filter(Boolean).length;
      if (total >= META) { estado = 'fin'; reloj = 2.5; Sonido.victoria(); }
      else { estado = 'finMal'; reloj = 2.8; mapache = { modo: 'risa', t: 0, x: 480 }; Sonido.risa(); }
      return;
    }
    estado = 'pausa';
    reloj = 0.7;
  }

  // ---------- Actualización ----------
  function actualizar(dt) {
    t += dt;
    part.actualizar(dt);
    if (destello > 0) destello -= dt;

    const clicks = Entrada.tomarClicks();

    if (estado === 'intro') { reloj -= dt; if (reloj <= 0) nuevoPato(); return; }
    if (estado === 'pausa') { reloj -= dt; if (reloj <= 0) nuevoPato(); return; }
    if (estado === 'fin') { reloj -= dt; if (reloj <= 0) api.ganar(); return; }
    if (estado === 'finMal') {
      reloj -= dt; mapache.t += dt;
      if (reloj <= 0) api.perder('Atrapaste ' + aciertos.filter(Boolean).length + ' de 10 patos. Necesitas al menos 6... ¡y el mapache sigue riéndose!');
      return;
    }
    if (estado === 'mapache') {
      mapache.t += dt;
      if (mapache.t >= 2.2) siguiente();
      return;
    }

    const p = pato;
    if (estado === 'vuelo') {
      for (const c of clicks) {
        if (balas <= 0) break;
        balas--;
        destello = 0.06;
        Sonido.disparo();
        if (Math.hypot(c.x - p.x, c.y - p.y) < 38) {
          p.estado = 'herido';
          estado = 'herido';
          reloj = 0.5;
          aciertos[n] = true;
          puntos += 500 + n * 100;
          part.emitir(p.x, p.y, '#f2e6c9', 14, 160, 200, 1, 5);
          break;
        }
      }
      if (estado === 'vuelo') {
        p.t += dt;
        p.giro -= dt;
        if (p.giro <= 0) {
          const ang = azar(0, Math.PI * 2);
          p.vx = Math.cos(ang) * p.vel;
          p.vy = Math.sin(ang) * p.vel;
          p.giro = azar(0.7, 1.5);
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 30) { p.x = 30; p.vx = Math.abs(p.vx); }
        if (p.x > ANCHO - 30) { p.x = ANCHO - 30; p.vx = -Math.abs(p.vx); }
        if (p.y < 40) { p.y = 40; p.vy = Math.abs(p.vy); }
        if (p.t > 0.6 && p.y > 340) { p.y = 340; p.vy = -Math.abs(p.vy); }
        if (p.t > 7 || balas <= 0) {
          p.estado = 'escapa';
          estado = 'escapa';
          p.vx = 0;
          p.vy = -380;
        }
      }
      return;
    }
    if (estado === 'escapa') {
      p.t += dt;
      p.y += p.vy * dt;
      if (p.y < -60) { aciertos[n] = false; mostrarMapache('risa'); }
      return;
    }
    if (estado === 'herido') {
      reloj -= dt;
      if (reloj <= 0) { p.estado = 'cae'; estado = 'cae'; p.vy = 360; Sonido.caer(); }
      return;
    }
    if (estado === 'cae') {
      p.y += p.vy * dt;
      if (p.y > 420) mostrarMapache('feliz');
    }
  }

  // ---------- Dibujo ----------
  function dibujarPato(p, escala = 1) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(escala, escala);
    if (p.estado === 'cae') {
      ctx.rotate(Math.PI / 2);
      ctx.scale(Math.floor(t * 10) % 2 ? 1 : -1, 1);
    } else if (p.estado === 'escapa') {
      ctx.rotate(-Math.PI / 2);
    } else {
      ctx.scale(p.vx >= 0 ? 1 : -1, 1);
    }
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(-32, -9); ctx.lineTo(-30, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4a2b';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9c7a0';
    ctx.beginPath(); ctx.ellipse(-3, 5, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f7a4a';
    ctx.beginPath(); ctx.arc(20, -10, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(13, -3, 9, 3);
    ctx.fillStyle = '#ffb000';
    ctx.beginPath(); ctx.moveTo(27, -12); ctx.lineTo(38, -8); ctx.lineTo(27, -6); ctx.closePath(); ctx.fill();
    if (p.estado === 'herido' || p.estado === 'cae') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(20, -14); ctx.lineTo(25, -9); ctx.moveTo(25, -14); ctx.lineTo(20, -9); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(22, -12, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(22, -13, 2, 2);
    }
    const aleteo = (p.estado === 'vuelo' || p.estado === 'escapa') ? Math.sin(t * 22) : 0.3;
    ctx.fillStyle = '#8a6a45';
    ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(10, -4); ctx.lineTo(-2, -4 - 24 * aleteo); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function dibujarMapache() {
    const m = mapache, d = 2.2;
    let sube;
    if (estado === 'finMal') sube = Math.min(1, m.t / 0.35);
    else if (m.t < 0.35) sube = m.t / 0.35;
    else if (m.t > d - 0.35) sube = Math.max(0, (d - m.t) / 0.35);
    else sube = 1;
    const salto = m.modo === 'risa' ? -Math.abs(Math.sin(t * 16)) * 8 : 0;
    const y = 480 - sube * 130 + salto;
    ctx.save();
    ctx.translate(m.x, y);
    ctx.fillStyle = '#7d7d86';
    ctx.beginPath(); ctx.ellipse(0, 72, 42, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#55555e';
    ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(-26, -42); ctx.lineTo(-12, -24); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, -14); ctx.lineTo(26, -42); ctx.lineTo(12, -24); ctx.fill();
    ctx.fillStyle = '#9a9aa4';
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ececf2';
    ctx.beginPath(); ctx.ellipse(0, 12, 26, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.ellipse(-15, -4, 15, 10, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15, -4, 15, 10, 0.2, 0, Math.PI * 2); ctx.fill();
    if (m.modo === 'risa') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-15, -1, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(15, -1, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = '#a3263a';
      ctx.beginPath(); ctx.ellipse(0, 21, 12, 8 + Math.abs(Math.sin(t * 16)) * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a8a';
      ctx.beginPath(); ctx.ellipse(0, 25, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a9aa4';
      ctx.beginPath(); ctx.ellipse(-30, 66, 10, 7, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, 66, 10, 7, -0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-15, -4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-16, -5, 3, 3); ctx.fillRect(14, -5, 3, 3);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 16, 9, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = '#9a9aa4';
      ctx.beginPath(); ctx.ellipse(46, -6, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(36, -4, 14, 40);
    }
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(0, 9, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (m.modo === 'feliz') dibujarPato({ x: m.x + 46, y: y - 22, vx: 1, estado: 'herido' }, 0.8);
  }

  function iconoPato(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 9, y - 5, 4, 0, Math.PI * 2); ctx.fill();
  }

  function dibujar() {
    const g = ctx.createLinearGradient(0, 0, 0, PISO);
    g.addColorStop(0, '#2b2d6e'); g.addColorStop(0.55, '#c0587e'); g.addColorStop(1, '#ffb26b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, PISO);

    ctx.fillStyle = 'rgba(255,220,140,.25)';
    ctx.beginPath(); ctx.arc(720, 330, 95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.arc(720, 330, 58, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#4b2c5e';
    ctx.beginPath(); ctx.moveTo(0, 360); ctx.lineTo(140, 270); ctx.lineTo(260, 330); ctx.lineTo(400, 250); ctx.lineTo(560, 340); ctx.lineTo(0, 360); ctx.fill();
    ctx.fillStyle = '#3a2149';
    ctx.beginPath(); ctx.moveTo(380, 360); ctx.lineTo(620, 290); ctx.lineTo(800, 330); ctx.lineTo(960, 280); ctx.lineTo(960, 360); ctx.fill();
    ctx.fillStyle = '#2f4f8f'; ctx.fillRect(0, 355, ANCHO, PISO - 355);
    ctx.fillStyle = 'rgba(255,210,122,.4)';
    for (let i = 0; i < 6; i++) ctx.fillRect(680 + Math.sin(t + i) * 10, 365 + i * 10, 80 - i * 10, 3);

    if (pato && (estado === 'vuelo' || estado === 'escapa' || estado === 'herido' || estado === 'cae')) dibujarPato(pato);
    if (mapache && (estado === 'mapache' || estado === 'finMal')) dibujarMapache();

    // juncos al frente (de ahí salen los patos y el mapache)
    for (const j of juncos) {
      ctx.strokeStyle = j.c; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(j.x, PISO); ctx.quadraticCurveTo(j.x + j.inc / 2, PISO - j.h / 2, j.x + j.inc, PISO - j.h); ctx.stroke();
      if (j.cola) {
        ctx.fillStyle = '#5a3418';
        ctx.beginPath(); ctx.ellipse(j.x + j.inc, PISO - j.h - 8, 4, 10, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // HUD
    ctx.fillStyle = '#24160f'; ctx.fillRect(0, PISO, ANCHO, ALTO - PISO);
    ctx.font = '10px "Press Start 2P", monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    rectRedondo(ctx, 20, PISO + 16, 130, 60, 8); ctx.fillStyle = '#000'; ctx.fill();
    ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#7fd0ff'; ctx.fillText('BALAS', 36, PISO + 32);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < balas ? '#ffb000' : '#333';
      ctx.fillRect(40 + i * 28, PISO + 46, 14, 22);
    }
    rectRedondo(ctx, 170, PISO + 16, 560, 60, 8); ctx.fillStyle = '#000'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7fd0ff'; ctx.fillText('ACIERTOS (META ' + META + ')', 186, PISO + 32);
    for (let i = 0; i < TOTAL; i++) {
      let col = '#fff';
      if (aciertos[i] === true) col = '#ff4d4d';
      else if (aciertos[i] === false) col = '#444';
      else if (i === n && Math.floor(t * 4) % 2) col = '#888';
      iconoPato(200 + i * 52, PISO + 56, col);
    }
    rectRedondo(ctx, 750, PISO + 16, 190, 60, 8); ctx.fillStyle = '#000'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText(String(puntos).padStart(6, '0'), 775, PISO + 40);
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#7fd0ff';
    ctx.fillText('PUNTOS', 775, PISO + 62);

    ctx.textAlign = 'center';
    if (estado === 'intro') {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(250, 150, 460, 90);
      ctx.fillStyle = '#fff'; ctx.font = '16px "Press Start 2P", monospace';
      ctx.fillText('RONDA 1', 480, 180);
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText('Atrapa al menos 6 de 10 patos', 480, 214);
    }
    if (estado === 'mapache' && mapache.modo === 'risa') {
      ctx.fillStyle = '#fff'; ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText('¡JA, JA, JA!', mapache.x, 250);
    }
    if (estado === 'fin') {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(230, 160, 500, 80);
      ctx.fillStyle = '#ffd45c'; ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillText('¡PUNTERÍA PERFECTA!', 480, 200);
    }
    ctx.textAlign = 'left';

    // mira
    const mx = Entrada.mouse.x, my = Entrada.mouse.y;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 24, my); ctx.lineTo(mx - 8, my); ctx.moveTo(mx + 8, my); ctx.lineTo(mx + 24, my);
    ctx.moveTo(mx, my - 24); ctx.lineTo(mx, my - 8); ctx.moveTo(mx, my + 8); ctx.lineTo(mx, my + 24);
    ctx.stroke();
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(mx - 2, my - 2, 4, 4);

    part.dibujar(ctx);
    if (destello > 0) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, 0, ANCHO, ALTO); }
  }

  return {
    emoji: '🦆',
    titulo: 'Cacería de patos',
    recuerdo: 'Apunta bien... alguien se va a reír si fallas.',
    intro: 'Tienes 3 disparos por pato. Atrapa al menos 6 de 10... o el mapache saldrá de los juncos a burlarse de ti.',
    ayuda: 'Apunta con el mouse y haz clic para disparar',
    iniciar(c, a) {
      ctx = c; api = a; t = 0;
      n = 0; aciertos = []; balas = 3; puntos = 0; destello = 0;
      pato = null; mapache = null;
      part = new Particulas();
      juncos = [];
      for (let x = -10; x < ANCHO + 10; x += 9) {
        juncos.push({ x, h: azar(40, 95), inc: azar(-12, 12), c: Math.random() < 0.5 ? '#2f6b3a' : '#24552d', cola: Math.random() < 0.12 });
      }
      estado = 'intro';
      reloj = 2.2;
      ctx.canvas.style.cursor = 'none';
      parar = crearBucle(actualizar, dibujar);
    },
    detener() {
      if (parar) parar();
      if (ctx) ctx.canvas.style.cursor = '';
    },
  };
})();
