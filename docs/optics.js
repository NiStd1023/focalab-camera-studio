export const focalLengths = [18, 24, 35, 50, 70, 85, 105, 135, 200, 300, 600];
const minFocus = [.25, .28, .30, .45, .60, .80, 1, 1.1, 1.5, 2.2, 4];
export const apertures = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const shutters = [30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 /
  10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400,
  1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000
];
export const isos = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000,
  10000, 12800, 16000, 20000, 25600
];
export const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
export const scenes = {
  taipei: {
    name: '雨後台北',
    detail: '城市街拍・移動車流',
    src: './assets/taipei.webp',
    ev: Math.log2(500),
    k: 4500,
    focus: 8,
    point: [.577, .579],
    axis: [.525, .52],
    motion: 1
  },
  tea: {
    name: '山間茶園',
    detail: '日光風景・多層景深',
    src: './assets/tea.webp',
    ev: 13,
    k: 5600,
    focus: 24,
    point: [.718, .451],
    axis: [.53, .50],
    motion: .45
  }
};
export const modeNames = {
  P: '程式自動',
  S: '快門先決',
  A: '光圈先決',
  M: '手動曝光'
};
export function shutterText(t) {
  if (t >= 1) return String(Number(t.toFixed(1)));
  if (t > .34) return String(Number(t.toFixed(1)));
  return '1/' + Math.round(1 / t);
}
export function distText(m) {
  if (!Number.isFinite(m) || m > 999) return '∞';
  return (m < 10 ? (m < 1 ? m.toFixed(2) : m.toFixed(1)) : m.toFixed(m < 30 ? 1 : 0)) + ' m';
}
export function minimumFocus(f) {
  return minFocus[focalLengths.indexOf(f)] || .3;
}
export function focusFromDial(v, f) {
  return +v >= 99.9 ? Infinity : minimumFocus(f) * Math.pow(150 / minimumFocus(f), v / 100);
}
export function dialFromFocus(m, f) {
  return Number.isFinite(m) ? clamp(100 * Math.log(m / minimumFocus(f)) / Math.log(150 / minimumFocus(f)), 0, 99.8) : 100;
}
export function angle(f) {
  return 2 * Math.atan(36 / (2 * f)) * 180 / Math.PI;
}
export function dof(f, n, meters) {
  const s = meters * 1000,
    h = f * f / (n * .03);
  if (!Number.isFinite(s)) return [h / 1000, Infinity];
  return [h * s / (h + s - f) / 1000, h <= s - f ? Infinity : h * s / (h - s + f) / 1000];
}
export function allowedTime(s) {
  return Math.pow(2, s.isOn ? s.stops : 0) / (s.focal * s.steadyFactor);
}
export function safeDisplay(s) {
  const t = allowedTime(s);
  return shutterText(shutters.find(v => v <= t * (1 + 1e-8)) ?? shutters.at(-1)) + ' s';
}
export function cropFor(w, h, f, axis = [.5, .5]) {
  const view = 16 / 9,
    ratio = w / h,
    z = f / 18;
  const cw = Math.min(1, view / ratio) / z,
    ch = Math.min(1, ratio / view) / z;
  return {
    x: clamp(axis[0] - cw / 2, 0, 1 - cw),
    y: clamp(axis[1] - ch / 2, 0, 1 - ch),
    w: cw,
    h: ch
  };
}
export function nearest(list, value) {
  return list.reduce((prev, v) => Math.abs(Math.log2(v / value)) < Math.abs(Math.log2(prev / value)) ? v : prev);
}
export function exposure(ev, s) {
  return ev - Math.log2(s.aperture * s.aperture / (s.shutter * s.iso / 100));
}
export function solveExposure(s, ev) {
  if (s.mode === 'M') return;
  const factor = Math.pow(2, ev - s.comp) * s.iso / 100;
  if (s.mode === 'S') {
    s.aperture = nearest(apertures, Math.sqrt(s.shutter * factor));
    return;
  }
  if (s.mode === 'A') {
    s.shutter = nearest(shutters, s.aperture * s.aperture / factor);
    return;
  }
  const preferred = Math.max(1.4, Math.min(11, Math.sqrt(factor * Math.min(1 / 80, allowedTime(s)))));
  let best = Infinity;
  for (const a of apertures) {
    const t = nearest(shutters, a * a / factor);
    const mismatch = Math.abs(Math.log2(a * a / (factor * t)));
    const cost = Math.max(0, mismatch - .18) * 9 + Math.abs(Math.log2(a / preferred)) + .02 * mismatch;
    if (cost < best) {
      best = cost;
      s.aperture = a;
      s.shutter = t;
    }
  }
}
export function illuminant(k) {
  const v = clamp(k, 2000, 10000) / 100;
  const r = v <= 66 ? 255 : 329.6987 * Math.pow(v - 60, -.133205);
  const g = v <= 66 ? 99.4708 * Math.log(v) - 161.1196 : 288.1222 * Math.pow(v - 60, -.075515);
  const b = v >= 66 ? 255 : 138.5177 * Math.log(v - 10) - 305.0448;
  return [r, g, b].map(x => clamp(x / 255, .05, 1));
}
export function wbGain(env, wb) {
  const a = illuminant(env),
    b = illuminant(wb);
  const rgb = a.map((x, i) => Math.pow(x / b[i], 1.30));
  const y = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return rgb.map(x => x / y);
}
export function imageStats(img) {
  const c = document.createElement('canvas');
  c.width = 112;
  c.height = Math.max(20, Math.round(112 * img.height / img.width));
  const ctx = c.getContext('2d', {
    willReadFrequently: true
  });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const luma = new Float32Array(c.width * c.height),
    candidates = [];
  let ysum = 0;
  for (let i = 0; i < luma.length; i++) {
    let [r, g, b] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const y = .2126 * r + .7152 * g + .0722 * b;
    luma[i] = Math.pow(y / 255, 2.2);
    ysum += luma[i];
    if (y > 40 && y < 245 && r > 12 && b > 12) candidates.push({
      r,
      b,
      sat: (Math.max(r, g, b) - Math.min(r, g, b)) / y,
      y
    });
  }
  candidates.sort((a, b) => a.sat - b.sat);
  let rsum = 0,
    bsum = 0;
  const subset = candidates.slice(0, Math.max(4, Math.round(candidates.length * .35)));
  for (const p of subset) {
    rsum += p.r * p.y;
    bsum += p.b * p.y;
  }
  let k = 5500,
    err = Infinity;
  if (rsum && bsum) {
    for (let n = 2000; n <= 10000; n += 100) {
      const rgb = illuminant(n),
        e = Math.abs(Math.log(rsum / bsum) - Math.log(rgb[0] / rgb[2]));
      if (e < err) {
        err = e;
        k = n;
      }
    }
  }
  return {
    luma,
    w: c.width,
    h: c.height,
    k,
    avg: ysum / luma.length
  };
}
export function measure(stats, crop, kind, point) {
  let sum = 0,
    weights = 0;
  const px = clamp((point[0] - crop.x) / crop.w, .035, .965),
    py = clamp((point[1] - crop.y) / crop.h, .035, .965);
  for (let j = 0; j < 24; j++)
    for (let i = 0; i < 38; i++) {
      const x = (i + .5) / 38,
        y = (j + .5) / 24;
      let weight = 1;
      if (kind === 'spot') weight = Math.exp(-((x - px) ** 2 * 2.5 + (y - py) ** 2) * 310);
      else if (kind === 'center') weight = .12 + Math.exp(-((x - .5) ** 2 * 1.65 + (y - .5) ** 2) * 12);
      const col = Math.min(stats.w - 1, Math.floor((crop.x + x * crop.w) * stats.w));
      const row = Math.min(stats.h - 1, Math.floor((crop.y + y * crop.h) * stats.h));
      sum += stats.luma[row * stats.w + col] * weight;
      weights += weight;
    }
  return Math.max(.003, sum / weights);
}
const taxi = [
  [.427, .602],
  [.445, .577],
  [.497, .558],
  [.536, .521],
  [.594, .510],
  [.594, .494],
  [.624, .494],
  [.627, .512],
  [.669, .516],
  [.696, .553],
  [.730, .565],
  [.740, .629],
  [.721, .643],
  [.707, .645],
  [.697, .663],
  [.677, .669],
  [.661, .657],
  [.657, .645],
  [.555, .647],
  [.547, .663],
  [.526, .674],
  [.510, .665],
  [.504, .648],
  [.431, .644]
];
const smooth = t => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export function depthMap(w, h, scene, anchor, marks = []) {
  const c = document.createElement('canvas');
  c.width = 420;
  c.height = clamp(Math.round(c.width * h / w), 64, 760);
  const ctx = c.getContext('2d', {
    willReadFrequently: true
  });
  const cw = c.width,
    ch = c.height;
  if (!anchor && scene === 'taipei') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    taxi.forEach(([x, y], i) => i ? ctx.lineTo(x * cw, y * ch) : ctx.moveTo(x * cw, y * ch));
    ctx.closePath();
    ctx.fill();
  }
  const src = ctx.getImageData(0, 0, cw, ch);
  const data = src.data,
    inv = new Float32Array(cw * ch),
    mask = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const p = y * cw + x,
        u = (x + .5) / cw,
        v = (y + .5) / ch;
      const road = clamp((v - .53) / .47, 0, 1),
        side = Math.abs((u - .47) * 2);
      let di, m = 0;
      if (scene === 'taipei') {
        const car = (!anchor ? data[p * 4 + 3] / 255 : insideTaxi(u, v));
        di = .0035 + Math.max(road * .38, side * side * .25);
        di = di * (1 - car) + .125 * car;
        m = car;
      } else if (scene === 'tea') {
        di = .0015 + .93 * Math.pow(clamp((v - .35) / .65, 0, 1), 2.3);
        const hut = smooth(1 - (((u - .718) / .14) ** 2 + ((v - .452) / .09) ** 2));
        di = di * (1 - hut) + hut / 24;
        m = smooth((v - .61) / .32) * .8;
      } else {
        di = .004 + .8 * Math.pow(clamp((v - .25) / .75, 0, 1), 1.85) + Math.pow(Math.abs(u - .5) * 2, 2) * .018;
        m = smooth((1 - (((u - .5) / .17) ** 2 + ((v - .58) / .14) ** 2)) * 4);
      }
      if (anchor) m = smooth((1 - (((u - anchor.x) / anchor.rx) ** 2 + ((v - anchor.y) / anchor.ry) ** 2)) * 4);
      for (const mark of marks) {
        const a = smooth(1 - (((u - mark.x) / mark.rx) ** 2 + ((v - mark.y) / mark.ry) ** 2));
        di = di * (1 - a) + a / mark.m;
      }
      inv[p] = di;
      mask[p] = m;
      const q = clamp(Math.round(di / 4 * 65535), 0, 65535);
      data[p * 4] = q >> 8;
      data[p * 4 + 1] = q & 255;
      data[p * 4 + 2] = Math.round(m * 255);
      data[p * 4 + 3] = 255;
    }
  ctx.putImageData(src, 0, 0);
  return {
    canvas: c,
    inv,
    mask,
    w: cw,
    h: ch
  };
}

