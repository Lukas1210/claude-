// Romantische Effekte: Sternenhimmel, Herz-Explosion, Herz-Konfetti.
import { iconStr } from './icons.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function startStars(canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [], w = 0, h = 0, dpr = 1, raf = 0, last = 0;
  let shooting = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 5200);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() < 0.08 ? 1.3 + Math.random() * 0.8 : 0.35 + Math.random() * 0.8,
      a: 0.25 + Math.random() * 0.7,
      s: 0.4 + Math.random() * 1.6,
      p: Math.random() * Math.PI * 2,
      c: Math.random() < 0.15 ? '255,190,205' : Math.random() < 0.2 ? '243,217,177' : '255,255,255',
    }));
    draw(performance.now());
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const tw = reduced() ? 1 : 0.55 + 0.45 * Math.sin(t / 1000 * s.s + s.p);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = `rgb(${s.c})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.3) {
        ctx.globalAlpha = s.a * tw * 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (shooting) {
      const k = (t - shooting.t0) / shooting.dur;
      if (k >= 1) shooting = null;
      else {
        const x = shooting.x + shooting.dx * k, y = shooting.y + shooting.dy * k;
        const g = ctx.createLinearGradient(x, y, x - shooting.dx * 0.15, y - shooting.dy * 0.15);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - shooting.dx * 0.15, y - shooting.dy * 0.15);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - last < 66) return; // ~15 fps reicht und spart Akku
    last = t;
    if (!shooting && Math.random() < 0.004) {
      shooting = { x: Math.random() * w * 0.8, y: Math.random() * h * 0.4, dx: 160 + Math.random() * 160, dy: 60 + Math.random() * 90, t0: t, dur: 900 };
    }
    draw(t);
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduced()) raf = requestAnimationFrame(loop);
  });
  if (!reduced()) raf = requestAnimationFrame(loop);
}

/** Kleine Herzen fliegen von einem Punkt aus. */
export function heartBurst(x, y, n = 10) {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-heart';
    const size = 10 + Math.random() * 14;
    el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;`;
    el.innerHTML = iconStr('heartFill');
    if (Math.random() < 0.3) el.style.color = 'var(--champ)';
    document.body.appendChild(el);
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const dist = 40 + Math.random() * 60;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
    el.animate(
      [
        { transform: 'translate(0,0) scale(.4)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(${dx * 1.1}px,${dy - 40}px) scale(.7)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' },
    ).onfinish = () => el.remove();
  }
}

/** Herzen regnen von oben (Jahrestag, Speichern …). */
export function heartRain(n = 26) {
  if (reduced()) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-heart';
    const size = 12 + Math.random() * 18;
    const x = Math.random() * w;
    el.style.cssText = `left:${x}px;top:-30px;width:${size}px;height:${size}px;`;
    el.innerHTML = iconStr('heartFill');
    const colors = ['var(--rose)', 'var(--rose2)', 'var(--champ)', '#ffc2cf'];
    el.style.color = colors[i % colors.length];
    document.body.appendChild(el);
    const drift = (Math.random() - 0.5) * 120;
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { transform: `translate(${drift}px,${h + 60}px) rotate(${(Math.random() - 0.5) * 120}deg)`, opacity: 0.8 },
      ],
      { duration: 2600 + Math.random() * 1800, delay: Math.random() * 900, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'backwards' },
    ).onfinish = () => el.remove();
  }
}
