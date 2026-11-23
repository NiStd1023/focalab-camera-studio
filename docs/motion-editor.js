import { clamp } from './optics.js?v=mask3';
import { drawCrop, emptySelection, fullFrame, imagePoint, newMaskCanvas, nextSelection, paintSelection, paintStroke, readMask } from './motion-mask.js?v=mask3';

export function startMotionEditor(root, { photo, preset, initial, crop, apply, close }) {
  const get = id => root.querySelector('#' + id);
  const frame = root.querySelector('.mask-frame');
  const surface = root.querySelector('.mask-surface');
  const display = surface.getContext('2d');
  const bitmap = newMaskCanvas(photo), ink = bitmap.getContext('2d', {willReadFrequently:true});
  const brush = get('maskSize'), hint = get('maskHint'), undo = get('maskUndo'), accept = get('maskApply');
  const tools = [...root.querySelectorAll('[data-mask-tool]')], views = [...root.querySelectorAll('[data-mask-view]')];
  const history = [];
  let value = initial, tool = 'rect', view = crop, active = null, cursor = null, raf = 0;
  const painting = () => tool === 'brush' || tool === 'erase';
  const instructions = {
    point:'點選主體中心，以橢圓取代原有範圍。',
    rect:'從一角拖曳至對角，以矩形取代原有範圍。',
    brush:'沿主體輪廓塗抹，可分多筆補上細節。',
    erase:'塗抹要移除的區域，微調選取邊緣。'
  };
  function requestDraw() {
    if (!raf) raf = requestAnimationFrame(redraw);
  }
  function sync() {
    for (const b of tools) b.setAttribute('aria-pressed', b.dataset.maskTool === tool);
    for (const b of views) b.setAttribute('aria-pressed', (b.dataset.maskView === 'crop') === (view === crop));
    get('maskSizeRow').hidden = !painting();
    get('maskSizeValue').textContent = brush.value + ' px';
    brush.setAttribute('aria-valuetext', brush.value + ' px');
    brush.style.setProperty('--value', (brush.value - brush.min) / (brush.max - brush.min) * 100 + '%');
    undo.disabled = !!active || !history.length;
    accept.disabled = !!active || value === initial;
    hint.textContent = tool === 'brush' && value === null ? '第一筆會取代場景預設範圍，之後可繼續補畫。' : instructions[tool];
    surface.setAttribute('aria-label', '主體範圍畫布，' + hint.textContent);
    surface.classList.toggle('round-tool', painting());
    requestDraw();
  }
  function fit() {
    const ratio = photo.width * view.w / (photo.height * view.h);
    const width = Math.min(frame.clientWidth, frame.clientHeight * ratio);
    if (width < 1) return;
    const height = width / ratio, dpr = Math.min(2, window.devicePixelRatio || 1);
    surface.style.width = width + 'px';
    surface.style.height = height + 'px';
    surface.width = Math.max(1, Math.round(width * dpr));
    surface.height = Math.max(1, Math.round(height * dpr));
    requestDraw();
  }
  function redraw() {
    raf = 0;
    const box = surface.getBoundingClientRect(), w = box.width, h = box.height;
    if (!w || !h) return;
    display.setTransform(surface.width / w, 0, 0, surface.height / h, 0, 0);
    display.globalAlpha = 1;
    drawCrop(display, photo, view, w, h);
    const screen = point => [(point[0] - view.x) / view.w * w, (point[1] - view.y) / view.h * h];
    if (active?.tool === 'rect') {
      const [x,y] = screen(active.start), [x2,y2] = screen(active.end);
      display.save();
      display.fillStyle = 'rgba(56,218,204,.5)';
      display.fillRect(x, y, x2 - x, y2 - y);
      display.setLineDash([5,3]);
      display.strokeStyle = '#d6fff8';
      display.lineWidth = 1.5;
      display.strokeRect(x, y, x2 - x, y2 - y);
      display.restore();
    } else {
      display.globalAlpha = .52;
      drawCrop(display, bitmap, view, w, h);
      display.globalAlpha = 1;
    }
    if (cursor && (painting() || surface.matches(':focus-visible'))) {
      const [x,y] = screen(cursor);
      display.beginPath();
      display.arc(x, y, painting() ? +brush.value / 2 : 5, 0, Math.PI * 2);
      display.lineWidth = 3;
      display.strokeStyle = '#101516';
      display.stroke();
      display.lineWidth = 1.3;
      display.strokeStyle = tool === 'erase' ? '#ffd087' : '#effffc';
      display.stroke();
    }
  }
  function remember(op) {
    history.push(value);
    if (history.length > 40) history.shift();
    value = nextSelection(value, op);
    paintSelection(bitmap, value, preset);
    sync();
  }
  function cancelGesture() {
    if (!active) return;
    const id = active.id;
    active = null;
    if (typeof id === 'number' && surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    paintSelection(bitmap, value, preset);
    sync();
  }
  function undoEdit() {
    if (active || !history.length) return;
    value = history.pop();
    paintSelection(bitmap, value, preset);
    sync();
  }
  function begin(point, id) {
    active = {id, tool, start:point, end:point};
    if (painting()) {
      active.stroke = {tool, radius:+brush.value / 2 / surface.getBoundingClientRect().width * view.w, points:[point]};
      if (tool === 'brush' && value === null) ink.clearRect(0, 0, bitmap.width, bitmap.height);
      paintStroke(ink, active.stroke);
    }
    sync();
  }
  function extend(point) {
    cursor = point;
    if (!active) return requestDraw();
    const last = active.end;
    if (point[0] === last[0] && point[1] === last[1]) return;
    active.end = point;
    if (active.stroke) {
      const stroke = active.stroke;
      stroke.points.push(point);
      paintStroke(ink, stroke, stroke.points.length - 1);
    }
    requestDraw();
  }
  function finish() {
    if (!active) return;
    const op = active;
    active = null;
    const [x,y] = op.start, [x2,y2] = op.end;
    if (op.stroke) return remember(op.stroke);
    if (op.tool === 'point') return remember({tool:'point', x:x2, y:y2, rx:view.w * .15, ry:view.h * .19});
    const w = Math.abs(x2 - x), h = Math.abs(y2 - y);
    if (w * surface.clientWidth / view.w < 2 || h * surface.clientHeight / view.h < 2) {
      sync();
      hint.textContent = '請拖曳出有寬度和高度的矩形。';
      return;
    }
    remember({tool:'rect', x:Math.min(x,x2), y:Math.min(y,y2), w,h});
  }
  const position = event => imagePoint(event.clientX, event.clientY, surface.getBoundingClientRect(), view);
  surface.onpointerdown = e => {
    if (active || e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    surface.focus({preventScroll:true});
    surface.setPointerCapture(e.pointerId);
    cursor = position(e);
    begin(cursor, e.pointerId);
  };
  surface.onpointermove = e => {
    if (!e.isPrimary || (active && active.id !== e.pointerId)) return;
    if (active?.stroke && e.getCoalescedEvents) for (const sample of e.getCoalescedEvents()) extend(position(sample));
    extend(position(e));
  };
  surface.onpointerup = e => {
    if (active?.id !== e.pointerId) return;
    extend(position(e));
    finish();
    if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
    if (e.pointerType === 'touch') cursor = null;
    requestDraw();
  };
  surface.onlostpointercapture = surface.onpointercancel = e => {
    if (active?.id === e.pointerId) cancelGesture();
  };
  surface.onpointerleave = () => { if (!active) { cursor = null; requestDraw(); } };
  surface.onkeydown = e => {
    if (active && active.id !== 'keyboard') return;
    const center = cursor || [view.x + .5 * view.w, view.y + .5 * view.h];
    const delta = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[e.key];
    if (delta) {
      e.preventDefault();
      const step = e.shiftKey ? .05 : .01;
      extend([clamp(center[0] + delta[0] * step * view.w, view.x, view.x + view.w),
              clamp(center[1] + delta[1] * step * view.h, view.y, view.y + view.h)]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.repeat) return;
      if (active) finish();
      else { cursor = center; begin(center, 'keyboard'); if (tool === 'point') finish(); }
    } else if (e.key === 'Escape' && active) {
      e.preventDefault();
      e.stopPropagation();
      cancelGesture();
    }
  };
  root.onkeydown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undoEdit(); }
  };
  for (const b of tools) b.onclick = () => { cancelGesture(); tool = b.dataset.maskTool; cursor = null; sync(); };
  for (const b of views) b.onclick = () => { cancelGesture(); view = b.dataset.maskView === 'crop' ? crop : fullFrame; cursor = null; fit(); sync(); };
  brush.oninput = sync;
  undo.onclick = undoEdit;
  get('maskClear').onclick = () => { cancelGesture(); remember({tool:'clear'}); };
  get('maskPreset').onclick = () => { cancelGesture(); remember({tool:'default'}); };
  get('maskCancel').onclick = close;
  accept.onclick = () => {
    if (active || value === initial) return;
    const compiled = value ? readMask(bitmap) : null;
    apply(value && !compiled ? emptySelection() : value, compiled);
    close();
  };
  paintSelection(bitmap, initial, preset);
  const observer = new ResizeObserver(fit);
  observer.observe(frame);
  fit();
  sync();
  return () => { observer.disconnect(); cancelAnimationFrame(raf); active = null; };
}
