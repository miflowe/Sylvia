/**
 * The leaf part of the first-launch intro: leaves fall until the screen is covered, shiver, then a gust sweeps them
 * off to the right (with faint wind lines) and reveals the app underneath. Plain canvas, no libraries.
 * Leaves grow a little on big screens (capped) and there are more of them, so a laptop still looks like leaves, not confetti or giant shapes.
 */
const PALETTE = ["#1f4a33", "#66904f", "#8fb36f", "#2f6b46", "#e07a2c", "#e8b931", "#c2410c"];
const FALL = 1.6;
const HOLD = 0.45;
const GUST = 1.6;
// Designed on a 280 × 580 phone screen; everything else scales from that.
const BASE_AREA = 280 * 580;

interface Leaf {
  tx: number;
  ty: number;
  x: number;
  y: number;
  s: number;
  c: string;
  r0: number;
  r: number;
  spin: number;
  flip: number;
  fs: number;
  sway: number;
  d: number;
  a: number;
  vx: number;
  vy: number;
  spinV: number;
  hit: boolean;
  ph: number;
  tw: number;
}

interface Streak {
  y: number;
  d: number;
  len: number;
  amp: number;
  sp: number;
  w: number;
}

/** Plays the leaves on `canvas` at `speed` (1 = designed pace, higher = slower). Returns a function that stops it. */
export function playLeaves(canvas: HTMLCanvasElement, speed: number, onCovered: () => void, onDone: () => void): () => void {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const k = Math.min(1.6, Math.max(1, Math.sqrt((W * H) / BASE_AREA)));

  const leaves: Leaf[] = [];
  const add = (tx: number, ty: number) =>
    leaves.push({
      tx, ty, x: tx, y: -60 * k, s: (17 + Math.random() * 15) * k, c: PALETTE[(Math.random() * PALETTE.length) | 0]!,
      r0: Math.random() * 6.28, r: 0, spin: (Math.random() - 0.5) * 3, flip: 0, fs: 1 + Math.random() * 2, sway: (8 + Math.random() * 22) * k,
      d: Math.random(), a: 1, vx: 0, vy: 0, spinV: 0, hit: false, ph: Math.random() * 6.28, tw: 2 + Math.random() * 4,
    });
  // An even grid guarantees full cover; random extras on top hide the grid.
  const step = 15 * k;
  for (let y = -10; y < H + 20; y += step) for (let x = -10; x < W + 20; x += step) add(x + (Math.random() - 0.5) * step, y + (Math.random() - 0.5) * step);
  const extras = Math.round(leaves.length * 0.3);
  for (let i = 0; i < extras; i++) add(Math.random() * (W + 20) - 10, Math.random() * (H + 20) - 10);
  leaves.sort(() => Math.random() - 0.5);

  const streaks: Streak[] = Array.from({ length: 16 }, () => ({
    y: Math.random() * H, d: Math.random() * 0.7, len: (80 + Math.random() * 120) * k, amp: (6 + Math.random() * 14) * k, sp: (900 + Math.random() * 500) * (W / 280), w: 0.8 + Math.random() * 1.4,
  }));

  const leafPath = (s: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.85, -s * 0.5, s * 0.7, s * 0.55, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.55, -s * 0.85, -s * 0.5, 0, -s);
  };
  const draw = (l: Leaf) => {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.r);
    ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(l.flip)), 1);
    ctx.globalAlpha = l.a;
    ctx.fillStyle = l.c;
    leafPath(l.s);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -l.s * 0.85);
    ctx.lineTo(0, l.s * 1.2);
    ctx.stroke();
    ctx.restore();
  };
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  let raf = 0;
  let covered = false;
  const t0 = performance.now();
  let last = t0;
  const frame = (now: number) => {
    const el = (now - t0) / 1000 / speed;
    const dt = Math.min(0.05, (now - last) / 1000 / speed);
    last = now;
    ctx.clearRect(0, 0, W, H);
    const g = el - FALL - HOLD;
    if (!covered && el > FALL - 0.1) {
      covered = true;
      onCovered();
    }
    for (const l of leaves) {
      if (g < 0) {
        const p = Math.max(0, Math.min(1, (el - l.d * FALL * 0.55) / (FALL * (1 - l.d * 0.55))));
        const e = ease(p);
        l.y = -60 * k + (l.ty + 60 * k) * e;
        l.x = l.tx + Math.sin(el * l.fs * 2 + l.r0) * l.sway * (1 - e);
        l.r = l.r0 + l.spin * (1 - e) * 1.5;
        l.flip = (1 - e) * el * l.fs * 2;
        // The shiver before the gust.
        if (el > FALL) {
          const sh = (el - FALL) / HOLD;
          l.r += Math.sin(el * 40 + l.ph) * 0.06 * sh * sh;
        }
        if (p > 0) draw(l);
        continue;
      }
      if (!l.hit) {
        // A gust front sweeps left to right, tilted so the top clears first.
        const front = g * 2.2 * W - 60 - (l.ty / H) * 90 * k;
        if (front > l.tx + Math.random() * 30) {
          l.hit = true;
          l.vx = (380 + Math.random() * 420) * (W / 280);
          l.vy = -(80 + Math.random() * 220) * k;
          l.spinV = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 10);
        } else {
          l.r += Math.sin(el * 36 + l.ph) * 0.05;
        }
      }
      if (l.hit) {
        l.vx += 900 * (W / 280) * dt;
        l.vy -= 60 * k * dt;
        l.x += l.vx * dt + Math.sin(el * l.tw * 3 + l.ph) * 1.6 * k;
        l.y += l.vy * dt + Math.cos(el * l.tw * 2.4 + l.ph) * 2.2 * k;
        l.r += l.spinV * dt;
        l.flip += l.tw * dt * 3.2;
        if (l.x > W + 60 * k || l.y < -60 * k) l.a = 0;
      }
      if (l.a > 0) draw(l);
    }
    // Wind lines ride along with the gust.
    if (g > -0.1 && g < GUST) {
      ctx.save();
      ctx.lineCap = "round";
      for (const s of streaks) {
        const q = g - s.d * 0.6;
        if (q < 0 || q > 0.9) continue;
        const x = -s.len + q * s.sp;
        const alpha = Math.sin((q / 0.9) * Math.PI) * 0.55;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(x, s.y);
        ctx.bezierCurveTo(x + s.len * 0.33, s.y - s.amp, x + s.len * 0.66, s.y + s.amp, x + s.len, s.y - s.amp * 0.4);
        ctx.stroke();
        ctx.strokeStyle = `rgba(31,74,51,${alpha * 0.35})`;
        ctx.lineWidth = s.w * 0.7;
        ctx.beginPath();
        ctx.moveTo(x + 6, s.y + 3);
        ctx.bezierCurveTo(x + s.len * 0.33, s.y - s.amp + 3, x + s.len * 0.66, s.y + s.amp + 3, x + s.len - 6, s.y - s.amp * 0.4 + 3);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (g < 0 || (leaves.some((l) => l.a > 0) && g < GUST + 1)) raf = requestAnimationFrame(frame);
    else onDone();
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
