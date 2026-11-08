// Einstellungen: Paar-Daten, Gerät, Sync, Backup, Installation.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { settings, saveSettings, setDevice, me, nameOf, allRaw, importItems, uuid } from '../store.js';
import { blobsDB, wipeAll } from '../db.js';
import { fmtDate, today, APP_VERSION } from '../model.js';
import { topbar } from '../ui/components.js';
import { openSheet, confirmDialog, toast, actionSheet } from '../ui/sheet.js';
import { pickPlace } from '../ui/place-picker.js';
import { placeLabel, flag } from '../geo.js';
import { getStatus, onStatus, isConfigured, currentUser, login, logout, syncNow, setCredentials, config } from '../sync.js';
import { getBlob } from '../photos.js';
import { afterPaint, refresh } from '../router.js';
import { getThemePref, setThemePref } from '../theme.js';

export const live = true;

function blobToDataURL(b) {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(b); });
}
async function dataURLToBlob(u) { return (await fetch(u)).blob(); }

async function exportBackup(withPhotos) {
  const hide = toast('Backup wird erstellt …', { emoji: '💾', duration: 0 });
  try {
    const items = allRaw().filter((it) => !it.deleted).map(({ dirty, ...rest }) => rest);
    const photos = {};
    if (withPhotos) {
      for (const it of items.filter((i) => i.type === 'photo')) {
        const full = await getBlob(it.id, 'full');
        const thumb = await getBlob(it.id, 'thumb');
        if (full && thumb) photos[it.id] = { full: await blobToDataURL(full), thumb: await blobToDataURL(thumb) };
      }
    }
    const json = JSON.stringify({ app: 'couple-journal', version: 1, exportedAt: new Date().toISOString(), items, photos });
    const file = new File([json], `couple-journal-backup-${today()}${withPhotos ? '-mit-fotos' : ''}.json`, { type: 'application/json' });
    hide();
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Couple Journal Backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup gespeichert', { emoji: '💾' });
  } catch (e) {
    hide();
    toast('Backup fehlgeschlagen: ' + e.message, { emoji: '⚠️', duration: 4000 });
  }
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'couple-journal' || !Array.isArray(data.items)) throw new Error('Keine gültige Backup-Datei');
    const ok = await confirmDialog({ title: 'Backup importieren?', message: `${data.items.length} Einträge vom ${fmtDate(data.exportedAt)} werden übernommen. Vorhandene Einträge mit gleicher ID werden überschrieben.`, ok: 'Importieren' });
    if (!ok) return;
    const hide = toast('Importiere …', { emoji: '💾', duration: 0 });
    const photos = data.photos || {};
    for (const [id, p] of Object.entries(photos)) {
      await blobsDB.put(`${id}:full`, await dataURLToBlob(p.full));
      await blobsDB.put(`${id}:thumb`, await dataURLToBlob(p.thumb));
    }
    const items = data.items.map((it) => (it.type === 'photo' && photos[it.id] ? { ...it, data: { ...it.data, uploaded: false } } : it));
    const n = await importItems(items);
    hide();
    toast(`${n} Einträge importiert`, { emoji: '✅' });
  } catch (e) {
    toast('Import fehlgeschlagen: ' + e.message, { emoji: '⚠️', duration: 4000 });
  }
}

