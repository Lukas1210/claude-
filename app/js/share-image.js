// Story-Bilder (1080 × 1920) zum Teilen: ein Erlebnis oder euer Jahresrückblick.
// Ablauf in zwei Schritten (Vorschau → „Teilen“), weil iOS das Teilen-Menü nur direkt nach einem Tipp öffnet.
import { html } from './ui/dom.js';
import { icon, iconStr } from './ui/icons.js';
import { openSheet, toast } from './ui/sheet.js';
import { getBlob, coverOf } from './photos.js';
import { catOf, ratingValue, fmtRating, fmtDate, fmtRange, fmtNumber } from './model.js';
import { nameOf } from './store.js';
import { shortPlace } from './geo.js';

const W = 1080, H = 1920, PAD = 80;
const HEART = 'M12 21.2c-.2 0-.4-.1-.6-.2C10.9 20.7 3 15.8 1.1 10.8.4 8.9.6 6.9 1.7 5.4 2.8 3.9 4.6 3 6.6 3c2.2 0 4 1 5.4 2.6C13.4 4 15.2 3 17.4 3c2 0 3.8.9 4.9 2.4 1.1 1.5 1.3 3.5.6 5.4-1.9 5-9.8 9.9-10.3 10.2-.2.1-.4.2-.6.2z';
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
const DISPLAY = '"Space Grotesk", -apple-system, sans-serif';

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  return { brand: v('--brand', '#F0B44C'), rgb: v('--brand-rgb', '240, 180, 76'), heroBg: v('--hero-bg', '#0F1A36'), num: v('--hero-num', '#F0B44C') };
}

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function iconImage(name, color, size) {
  const svg = iconStr(name).replace('class="i"', `width="${size}" height="${size}"`).replace(/currentColor/g, color).replace('stroke-width="1.8"', 'stroke-width="1.6"');
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function drawCover(ctx, img) {
  const s = Math.max(W / img.width, H / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !line) line = t;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxW && last.length) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last}…`;
    return cut;
  }
  return lines;
}

function drawHearts(ctx, x, y, size, value, color) {
  const p = new Path2D(HEART);
  const s = size / 24;
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(x + i * (size + 10), y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill(p);
    const fill = Math.max(0, Math.min(1, (value || 0) - i));
    if (fill > 0) {
      ctx.beginPath();
      ctx.rect(0, 0, 24 * (fill >= 1 ? 1 : 0.5), 24);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fill(p);
    }
    ctx.restore();
  }
}

function background(ctx, pal) {
  ctx.fillStyle = pal.heroBg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.9, H * 0.05, 40, W * 0.9, H * 0.05, W * 1.1);
  g.addColorStop(0, `rgba(${pal.rgb}, 0.42)`);
  g.addColorStop(1, `rgba(${pal.rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(0, H, 40, 0, H, W);
  g2.addColorStop(0, `rgba(${pal.rgb}, 0.16)`);
  g2.addColorStop(1, `rgba(${pal.rgb}, 0)`);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

function brandMark(ctx, pal) {
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 76px ${DISPLAY}`;
  ctx.fillStyle = pal.brand;
  ctx.fillText('&', PAD, 160);
  ctx.font = `600 34px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillText('Couple Journal', PAD + 66, 150);
}

const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));

async function fonts() {
  try { await document.fonts?.load(`700 96px ${DISPLAY}`); } catch {}
}

