// Dezente Effekte: kleine Herz-Explosion (Bewertung/Speichern), Herzregen am Jahrestag.
import { iconStr } from './icons.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Kleine Herzen fliegen von einem Punkt aus. */
export function heartBurst(x, y, n = 8) {
  n = Math.min(n, 8);
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-heart';
    const size = 10 + Math.random() * 14;
    el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;`;
    el.innerHTML = iconStr('heartFill');
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
    const colors = ['var(--accent)', 'var(--accent-strong)', 'var(--accent2)'];
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
