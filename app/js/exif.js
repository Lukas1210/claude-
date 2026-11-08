// Minimaler EXIF-Leser für JPEGs: Aufnahmedatum und GPS-Position.

export async function readExif(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    return parse(new DataView(buf));
  } catch {
    return {};
  }
}

function parse(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};
  let off = 2;
  while (off + 4 < view.byteLength) {
    const marker = view.getUint16(off);
    const size = view.getUint16(off + 2);
    if (marker === 0xffe1 && getStr(view, off + 4, 4) === 'Exif') return parseTiff(view, off + 10);
    if ((marker & 0xff00) !== 0xff00) break;
    off += 2 + size;
  }
  return {};
}

function getStr(view, off, len) {
  let s = '';
  for (let i = 0; i < len && off + i < view.byteLength; i++) {
    const c = view.getUint8(off + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function parseTiff(view, start) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o) => view.getUint16(start + o, little);
  const u32 = (o) => view.getUint32(start + o, little);
  const out = {};

  const readIFD = (ifdOff) => {
    const tags = {};
    if (ifdOff <= 0 || start + ifdOff + 2 > view.byteLength) return tags;
    const n = u16(ifdOff);
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12;
      if (start + e + 12 > view.byteLength) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const valOff = e + 8;
      tags[tag] = { type, count, valOff, ptr: u32(valOff) };
    }
    return tags;
  };

  const rational = (o) => {
    const num = u32(o), den = u32(o + 4);
    return den ? num / den : 0;
  };
  const ascii = (t) => (t.count <= 4 ? getStr(view, start + t.valOff, t.count) : getStr(view, start + t.ptr, t.count));

  const ifd0 = readIFD(u32(4));
  if (ifd0[0x8769]) {
    const exif = readIFD(ifd0[0x8769].ptr);
    const dt = exif[0x9003] || exif[0x9004] || ifd0[0x0132];
    if (dt) {
      const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(ascii(dt));
      if (m) out.date = `${m[1]}-${m[2]}-${m[3]}`;
    }
  } else if (ifd0[0x0132]) {
    const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(ascii(ifd0[0x0132]));
    if (m) out.date = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (ifd0[0x8825]) {
    const gps = readIFD(ifd0[0x8825].ptr);
    if (gps[2] && gps[4]) {
      const dms = (t) => rational(t.ptr) + rational(t.ptr + 8) / 60 + rational(t.ptr + 16) / 3600;
      let lat = dms(gps[2]), lng = dms(gps[4]);
      const latRef = gps[1] ? getStr(view, start + gps[1].valOff, 1) : 'N';
      const lngRef = gps[3] ? getStr(view, start + gps[3].valOff, 1) : 'E';
      if (latRef === 'S') lat = -lat;
      if (lngRef === 'W') lng = -lng;
      if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) out.gps = { lat, lng };
    }
  }
  return out;
}
