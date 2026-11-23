import { clamp } from './optics.js?v=mask3';

const tint = '#38dacc';
export const emptySelection = () => ({ base: 'empty', ops: [] });
export const fullFrame = { x: 0, y: 0, w: 1, h: 1 };

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Geometry stays in original-image coordinates across aspect changes, zoom and pan.
export function imagePoint(x, y, box, view) {
  return [
    view.x + clamp((x - box.left) / box.width, 0, 1) * view.w,
    view.y + clamp((y - box.top) / box.height, 0, 1) * view.h
  ];
}

export function defaultMask(map) {
  const canvas = makeCanvas(map.w, map.h);
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(map.w, map.h);
  for (let i = 0; i < map.mask.length; i++) {
    const p = 4 * i;
    pixels.data[p] = 56;
    pixels.data[p + 1] = 218;
    pixels.data[p + 2] = 204;
    pixels.data[p + 3] = Math.round(255 * map.mask[i]);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function newMaskCanvas(photo) {
  const scale = Math.min(1, 2048 / Math.max(photo.width, photo.height));
  return makeCanvas(Math.max(1, Math.round(photo.width * scale)), Math.max(1, Math.round(photo.height * scale)));
}

export function paintStroke(ctx, op, start = 0) {
  const {width, height} = ctx.canvas;
  const r = Math.max(.25, op.radius * width);
  ctx.save();
  ctx.globalCompositeOperation = op.tool === 'erase' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = tint;
  ctx.lineWidth = 2 * r;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  const first = op.points[Math.max(0, start - 1)];
  if (op.points.length === 1) {
    ctx.arc(first[0] * width, first[1] * height, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(first[0] * width, first[1] * height);
    for (let i = Math.max(1, start); i < op.points.length; i++) {
      const [x,y] = op.points[i];
      ctx.lineTo(x * width, y * height);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function paintOp(ctx, op) {
  const {width, height} = ctx.canvas;
  ctx.fillStyle = tint;
  if (op.tool === 'rect') {
    ctx.fillRect(op.x * width, op.y * height, op.w * width, op.h * height);
  } else if (op.tool === 'point') {
    ctx.save();
    ctx.translate(op.x * width, op.y * height);
    ctx.scale(op.rx * width, op.ry * height);
    const edge = ctx.createRadialGradient(0, 0, .81, 0, 0, 1);
    edge.addColorStop(0, tint);
    edge.addColorStop(1, 'rgba(56,218,204,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  } else paintStroke(ctx, op);
}

// null uses the scene preset. An empty custom selection explicitly disables subject motion.
export function nextSelection(previous, op) {
  if (op.tool === 'clear') return emptySelection();
  if (op.tool === 'default') return null;
  if (op.tool === 'rect' || op.tool === 'point') return {base:'empty', ops:[op]};
  const prior = previous || {base:op.tool === 'erase' ? 'scene' : 'empty', ops:[]};
  return {base:prior.base, ops:[...prior.ops, op]};
}

export function paintSelection(canvas, selection, preset) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!selection || selection.base === 'scene') ctx.drawImage(preset, 0, 0, canvas.width, canvas.height);
  if (selection) for (const op of selection.ops) paintOp(ctx, op);
}

export function readMask(canvas) {
  const {width, height} = canvas;
  const pixels = canvas.getContext('2d', {willReadFrequently:true}).getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  let any = false;
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = pixels[i * 4 + 3];
    if (alpha[i]) any = true;
  }
  return any ? {canvas, alpha, width, height} : null;
}

export function compileSelection(photo, selection, preset) {
  if (!selection || (selection.base === 'empty' && !selection.ops.length)) return null;
  const canvas = newMaskCanvas(photo);
  canvas.getContext('2d', {willReadFrequently:true});
  paintSelection(canvas, selection, preset);
  return readMask(canvas);
}

export function sampleAlpha(mask, u, v) {
  const x = clamp(u * mask.width - .5, 0, mask.width - 1);
  const y = clamp(v * mask.height - .5, 0, mask.height - 1);
  const col = Math.floor(x), row = Math.floor(y), i = row * mask.width + col;
  const right = col + 1 < mask.width ? 1 : 0, down = row + 1 < mask.height ? mask.width : 0;
  const dx = x - col, dy = y - row, a = mask.alpha;
  const top = a[i] + dx * (a[i + right] - a[i]);
  const bottom = a[i + down] + dx * (a[i + down + right] - a[i + down]);
  return (top + dy * (bottom - top)) / 255;
}

export function drawCrop(ctx, source, view, width, height) {
  ctx.drawImage(source, view.x * source.width, view.y * source.height, view.w * source.width, view.h * source.height, 0, 0, width, height);
}