/** Story-Bild für ein Erlebnis. */
export async function entryImage(entry) {
  await fonts();
  const pal = palette();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const d = entry.data;
  const cat = catOf(entry);
  let img = null;
  const cid = coverOf(entry);
  if (cid) { try { const b = await getBlob(cid, 'full'); if (b) { const u = URL.createObjectURL(b); img = await loadImage(u); setTimeout(() => URL.revokeObjectURL(u), 3000); } } catch {} }
  if (img) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    drawCover(ctx, img);
    const g = ctx.createLinearGradient(0, H * 0.32, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const top = ctx.createLinearGradient(0, 0, 0, 320);
    top.addColorStop(0, 'rgba(0,0,0,0.5)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 320);
  } else {
    background(ctx, pal);
    const ic = await iconImage(cat.icon, pal.brand, 380);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(ic, (W - 380) / 2, 470, 380, 380);
    ctx.globalAlpha = 1;
  }
  brandMark(ctx, pal);

  // Unterer Block, von unten nach oben aufgebaut
  ctx.font = `700 104px ${DISPLAY}`;
  const titleLines = wrap(ctx, d.title || cat.label, W - PAD * 2, 3);
  const rows = ['a', 'b'].filter((s) => ratingValue(entry, s) != null);
  let y = H - 150 - rows.length * 86;
  const metaParts = [d.category === 'trip' ? fmtRange(d.date, d.endDate) : fmtDate(d.date, { day: 'numeric', month: 'long', year: 'numeric' }), d.place ? shortPlace(d.place) : ''].filter(Boolean);
  const metaY = y - 30;
  const titleBottom = metaY - 70;
  const titleTop = titleBottom - (titleLines.length - 1) * 112;
  // Kategorie
  ctx.font = `700 34px ${SANS}`;
  ctx.fillStyle = pal.brand;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.fillText(cat.label.toUpperCase(), PAD, titleTop - 110);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // Titel
  ctx.font = `700 104px ${DISPLAY}`;
  ctx.fillStyle = '#fff';
  titleLines.forEach((l, i) => ctx.fillText(l, PAD, titleTop + i * 112));
  // Datum & Ort
  ctx.font = `500 40px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(metaParts.join('  ·  '), PAD, metaY);
  // Bewertungen
  for (const s of rows) {
    y += 86;
    ctx.font = `600 40px ${SANS}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(nameOf(s), PAD, y);
    drawHearts(ctx, PAD + 230, y - 46, 50, ratingValue(entry, s), pal.brand);
    ctx.font = `700 44px ${DISPLAY}`;
    ctx.fillStyle = pal.brand;
    ctx.fillText(fmtRating(ratingValue(entry, s)), PAD + 230 + 5 * 60 + 20, y);
  }
  return toBlob(c);
}

/** Story-Bild für den Jahresrückblick. */
export async function wrappedImage(sum) {
  await fonts();
  const pal = palette();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  background(ctx, pal);
  brandMark(ctx, pal);
  ctx.font = `700 330px ${DISPLAY}`;
  ctx.fillStyle = pal.num;
  ctx.fillText(String(sum.label), PAD - 12, 560);
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`${nameOf('a')} & ${nameOf('b')}`, PAD, 670);
  const rows = [
    [fmtNumber(sum.count), sum.count === 1 ? 'Erlebnis' : 'Erlebnisse'],
    [fmtNumber(sum.countries), sum.countries === 1 ? 'Land' : 'Länder'],
    [fmtNumber(sum.km), 'km gereist'],
    [fmtNumber(sum.photos), 'Fotos'],
    ...(sum.agreement != null ? [[`${sum.agreement} %`, 'einig']] : []),
  ];
  let y = 860;
  for (const [num, label] of rows) {
    ctx.font = `700 96px ${DISPLAY}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(num, PAD, y);
    const w = ctx.measureText(num).width;
    ctx.font = `500 44px ${SANS}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(label, PAD + w + 24, y);
    y += 132;
  }
  if (sum.best) {
    ctx.font = `700 34px ${SANS}`;
    ctx.fillStyle = pal.brand;
    ctx.fillText('BESTES ERLEBNIS', PAD, y + 40);
    ctx.font = `700 64px ${DISPLAY}`;
    ctx.fillStyle = '#fff';
    wrap(ctx, `${sum.best.data.title} · ${fmtRating(sum.bestAvg)}`, W - PAD * 2, 2).forEach((l, i) => ctx.fillText(l, PAD, y + 120 + i * 74));
  }
  return toBlob(c);
}

/** Vorschau-Sheet mit „Teilen“ (Teilen-Menü von iOS) bzw. „Sichern“ als Rückfall. */
export function openShareSheet(blobPromise, { filename = 'couple-journal.jpg', title = 'Couple Journal' } = {}) {
  const sheet = openSheet({
    title: 'Als Bild teilen',
    left: html`<button class="text-btn" data-act="cancel">Fertig</button>`,
    body: html`<div class="share-wrap"><div class="share-preview loading"></div><button class="btn primary block" data-act="share" disabled>${icon('share')} Teilen</button><p class="group-foot center">Für Instagram-Story, WhatsApp oder AirDrop.</p></div>`,
  });
  let file = null;
  let url = null;
  blobPromise.then((blob) => {
    if (!blob) throw new Error('Bild konnte nicht erstellt werden');
    file = new File([blob], filename, { type: 'image/jpeg' });
    url = URL.createObjectURL(blob);
    const prev = sheet.body.querySelector('.share-preview');
    prev.classList.remove('loading');
    prev.innerHTML = `<img src="${url}" alt="Vorschau">`;
    sheet.body.querySelector('[data-act="share"]').disabled = false;
  }).catch((e) => { toast(e.message, { icon: 'info' }); sheet.close(); });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'cancel') { sheet.close(); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
    if (b.dataset.act === 'share' && file) {
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title }); } catch (err) { if (err?.name !== 'AbortError') toast('Teilen nicht möglich', { icon: 'info' }); }
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        toast('Bild gesichert', { icon: 'download' });
      }
    }
  });
  return sheet;
}
