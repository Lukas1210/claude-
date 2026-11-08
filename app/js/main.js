// App-Start: Daten laden, Hülle aufbauen, Router starten, Service Worker & Sync.
import { loadStore, getDevice } from './store.js';
import { route, startRouter, go, currentRoute } from './router.js';
import { applyTheme } from './theme.js';
import { actionSheet, toast } from './ui/sheet.js';
import { icon } from './ui/icons.js';
import { html } from './ui/dom.js';
import { CATEGORIES } from './model.js';
import { initSync } from './sync.js';

const views = {
  home: () => import('./views/home.js'),
  timeline: () => import('./views/timeline.js'),
  entries: () => import('./views/entries.js'),
  entry: () => import('./views/entry-detail.js'),
  globe: () => import('./views/globe.js'),
  gallery: () => import('./views/gallery.js'),
  calendar: () => import('./views/calendar.js'),
  event: () => import('./views/event-detail.js'),
  bucket: () => import('./views/bucket.js'),
  letters: () => import('./views/letters.js'),
  stats: () => import('./views/stats.js'),
  settings: () => import('./views/settings.js'),
};

route('/', views.home, { tab: 'home', root: true });
route('/calendar', views.calendar, { tab: 'calendar', root: true });
route('/timeline', views.timeline, { tab: 'timeline', root: true });
route('/entries', views.entries, { tab: 'entries', root: true });
route('/globe', views.globe, { tab: 'globe', root: true, fab: false });
route('/gallery', views.gallery, { tab: 'home' });
route('/entry/:id', views.entry, { fab: false });
route('/event/:id', views.event, { fab: false });
route('/bucket', views.bucket, { tab: 'home' });
route('/letters', views.letters, { tab: 'home' });
route('/stats', views.stats, { tab: 'home', fab: false });
route('/settings', views.settings, { tab: 'home', fab: false });

const TAB_DEF = [
  { tab: 'home', path: '/', label: 'Wir', icon: 'heart' },
  { tab: 'calendar', path: '/calendar', label: 'Kalender', icon: 'calendar' },
  { tab: 'timeline', path: '/timeline', label: 'Timeline', icon: 'timeline' },
  { tab: 'entries', path: '/entries', label: 'Erlebnisse', icon: 'sparkles' },
  { tab: 'globe', path: '/globe', label: 'Globus', icon: 'globe' },
];

function buildShell() {
  const tabbar = document.getElementById('tabbar');
  tabbar.innerHTML = String(html`${TAB_DEF.map((t) => html`<button class="tab" data-tab="${t.tab}" data-path="${t.path}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`)}`);
  tabbar.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    const cur = currentRoute();
    if (cur && cur.route.root && cur.route.tab === b.dataset.tab) {
      document.getElementById('scroller').scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    go(b.dataset.path);
  });

  const fab = document.getElementById('fab');
  fab.innerHTML = String(icon('plus'));
  fab.addEventListener('click', () => {
    // Im Kalender legt "+" direkt einen Termin am gewählten Tag an
    const cur = currentRoute();
    if (cur?.route.tab === 'calendar' && cur.route.root && cur.mod?.addEvent) cur.mod.addEvent();
    else openAddMenu();
  });
}

let fileInput;
/** Globales Datei-Feld für Fotos ohne Erlebnis (muss auf iOS direkt im Tipp-Ereignis geöffnet werden). */
export function photoInput() {
  if (fileInput) return fileInput;
  fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.hidden = true;
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    if (!files.length) return;
    const { addLoosePhotos } = await import('./views/gallery.js');
    addLoosePhotos(files);
  });
  return fileInput;
}

export async function openAddMenu() {
  const items = [
    { label: 'Termin', emoji: '📅', value: 'event' },
    ...Object.values(CATEGORIES).map((c) => ({ label: c.label, emoji: c.emoji, value: `entry:${c.key}` })),
    { label: 'Meilenstein', emoji: '💞', value: 'milestone' },
    { label: 'Fotos', emoji: '📸', value: 'photos', onSelect: () => photoInput().click() },
    { label: 'Wunsch', emoji: '🌠', value: 'wish' },
    { label: 'Liebesbrief', emoji: '💌', value: 'letter' },
  ];
  const v = await actionSheet({ title: 'Neue Erinnerung', items, layout: 'grid' });
  if (!v) return;
  if (v === 'event') {
    const { openEventForm } = await import('./views/event-form.js');
    openEventForm();
  } else if (v.startsWith('entry:')) {
    const { openEntryForm } = await import('./views/entry-form.js');
    openEntryForm({ category: v.split(':')[1] });
  } else if (v === 'milestone') {
    const { openMilestoneForm } = await import('./views/timeline.js');
    openMilestoneForm();
  } else if (v === 'wish') {
    const { openWishForm } = await import('./views/bucket.js');
    openWishForm();
  } else if (v === 'letter') {
    const { openLetterForm } = await import('./views/letters.js');
    openLetterForm();
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const promptUpdate = (worker) => {
      toast('Neue Version verfügbar', {
        emoji: '✨',
        actionLabel: 'Aktualisieren',
        duration: 0,
        onAction: () => worker.postMessage('skipWaiting'),
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW', e));
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return; // erste Installation: kein Neuladen nötig
    reloading = true;
    location.reload();
  });
}

async function boot() {
  try {
    await loadStore();
  } catch (e) {
    document.getElementById('view').innerHTML = '<div class="empty"><span class="em">😢</span><h3>Speicher nicht verfügbar</h3><p>Bitte öffne die App nicht im privaten Modus.</p></div>';
    return;
  }
  applyTheme();
  buildShell();
  registerSW();
  const splash = document.getElementById('splash');
  if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 450); }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  if (!getDevice().onboarded) {
    const { runOnboarding } = await import('./views/onboarding.js');
    await runOnboarding();
  }
  document.getElementById('app').classList.remove('hidden');
  startRouter();
  initSync();
}

boot();