function statusPill(st) {
  const cls = { idle: 'ok', busy: 'busy', error: 'err', offline: 'err' }[st.state] || '';
  const text = st.state === 'idle'
    ? (st.lastSync ? `Synchronisiert · ${new Date(st.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Verbunden')
    : st.message || { off: 'Nicht eingerichtet', loggedout: 'Nicht angemeldet' }[st.state] || '';
  return html`<span class="sync-pill ${cls}"><span class="dot"></span>${text}</span>`;
}

async function syncSection() {
  const st = getStatus();
  if (!isConfigured()) {
    return html`
      <div class="group">
        <div class="cell"><span class="cell-icon">${icon('cloud')}</span><span class="grow">Sync ist noch nicht eingerichtet</span></div>
        <button class="cell link" data-act="creds" style="width:100%;text-align:left"><span class="grow rose">Zugangsdaten eingeben</span><span class="chev">${icon('chevron')}</span></button>
      </div>
      <div class="group-foot">Mit Sync seht ihr beide alle Erinnerungen und Fotos auf euren Handys. Die Anleitung steht im README.</div>`;
  }
  const user = await currentUser();
  if (!user) {
    return html`
      <form class="group" id="login">
        <div class="cell"><label>E-Mail</label><input id="le" type="email" inputmode="email" autocomplete="username" required></div>
        <div class="cell"><label>Passwort</label><input id="lp" type="password" autocomplete="current-password" required></div>
        <button class="cell link" type="submit" style="width:100%;text-align:left"><span class="grow rose" style="font-weight:600">Anmelden</span></button>
      </form>
      <div class="group-foot">${statusPill(st)} · <button class="text-btn" style="font-size:13px;padding:0" data-act="creds">Zugangsdaten ändern</button></div>`;
  }
  return html`
    <div class="group">
      <div class="cell"><span class="cell-icon">${icon('user')}</span><span class="grow ellipsis">${user.email}</span></div>
      <div class="cell"><span class="grow" id="sync-status">${statusPill(st)}</span><button class="text-btn" data-act="sync" style="font-size:15px">${icon('refresh')} Jetzt</button></div>
      <button class="cell link" data-act="logout" style="width:100%;text-align:left"><span class="grow" style="color:var(--danger)">Abmelden</span></button>
    </div>
    <div class="group-foot">Änderungen werden automatisch übertragen – auch offline gesammelte, sobald wieder Netz da ist.</div>`;
}

function credentialsSheet() {
  const c = config();
  const sheet = openSheet({
    title: 'Supabase-Zugang',
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: html`
      <div class="form">
        <div class="group">
          <div class="cell col"><label>Project URL</label><input id="cu" type="url" placeholder="https://xxxx.supabase.co" value="${c.url}" autocapitalize="off" autocorrect="off"></div>
          <div class="cell col"><label>anon / publishable Key</label><textarea id="ck" rows="4" placeholder="eyJhbGciOi… oder sb_publishable_…" autocapitalize="off" autocorrect="off" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px">${c.key}</textarea></div>
        </div>
        <p class="faint" style="font-size:13px">Zu finden in Supabase unter Project Settings → API. Am einfachsten trägst du beides einmal in <code>config.js</code> ein – dann muss das hier niemand mehr tippen.</p>
      </div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'cancel') return sheet.close();
    await setCredentials(sheet.body.querySelector('#cu').value, sheet.body.querySelector('#ck').value);
    sheet.close();
    toast('Zugangsdaten gespeichert', { emoji: '☁️' });
  });
}

