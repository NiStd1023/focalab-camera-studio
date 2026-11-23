/* Local line icons for the camera controls. */
const drawings = {
  'mask-box': '<path d="M4 8V4h4m3 0h2m3 0h4v4m0 3v2m0 3v4h-4m-3 0h-2m-3 0H4v-4m0-3v-2"/>',
  brush: '<path d="m13.4 12.8 6.4-8a1.7 1.7 0 0 0-2.5-2.2l-7 7.4 3.1 2.8Z"/><path d="M12.5 14.5c.7 3.4-2.6 5.6-8.3 5.1 1.6-1 1.9-1.9 2.1-3.6.3-2.3 2.9-4.3 5.2-2.6z"/>',
  eraser: '<path d="m3.5 13.8 8.9-9a2 2 0 0 1 2.8 0l4.5 4.6a2 2 0 0 1 0 2.8l-7.6 7.6H8.7l-5.2-5a.7.7 0 0 1 0-1zM8.8 8.6l7.3 7.3M12 20h9"/>',
  undo: '<path d="M8 4 3 9l5 5M3 9h10c4.5 0 7 2 7 5.7 0 3.2-2.6 5.3-6 5.3"/>',
  aperture: '<circle cx="12" cy="12" r="9.5"/><path d="m14.3 8 5.5 9.5M9.7 8h10.9m-13.2 4 5.5-9.5M9.7 16 4.2 6.5m10.1 9.5h-11m13.3-4-5.5 9.5"/>',
  camera: '<path d="M3 7.5h4l1.5-2.7h7L17 7.5h4v12H3z"/><circle cx="12" cy="13" r="3.4"/>',
  target: '<circle cx="12" cy="12" r="8.7"/><circle cx="12" cy="12" r="5.1"/><circle cx="12" cy="12" r="1.2"/>',
  gallery: '<rect x="5.5" y="3.5" width="15" height="14" rx="2.1"/><path d="m6 14 4-4 3 3 2.5-2.5 4.5 4.5M3 8v11a2 2 0 0 0 2 2h12"/><circle cx="15.5" cy="7.7" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.1a2.8 2.8 0 1 1 4.9 1.9c-1.3.9-2.2 1.3-2.2 3m0 3h.01"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.2" cy="9" r="1.4"/><path d="m4 17 5.5-5 3.8 3.4 3.1-3.8 4.6 4.6"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM3 12l9 4.7 9-4.7M3 16l9 4.7 9-4.7"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 14v5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-5"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.6"/><path d="M9 4v16m6-16v16M4 9h16M4 15h16"/>',
  expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  focus: '<path d="M3 8V4h5m8 0h5v4m0 8v4h-5m-8 0H3v-4"/><circle cx="12" cy="12" r="3.3"/>',
  pin: '<path d="M19 9c0 5.1-7 11.5-7 11.5S5 14.1 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2.2"/>',
  tune: '<path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h3m4 0h11"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1.1 7M3 4v6h6"/>',
  exposure: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="m4 20 16-16M6.3 8.8h5m-2.5-2.5v5m4 4.5h4.8"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  shield: '<path d="m12 3 7.5 3v5.5c0 4.3-2.8 7.5-7.5 9.5-4.7-2-7.5-5.2-7.5-9.5V6z"/><path d="m8 12 2.4 2.5 5.1-5.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M10 3h4m-2 0v3m5.6 2.2 1.7-1.7M12 9v4.5l2 1.2"/>',
  iso: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15v-3m5 3V9m5 6v-4"/>',
  lens: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 6v12m4-12v12m7-12v12M2 9v6"/>',
  meter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 9v2m4-2v2m4-2v2m4-2v2m-6 5 2-4"/>',
  dial: '<path d="M4.4 17a9 9 0 1 1 15.2 0"/><path d="m12 13 4-5m-9 3-.9-.4m4-4-.3-1m5 1 .4-.9m3.2 5.4.9-.4"/><circle cx="12" cy="14" r="1.5"/>',
  book: '<path d="M12 6c-2.7-2-5.4-2.1-9-1v14c3.5-1.2 6.7-1 9 1 2.3-2 5.5-2.2 9-1V5c-3.6-1.1-6.3-1-9 1zm0 0v14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  hand: '<path d="M7 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4.5-2.4 7-6.5 7-2.4 0-4.2-.9-5.8-3l-3.2-4.2c-1.1-1.5.8-3 2-1.9L8 14"/>',
  wind: '<path d="M2 8h12a3 3 0 1 0-3-3m-9 7h17a2.5 2.5 0 1 0-2.5-2.5M4 16h9a2.5 2.5 0 1 1-2.5 2.5"/>',
  flag: '<path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0"/>',
  bulb: '<path d="M8 15c-1.8-1.7-2.5-3-2.5-5.2a6.5 6.5 0 0 1 13 0c0 2.2-.7 3.5-2.5 5.2l-1 2H9zM9.5 20h5"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  mount: '<path d="m2 19 7.5-13 3 5L15 7l7 12zM7 11l2.5 2 2.2-2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 10-13h-7z"/>',
  cross: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  compare: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/>',
  device: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'
};
export function icon(name, cls = '') {
  return '<svg aria-hidden="true" class="ico ' + cls +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (drawings[
      name] || '') + '</svg>';
}
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-i]').forEach(el => {
    el.innerHTML = icon(el.dataset.i);
  });
}
