// Effekte: Neon-Funken (Bewertung/Speichern), Konfetti (Jahrestag, Match, Erfolg) und Hochzählen von Zahlen.
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Funken und ein Leuchtring von einem Punkt aus. */
export function sparkBurst(x, y, n = 10) {
  if (reduced()) return;
  n = Math.min(n, 14);
  const ring = document.createElement('div');
  ring.className = 'fx-ring';
  ring.style.cssText = `left:${x - 14}px;top:${y - 14}px;width:28px;height:28px;`;
  document.body.appendChild(ring);
  ring.animate([{ transform: 'scale(.4)', opacity: 0.9 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => ring.remove();
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-spark';
    const len = 9 + Math.random() * 9;
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 34 + Math.random() * 46;
    const deg = (ang * 180) / Math.PI + 90;
    el.style.cssText = `left:${x - 1.5}px;top:${y - len / 2}px;height:${len}px;`;
    document.body.appendChild(el);
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    el.animate(
      [
        { transform: `translate(0,0) rotate(${deg}deg) scaleY(.3)`, opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${deg}deg) scaleY(1)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(${dx * 1.25}px,${dy * 1.25}px) rotate(${deg}deg) scaleY(.2)`, opacity: 0 },
      ],
      { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.2,1)' },
    ).onfinish = () => el.remove();
  }
}

/** Konfetti von oben. */
export function confetti(n = 70) {
  if (reduced()) return;
  const w = window.innerWidth, h = window.innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  const colors = [v('--brand', '#c6f432'), v('--heart', '#e5342a'), v('--accent2', '#ff8a3d'), v('--purple', '#a78bfa'), v('--c-trip', '#38bdf8'), v('--text', '#111')];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-confetti';
    const cw = 5 + Math.random() * 5, ch = 8 + Math.random() * 8;
    el.style.cssText = `left:${Math.random() * w}px;width:${cw}px;height:${ch}px;background:${colors[i % colors.length]};`;
    document.body.appendChild(el);
    const drift = (Math.random() - 0.5) * 160;
    const spin = (Math.random() - 0.5) * 900;
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { transform: `translate(${drift}px,${h + 60}px) rotate(${spin}deg)`, opacity: 0.85 },
      ],
      { duration: 2200 + Math.random() * 1600, delay: Math.random() * 700, easing: 'cubic-bezier(.25,.1,.5,1)', fill: 'backwards' },
    ).onfinish = () => el.remove();
  }
}

// Ältere Namen (werden nicht mehr verwendet, bleiben für Kompatibilität)
export const heartBurst = sparkBurst;
export const heartRain = (n) => confetti(Math.max(40, n || 0));

/** Zahl in einem Element hochzählen (de-DE-Format). */
export function countUp(el, to, { duration = 900, decimals = 0, suffix = '' } = {}) {
  if (!el) return;
  const fmt = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  if (reduced() || !isFinite(to) || to === 0) { el.textContent = fmt(to || 0); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(decimals ? to * e : Math.round(to * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Alle Elemente mit data-count="Zahl" hochzählen. */
export function countUpAll(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count);
    countUp(el, to, { decimals: +(el.dataset.decimals || 0), suffix: el.dataset.suffix || '' });
  });
}