function anniversarySheet(existing) {
  const s = settings();
  const sheet = openSheet({
    title: existing ? 'Jahrestag bearbeiten' : 'Eigener Jahrestag',
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: html`
      <div class="form">
        <div class="group">
          <div class="cell"><label>Emoji</label><input id="ae" value="${existing?.emoji || '💍'}" maxlength="4" style="font-size:22px;text-align:right"></div>
          <div class="cell"><label>Name</label><input id="at" placeholder="z. B. Erster Kuss" value="${existing?.title || ''}"></div>
          <div class="cell"><label>Datum</label><input id="ad" type="date" value="${existing?.date || ''}"></div>
        </div>
        ${existing ? html`<button class="btn danger block" data-act="delete">${icon('trash')} Löschen</button>` : ''}
      </div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'cancel') return sheet.close();
    let list = [...(s.anniversaries || [])];
    if (t.dataset.act === 'delete') list = list.filter((a) => a.id !== existing.id);
    if (t.dataset.act === 'save') {
      const a = { id: existing?.id || uuid(), emoji: sheet.body.querySelector('#ae').value.trim() || '📅', title: sheet.body.querySelector('#at').value.trim(), date: sheet.body.querySelector('#ad').value };
      if (!a.title || !a.date) { toast('Bitte Name und Datum angeben', { emoji: '📅' }); return; }
      list = existing ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a];
    }
    await saveSettings({ anniversaries: list });
    sheet.close();
  });
}

export async function render(el) {
  const s = settings();
  const syncHtml = await syncSection();
  const standalone = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

  el.innerHTML = String(html`
    ${topbar({ title: 'Einstellungen', back: true })}
    <div class="page">
      <h1 class="large-title">Einstellungen</h1>
      <div class="form" style="margin-top:14px">

        <div>
          <div class="group-label">Wir zwei</div>
          <div class="group">
            <div class="cell"><label>Name 1</label><input data-s="name-a" value="${s.names.a}" placeholder="Name"></div>
            <div class="cell"><label>Name 2</label><input data-s="name-b" value="${s.names.b}" placeholder="Name"></div>
            <div class="cell"><label>Zusammen seit</label><input type="date" data-s="startDate" value="${s.startDate || ''}"></div>
            <div class="cell"><label>🎂 ${nameOf('a')}</label><input type="date" data-s="bday-a" value="${s.birthdays.a || ''}"></div>
            <div class="cell"><label>🎂 ${nameOf('b')}</label><input type="date" data-s="bday-b" value="${s.birthdays.b || ''}"></div>
            <button class="cell link" data-act="home" style="width:100%;text-align:left">
              <label>Zuhause</label>
              <span class="value grow ellipsis">${s.home ? html`${flag(s.home.countryCode)} ${placeLabel(s.home)}` : 'Festlegen'}</span>
              <span class="chev">${icon('chevron')}</span>
            </button>
          </div>
          <div class="group-foot">Vom Zuhause aus zeichnet der Globus Bögen zu euren Reisen.</div>
        </div>

        <div>
          <div class="group-label">Eigene Jahrestage</div>
          <div class="group">
            ${(s.anniversaries || []).map((a) => html`<button class="cell link" data-anniv="${a.id}" style="width:100%;text-align:left"><span style="font-size:20px">${a.emoji}</span><span class="grow">${a.title}</span><span class="value">${fmtDate(a.date)}</span><span class="chev">${icon('chevron')}</span></button>`)}
            <button class="cell link" data-act="anniv-add" style="width:100%;text-align:left"><span class="cell-icon">${icon('plus')}</span><span class="grow rose">Jahrestag hinzufügen</span></button>
          </div>
          <div class="group-foot">Erscheinen als Countdown auf der Startseite.</div>
        </div>

        <div>
          <div class="group-label">Dieses iPhone gehört</div>
          <div class="seg">
            <button class="${me() === 'a' ? 'active' : ''}" data-me="a">${nameOf('a')}</button>
            <button class="${me() === 'b' ? 'active' : ''}" data-me="b">${nameOf('b')}</button>
          </div>
          <div class="group-foot">Bestimmt, welche Bewertung „deine“ ist und an wen Briefe gehen.</div>
        </div>

        <div>
          <div class="group-label">Darstellung</div>
          <div class="seg">
            ${[['system', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => html`<button class="${getThemePref() === k ? 'active' : ''}" data-theme-pref="${k}">${l}</button>`)}
          </div>
          <div class="group-foot">„Automatisch“ folgt der Einstellung deines iPhones (hell am Tag, dunkel am Abend).</div>
        </div>

        <div>
          <div class="group-label">Synchronisation</div>
          ${syncHtml}
        </div>

        <div>
          <div class="group-label">Backup</div>
          <div class="group">
            <button class="cell link" data-act="export" style="width:100%;text-align:left"><span class="cell-icon">${icon('download')}</span><span class="grow">Backup exportieren</span><span class="chev">${icon('chevron')}</span></button>
            <button class="cell link" data-act="import" style="width:100%;text-align:left"><span class="cell-icon">${icon('upload')}</span><span class="grow">Backup importieren</span><span class="chev">${icon('chevron')}</span></button>
          </div>
          <input type="file" id="imp" accept="application/json,.json" hidden>
        </div>

        <div>
          <div class="group-label">App</div>
          <div class="group">
            ${!standalone ? html`<button class="cell link" data-act="install" style="width:100%;text-align:left"><span class="cell-icon">${icon('share')}</span><span class="grow">Zum Home-Bildschirm hinzufügen</span><span class="chev">${icon('chevron')}</span></button>` : ''}
            <div class="cell"><span class="cell-icon">${icon('heart')}</span><span class="grow">Couple Journal</span><span class="value">Version ${APP_VERSION}</span></div>
            <button class="cell link" data-act="reset" style="width:100%;text-align:left"><span class="cell-icon danger">${icon('trash')}</span><span class="grow" style="color:var(--danger)">Daten auf diesem iPhone löschen</span></button>
          </div>
        </div>
        <p class="center faint" style="font-size:12.5px">Mit ♡ gemacht für ${nameOf('a')} &amp; ${nameOf('b')}</p>
      </div>
    </div>`);
  afterPaint(el);

  const saveField = async (key, value) => {
    const cur = settings();
    if (key === 'name-a' || key === 'name-b') {
      const slot = key.slice(-1);
      if (!value.trim()) return;
      await saveSettings({ names: { ...cur.names, [slot]: value.trim() } });
    } else if (key === 'bday-a' || key === 'bday-b') {
      await saveSettings({ birthdays: { ...cur.birthdays, [key.slice(-1)]: value || null } });
    } else if (key === 'startDate') {
      if (value) await saveSettings({ startDate: value });
    }
  };

  const onChange = (e) => {
    const k = e.target.dataset.s;
    if (k) saveField(k, e.target.value);
    if (e.target.id === 'imp' && e.target.files?.[0]) { const f = e.target.files[0]; e.target.value = ''; importBackup(f); }
  };
  const onSubmit = async (e) => {
    if (e.target.id !== 'login') return;
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await login(el.querySelector('#le').value, el.querySelector('#lp').value);
      toast('Angemeldet – Sync läuft ♡', { emoji: '☁️' });
      refresh();
    } catch (ex) {
      toast(ex.message, { emoji: '⚠️', duration: 3500 });
      btn.disabled = false;
    }
  };
  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-me], [data-anniv], [data-theme-pref]');
    if (!t) return;
    if (t.dataset.themePref) {
      setThemePref(t.dataset.themePref);
      el.querySelectorAll('[data-theme-pref]').forEach((b) => b.classList.toggle('active', b === t));
      return;
    }
    if (t.dataset.me) { await setDevice({ me: t.dataset.me }); refresh(); return; }
    if (t.dataset.anniv) { anniversarySheet((settings().anniversaries || []).find((a) => a.id === t.dataset.anniv)); return; }
    switch (t.dataset.act) {
      case 'import': el.querySelector('#imp').click(); break;
      case 'home': {
        const p = await pickPlace({ current: settings().home, title: 'Euer Zuhause' });
        if (p !== undefined) await saveSettings({ home: p });
        break;
      }
      case 'anniv-add': anniversarySheet(null); break;
      case 'creds': credentialsSheet(); break;
      case 'sync': syncNow(); break;
      case 'logout':
        if (await confirmDialog({ title: 'Abmelden?', message: 'Deine Daten bleiben auf diesem iPhone, werden aber nicht mehr abgeglichen.', ok: 'Abmelden', danger: true })) { await logout(); refresh(); }
        break;
      case 'export': {
        const v = await actionSheet({ title: 'Backup exportieren', items: [{ label: 'Komplett mit Fotos', emoji: '📸', value: 'full' }, { label: 'Nur Texte & Bewertungen', emoji: '📝', value: 'text' }] });
        if (v) exportBackup(v === 'full');
        break;
      }
      case 'install':
        openSheet({
          title: 'Auf den Home-Bildschirm',
          body: html`
            <div class="stack" style="font-size:16px">
              <p>1. Öffne diese Seite in <strong>Safari</strong>.</p>
              <p>2. Tippe unten auf <span class="share-ico">${icon('share', 'i')}</span> <strong>Teilen</strong>.</p>
              <p>3. Wähle <strong>„Zum Home-Bildschirm“</strong> und tippe auf <strong>Hinzufügen</strong>.</p>
              <p class="muted">Danach startet Couple Journal wie eine richtige App – im Vollbild, ohne Browserleiste.</p>
            </div>`,
        });
        break;
      case 'reset': {
        const ok = await confirmDialog({ title: 'Alle Daten löschen?', message: isConfigured() ? 'Alles auf diesem iPhone wird gelöscht. Was bereits synchronisiert ist, bleibt in der Cloud.' : 'Alle Erinnerungen und Fotos auf diesem iPhone werden gelöscht. Erstelle vorher ein Backup!', ok: 'Löschen', danger: true });
        if (!ok) return;
        await logout().catch(() => {});
        await wipeAll();
        try { localStorage.clear(); sessionStorage.clear(); } catch {}
        location.hash = '';
        location.reload();
        break;
      }
    }
  };
  el.addEventListener('change', onChange);
  el.addEventListener('submit', onSubmit);
  el.addEventListener('click', onClick);
  const offStatus = onStatus((st) => {
    const box = el.querySelector('#sync-status');
    if (box) box.innerHTML = String(statusPill(st));
  });
  return () => {
    el.removeEventListener('change', onChange);
    el.removeEventListener('submit', onSubmit);
    el.removeEventListener('click', onClick);
    offStatus();
  };
}

