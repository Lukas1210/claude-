// Linien-Icons (24×24) im iOS-Stil.
import { raw } from './dom.js';

const P = {
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.7 3.4 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6h2c.7-1.4 2.2-2.6 4.3-2.6 3.3 0 5.3 3.2 4 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"/>',
  heartFill: '<path fill="currentColor" stroke="none" d="M12 21.2c-.2 0-.4-.1-.6-.2C10.9 20.7 3 15.8 1.1 10.8.4 8.9.6 6.9 1.7 5.4 2.8 3.9 4.6 3 6.6 3c2.2 0 4 1 5.4 2.6C13.4 4 15.2 3 17.4 3c2 0 3.8.9 4.9 2.4 1.1 1.5 1.3 3.5.6 5.4-1.9 5-9.8 9.9-10.3 10.2-.2.1-.4.2-.6.2z"/>',
  heartHalf: '<defs><clipPath id="hh"><rect x="0" y="0" width="12" height="24"/></clipPath></defs><path fill="currentColor" opacity=".2" stroke="none" d="M12 21.2c-.2 0-.4-.1-.6-.2C10.9 20.7 3 15.8 1.1 10.8.4 8.9.6 6.9 1.7 5.4 2.8 3.9 4.6 3 6.6 3c2.2 0 4 1 5.4 2.6C13.4 4 15.2 3 17.4 3c2 0 3.8.9 4.9 2.4 1.1 1.5 1.3 3.5.6 5.4-1.9 5-9.8 9.9-10.3 10.2-.2.1-.4.2-.6.2z"/><path clip-path="url(#hh)" fill="currentColor" stroke="none" d="M12 21.2c-.2 0-.4-.1-.6-.2C10.9 20.7 3 15.8 1.1 10.8.4 8.9.6 6.9 1.7 5.4 2.8 3.9 4.6 3 6.6 3c2.2 0 4 1 5.4 2.6C13.4 4 15.2 3 17.4 3c2 0 3.8.9 4.9 2.4 1.1 1.5 1.3 3.5.6 5.4-1.9 5-9.8 9.9-10.3 10.2-.2.1-.4.2-.6.2z"/>',
  home: '<path d="M12 20s-6.5-4-8-8c-1.1-3 .6-5.6 3.4-5.6 1.8 0 3.1 1 3.7 2.2h1.8c.6-1.2 1.9-2.2 3.7-2.2 2.8 0 4.5 2.6 3.4 5.6-1.5 4-8 8-8 8z"/><path d="M9 12.3h6M12 9.3v6" opacity=".0"/>',
  timeline: '<path d="M7 3v18"/><circle cx="7" cy="6.5" r="2.2" fill="currentColor"/><circle cx="7" cy="13" r="2.2" fill="currentColor"/><path d="M11.5 6.5H20M11.5 13H18M11.5 19H16"/><circle cx="7" cy="19" r="1.4" fill="currentColor"/>',
  sparkles: '<path d="M10 3.5l1.6 4.6 4.6 1.6-4.6 1.6L10 16l-1.6-4.7-4.6-1.6 4.6-1.6z"/><path d="M18 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  gallery: '<rect x="3" y="4" width="18" height="16" rx="3.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M3.5 17l5-4.5 4 3.5 3-2.5 5 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  starFill: '<path fill="currentColor" d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H5.5v10h13v-10H17"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 00.5-8 6 6 0 00-11.6 1.6A3.3 3.3 0 007 18.5z"/>',
  letter: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.2" fill="currentColor"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19M12 9v11.5"/><path d="M12 9S10.5 4 7.8 4.6C5.5 5.1 6.4 8.5 12 9zM12 9s1.5-5 4.2-4.4c2.3.5 1.4 3.9-4.2 4.4z"/>',
  sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',
  locate: '<path d="M20.5 3.5L3.5 10.8l7.3 2.4 2.4 7.3z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 018 0v2.7"/>',
  refresh: '<path d="M20 11.5A8 8 0 006.3 6.3L4 8.5M4 4v4.5h4.5M4 12.5a8 8 0 0013.7 5.2L20 15.5M20 20v-4.5h-4.5"/>',
  shuffle: '<path d="M3.5 7h3.5c4.5 0 5.5 10 10 10h3.5M17.5 14l3 3-3 3M3.5 17H7c1.5 0 2.6-1.1 3.4-2.6M13.6 9.6C14.4 8.1 15.5 7 17 7h3.5M17.5 4l3 3-3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  minus: '<path d="M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4v4h-4"/>',
};

export function icon(name, cls = 'i') {
  return raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
}

export const iconStr = (name, cls) => String(icon(name, cls));
