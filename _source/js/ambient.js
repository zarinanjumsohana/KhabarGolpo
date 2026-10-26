/* KhabarGolpo ambient: cherry blossom petals and butterflies, carried by a slow wind.
   Self-contained: it creates its own canvas, so index.html needs no extra tags. */
(() => {
  /* ---------- canvas: sits above the page, below the top bar, ignores clicks ---------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:20;pointer-events:none';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  /* ---------- settings ---------- */
  const mobile = matchMedia('(max-width: 767px)');
  const petalCount = () => (mobile.matches ? 16 : 34);
  const butterflyCount = () => (mobile.matches ? 2 : 4);
  const PETAL = { fill: '#ffb7cd', centre: '#f6a6bd' };
  const BUTTERFLY_COLOURS = [
    ['#e8862b', '#f2b35a'],   // orange, like the monarchs in the frame
    ['#3fb8b0', '#8fe0d6']    // teal, like the ones in the frame
  ];

  let W = 0, H = 0, dpr = 1;
  let time = 0, last = performance.now();
  const petals = [];
  const butterflies = [];

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- wind: slow waves with occasional gusts (pixels per second) ---------- */
  function windAt(t) {
    const steady = 18 + 12 * Math.sin(t * 0.21) + 7 * Math.sin(t * 0.57 + 1.3);
    const gust = Math.max(0, Math.sin(t * 0.09) - 0.8) * 70;
    return steady + gust;
  }

  /* ---------- cherry blossom petal ---------- */
  function newPetal(anywhere) {
    const depth = rand(0.4, 1);   // small and faint = far away; big and bright = near
    return {
      x: rand(0, W),
      y: anywhere ? rand(0, H) : rand(-60, -10),
      size: 3 + 5 * depth,
      depth,
      alpha: 0.45 + 0.45 * depth,
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.5, 0.5),
      flip: rand(0, Math.PI * 2),
      flipSpeed: rand(0.6, 1.4),
      fall: rand(14, 30) * (0.6 + 0.4 * depth),   // slow, like slow motion
      sway: rand(10, 24),
      swayPhase: rand(0, Math.PI * 2),
      swaySpeed: rand(0.3, 0.7)
    };
  }

  function drawPetal(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(Math.cos(p.flip), 1);   // the petal turns edge-on and back as it falls
    ctx.fillStyle = PETAL.fill;
    for (let i = 0; i < 5; i++) {     // five lobes make the blossom shape
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -p.size * 0.55, p.size * 0.42, p.size * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PETAL.centre;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- butterfly ---------- */
  function newButterfly(anywhere) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      x: anywhere ? rand(0, W) : (dir > 0 ? -60 : W + 60),
      y: rand(H * 0.12, H * 0.85),
      dir,
      size: rand(12, 18),
      speed: rand(24, 40),
      colours: BUTTERFLY_COLOURS[Math.random() < 0.5 ? 0 : 1],
      wing: rand(0, Math.PI * 2),
      flapSpeed: rand(9, 13),
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.6, 1.1)
    };
  }

  function drawButterfly(b) {
    const open = 0.15 + 0.85 * Math.abs(Math.sin(b.wing));   // 0 = wings closed, 1 = wide open
    const s = b.size;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.translate(b.x, b.y + Math.sin(b.wobble) * 10);
    ctx.scale(b.dir, 1);                                       // face the way it flies
    ctx.rotate(Math.sin(b.wobble * 0.5) * 0.12);
    ctx.strokeStyle = 'rgba(43,29,20,.6)';
    ctx.lineWidth = 0.8;
    for (const side of [1, -1]) {                              // right wing, then the mirrored left wing
      ctx.save();
      ctx.scale(side, 1);
      ctx.fillStyle = b.colours[0];
      ctx.beginPath();
      ctx.ellipse(s * 0.5 * open, -s * 0.3, s * 0.5 * open, s * 0.36, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = b.colours[1];
      ctx.beginPath();
      ctx.ellipse(s * 0.4 * open, s * 0.25, s * 0.34 * open, s * 0.26, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#2b1d14';                                 // body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.07, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- movement ---------- */
  function update(dt, wz) {
    for (const p of petals) {
      p.swayPhase += p.swaySpeed * dt;
      p.x += (wz * p.depth + Math.sin(p.swayPhase) * p.sway) * dt;
      p.y += p.fall * dt;
      p.rot += p.spin * dt;
      p.flip += p.flipSpeed * dt;
      if (p.y > H + 30 || p.x < -40 || p.x > W + 40) {   // back to the top once it leaves the screen
        p.y = rand(-60, -10);
        p.x = rand(0, W);
      }
    }
    for (const b of butterflies) {
      b.x += (b.dir * b.speed + wz * 0.6) * dt;          // the wind carries them a little too
      b.wing += b.flapSpeed * dt;
      b.wobble += b.wobbleSpeed * dt;
      if ((b.dir > 0 && b.x > W + 60) || (b.dir < 0 && b.x < -60)) {
        b.x = b.dir > 0 ? -60 : W + 60;
        b.y = rand(H * 0.12, H * 0.85);
      }
    }
  }

  /* ---------- setup and loop ---------- */
  function fill(list, count, make) {
    while (list.length < count) list.push(make(true));
    list.length = count;
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fill(petals, petalCount(), newPetal);
    fill(butterflies, butterflyCount(), newButterfly);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    update(dt, windAt(time));
    ctx.clearRect(0, 0, W, H);
    for (const p of petals) drawPetal(p);
    for (const b of butterflies) drawButterfly(b);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();