function insideTaxi(x, y) {
  let inside = false;
  for (let i = 0, j = taxi.length - 1; i < taxi.length; j = i++) {
    const [a, b] = taxi[i], [c, d] = taxi[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside;
  }
  return +inside;
}
export function sampleMap(map, u, v) {
  const idx = clamp(Math.round(v * (map.h - 1)), 0, map.h - 1) * map.w + clamp(Math.round(u * (map.w - 1)), 0, map.w - 1);
  return {
    di: map.inv[idx],
    motion: map.mask[idx]
  };
}
export function effectParams(s, crop, w, h, ev, seed = 1) {
  const safe = allowedTime(s);
  const sh = Math.max(0, Math.log2(s.shutter / safe)),
    shake = Math.min(.07, (Math.pow(2, Math.min(5, sh)) - 1) * .0018);
  const subject = s.hasMotionSubject === false ? 0 : Math.min(.25, s.motionSpeed * s.shutter * s.focal / 35 * .57);
  const a = s.motionDir * Math.PI / 180;
  const inv = Number.isFinite(s.focus) ? 1 / s.focus : 0;
  return {
    crop,
    inv,
    blur: s.focal * s.focal * crop.w * w / (36000 * s.aperture * Math.max(.2, 1 - s.focal * inv / 1000)) * 1.65,
    gain: wbGain(s.envK, s.wbK),
    light: Math.pow(2, clamp(ev, -14, 14)),
    noise: Math.min(.133, .0019 * Math.pow(s.iso / 100, .69)),
    seed,
    motion: [subject * Math.cos(a) * crop.w, subject * Math.sin(a) * crop.w * w / h],
    shake: [shake * crop.w, shake * crop.w * w / h * .56]
  };
}
