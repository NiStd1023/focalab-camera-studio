import { startMotionEditor } from './motion-editor.js?v=mask3';
import { compileSelection, defaultMask, drawCrop, emptySelection } from './motion-mask.js?v=mask3';
import {
  icon,
  hydrateIcons
} from './icons.js?v=mask3';
import {
  focalLengths,
  apertures,
  shutters,
  isos,
  clamp,
  scenes,
  modeNames,
  shutterText,
  distText,
  minimumFocus,
  focusFromDial,
  dialFromFocus,
  angle,
  dof,
  allowedTime,
  safeDisplay,
  cropFor,
  nearest,
  exposure,
  solveExposure,
  imageStats,
  measure,
  depthMap,
  sampleMap,
  effectParams
} from './optics.js?v=mask3';
import {
  CameraRenderer
} from './renderer.js?v=mask3';
import {
  missions,
  safeJSON,
  keep,
  openStore,
  dbOp
} from './learning.js?v=mask3';
import {
  stabilityTest
} from './steady.js?v=mask3';
import {
  readExif
} from './exif.js?v=mask3';

const $ = id => document.getElementById(id);
const escapeText = v => String(v).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
const $all = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));
hydrateIcons();
const renderer = new CameraRenderer($('photoCanvas'));
const dbReady = openStore(),
  volatileShots = new Map(),
  photoURLs = new Map();
const grade = safeJSON('steady', null);
const s = {
  mode: 'M',
  focal: 24,
  aperture: 4,
  shutter: 1 / 125,
  iso: 400,
  focus: 8,
  point: [.577, .579],
  axis: [.525, .52],
  comp: 0,
  envK: 4500,
  wbK: 4500,
  metering: 'matrix',
  isOn: false,
  stops: 3,
  steadyFactor: grade?.factor || 1,
  grade: grade?.level || '標準',
  tested: !!grade,
  motionSpeed: 1,
  motionDir: 0,
  grid: safeJSON('grid', true),
  meterEV: 0,
  sceneId: 'taipei',
  tab: 'exposure',
  hasMotionSubject: true,
  marks: [],
  seed: 2.13
};
const sceneCache = new Map();
let current = null,
  crop = null,
  renderFrame = 0,
  loadingSerial = 0,
  sceneBusy = true,
  shooting = false,
  toolMode = '',
  depthChoice = 5,
  toastTimer = null,
  modalCleanup = null,
  installEvent = null,
  swState = '準備中',
  uploadRecord = null,
  uploadPreviewURL = null,
  albumSerial = 0;
let adjusting = false,
  refineTimer = 0;
let activeMission = safeJSON('active', null),
  completed = new Set(safeJSON('done', []));
const doneMission = () => missions.find(m => m.id === activeMission),
  nextMission = () => doneMission() || missions.find(m => !completed.has(m.id)) || missions[0];

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 3400);
}

function showDialog(title, html = '') {
  if (modalCleanup) {
    modalCleanup();
    modalCleanup = null;
  }
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  if (!$('modal').open) $('modal').showModal();
}

function closeDialog() {
  if ($('modal').open) $('modal').close();
}
$('closeModal').onclick = closeDialog;
$('modal').addEventListener('cancel', () => {
  if (modalCleanup) {
    modalCleanup();
    modalCleanup = null;
  }
});
$('modal').addEventListener('close', () => {
  if (modalCleanup) {
    modalCleanup();
    modalCleanup = null;
  }
});
$('modal').addEventListener('click', e => {
  if (e.target !== $('modal')) return;
  const r = $('modal').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
});

function setRange(input, value) {
  if (!input) return;
  input.value = value;
  const v = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
  input.style.setProperty('--value', v + '%');
}
const fmtEv = e => (e > 0.049 ? '+' : '') + (Math.abs(e) < .05 ? '0.0' : e.toFixed(1));

function schedule() {
  if (!renderFrame) renderFrame = requestAnimationFrame(sync);
}

function sync() {
  if (renderFrame) cancelAnimationFrame(renderFrame);
  renderFrame = 0;
  if (!current) return;
  crop = cropFor(current.img.width, current.img.height, s.focal, s.axis);
  const metered = current.ev + Math.log2(measure(current.stats, crop, s.metering, s.point) / current.baseLum);
  solveExposure(s, metered);
  s.meterEV = exposure(metered, s);
  updateInterface();
  if (!$('sim-page').hidden) drawPhoto();
}

function drawPhoto() {
  if (!current || !crop) return;
  const p = effectParams(s, crop, current.img.width, current.img.height, exposure(current.ev, s), s.seed);
  const width = $('stage').clientWidth * (window.devicePixelRatio || 1);
  renderer.draw(p, width || 1120, adjusting && !shooting);
  drawMotionOverlay();
}
renderer.onRecover = schedule;

function updateInterface() {
  $('sceneName').textContent = current.name;
  $('hudMode').textContent = s.mode;
  $('hudLens').textContent = s.focal + ' mm';
  $('hudA').textContent = 'F' + s.aperture.toFixed(1);
  $('hudS').textContent = shutterText(s.shutter);
  $('hudI').textContent = 'ISO ' + s.iso;
  const ev = s.meterEV;
  $('evNum').textContent = fmtEv(ev) + ' EV';
  $('evStatus').textContent = ev < -.5 ? '曝光不足' : ev > .5 ? '曝光過度' : '曝光適中';
  $('evStatus').classList.toggle('warn', Math.abs(ev) > .5);
  $('evScale').setAttribute('aria-label', '曝光差 ' + fmtEv(ev) + ' EV');
  $('meterMarker').style.left = (clamp(ev, -3, 3) + 3) / 6 * 100 + '%';
  $('modeName').textContent = modeNames[s.mode];
  $all('[data-mode]').forEach(b => {
    const selected = b.dataset.mode === s.mode;
    b.classList.toggle('sel', selected);
    b.setAttribute('aria-pressed', selected);
  });
  $('metering').value = s.metering;
  for (const [id, key, list, fmt] of [
      ['aper', 'aperture', apertures, n => 'f/' + n.toFixed(1)],
      ['time', 'shutter', shutters, n => shutterText(n) + ' s'],
      ['iso', 'iso', isos, n => String(n)]
    ]) {
    if (!$(id)) continue;
    setRange($(id), list.indexOf(s[key]));
    $(id + 'Val').textContent = fmt(s[key]);
    $(id).setAttribute('aria-valuetext', fmt(s[key]));
  }
  for (const [id, key] of [
      ['env', 'envK'],
      ['wb', 'wbK']
    ])
    if ($(id)) {
      setRange($(id), s[key]);
      if (document.activeElement !== $(id + 'Num')) $(id + 'Num').value = s[key];
      $(id).setAttribute('aria-valuetext', s[key] + ' K');
    }
  if ($('comp')) {
    $('comp').value = String(s.comp);
  }
  if ($('stabSwitch')) {
    $('stabSwitch').setAttribute('aria-checked', s.isOn);
    $('safeValue').textContent = safeDisplay(s);
    $('steadyName').textContent = s.grade + (s.tested ? ' · 已測驗' : ' · 預設');
    $('shakeRead').textContent = s.shutter > allowedTime(s) ? '目前快門較慢，全畫面會出現手震模糊。' : '目前快門落在個人手持安全範圍。';
    $all('[data-stop]').forEach(b => {
      b.disabled = !s.isOn;
      b.setAttribute('aria-pressed', Number(b.dataset.stop) === s.stops);
      b.classList.toggle('sel', Number(b.dataset.stop) === s.stops && s.isOn);
    });
  }
  $('fovValue').textContent = s.focal + ' mm · 水平視角 ' + angle(s.focal).toFixed(1) + '°';
  $all('[data-focal]').forEach(b => {
    const active = +b.dataset.focal === s.focal;
    b.classList.toggle('sel', active);
    b.setAttribute('aria-pressed', active);
  });
  setRange($('focusRange'), dialFromFocus(s.focus, s.focal));
  $('focusRange').setAttribute('aria-valuetext', distText(s.focus));
  $('focusValue').textContent = distText(s.focus);
  $('focusMin').textContent = minimumFocus(s.focal).toFixed(2) + ' m';
  const range = dof(s.focal, s.aperture, s.focus);
  $('dofValue').textContent = distText(range[0]) + ' – ' + distText(range[1]);
  const [x, y] = [(s.point[0] - crop.x) / crop.w, (s.point[1] - crop.y) / crop.h];
  const visible = x > .015 && x < .985 && y > .025 && y < .975;
  const sceneDistance = 1 / sampleMap(current.map, ...s.point).di;
  $('reticle').classList.toggle('outside', sceneDistance < range[0] || sceneDistance > range[1]);
  $('reticle').hidden = !visible;
  $('reticle').style.left = x * 100 + '%';
  $('reticle').style.top = y * 100 + '%';
  $('thirds').hidden = !s.grid;
  $('gridBtn').setAttribute('aria-pressed', s.grid);
  $('gridBtn').classList.toggle('on', s.grid);
  $('motionSpeed').value = String(s.motionSpeed);
  const status = !s.hasMotionSubject ? '尚未標記主體' : current.motionSelection ? '自訂主體範圍' : '場景預設範圍';
  if ($('motionStatus').textContent !== status) $('motionStatus').textContent = status;
  $('removeMotion').disabled = !s.hasMotionSubject || sceneBusy;
  $('showMotion').disabled = !s.hasMotionSubject;
  $('viewMotion').disabled = $('markMotion').disabled = sceneBusy;
  $('motionDir').value = String(s.motionDir);
  if ($('depthTools')) $('depthTools').hidden = s.sceneId !== 'upload';
  $('shutterBtn').disabled = sceneBusy || shooting;
}

function buildTab() {
  $all('[data-tab]').forEach(b => {
    const yes = b.dataset.tab === s.tab;
    b.classList.toggle('chosen', yes);
    b.setAttribute('aria-selected', yes);
    b.tabIndex = yes ? 0 : -1;
  });
  const host = $('tabContent');
  const slider = (id, key, ico, title, en, list, lo, hi, locked) => '<div class="param"><div class="param-title"><i>' + icon(ico) +
    '</i><label for="' + id + '">' + title + '</label><small>' + en + '</small>' + (locked ? '<span class="auto">AUTO</span>' : '') +
    '<output for="' + id + '" id="' + id + 'Val"></output></div><div class="rail"><input id="' + id + '" type="range" min="0" max="' + (list
      .length - 1) + '" step="1" ' + (locked ? 'disabled' : '') + '></div><div class="range-ends"><span>' + lo + '</span><span>' + hi +
    '</span></div></div>';
  if (s.tab === 'exposure') {
    host.innerHTML = slider('aper', 'aperture', 'aperture', '光圈', 'APERTURE', apertures, 'f/1.4', 'f/22', s.mode === 'P' || s.mode === 'S') +
      slider('time', 'shutter', 'timer', '快門速度', 'SHUTTER', shutters, '30 s', '1/8000 s', s.mode === 'P' || s.mode === 'A') + slider('iso',
        'iso', 'iso', '感光度', 'ISO', isos, 'ISO 50', '25600', false) + (s.mode !== 'M' ?
        '<label class="small-line comp-row">曝光補償<select id="comp">' + [-2, -1.5, -1, -.5, 0, .5, 1, 1.5, 2].map(n => '<option value="' + n +
          '">' + fmtEv(n) + ' EV</option>').join('') + '</select></label>' : '');
    for (const [id, key, list] of [
        ['aper', 'aperture', apertures],
        ['time', 'shutter', shutters],
        ['iso', 'iso', isos]
      ]) $(id).oninput = e => {
      s[key] = list[+e.target.value];
      schedule();
    };
    if ($('comp')) $('comp').onchange = e => {
      s.comp = +e.target.value;
      schedule();
    };
  } else if (s.tab === 'white') {
    const temp = (id, title, ico) => '<div class="param"><div class="param-title"><i>' + icon(ico) + '</i><label for="' + id + '">' + title +
      '</label><span class="temp-num"><input type="number" min="2000" max="10000" step="50" id="' + id + 'Num" aria-label="' + title +
      ' K 數值"> K</span></div><div class="rail temp-rail"><input type="range" id="' + id +
      '" min="2000" max="10000" step="50"></div><div class="range-ends"><span>2000 K</span><span>10000 K</span></div></div>';
    host.innerHTML = temp('env', '環境光源', 'sun') + temp('wb', '相機白平衡', 'tune') + '<div class="tab-actions"><button class="btn" id="readTemp">' +
      icon('image') + '讀取場景色溫</button><button class="btn" id="matchTemp">' + icon('check') +
      '匹配白平衡</button></div><p class="tab-hint">固定光源時，提高相機 K 值會讓畫面偏暖。</p>';
    for (const [id, key] of [
        ['env', 'envK'],
        ['wb', 'wbK']
      ]) {
      $(id).oninput = e => {
        s[key] = +e.target.value;
        $(id + 'Num').value = s[key];
        schedule();
      };
      $(id + 'Num').onchange = e => {
        const n = Number(e.target.value);
        s[key] = e.target.value && Number.isFinite(n) ? Math.round(clamp(n, 2000, 10000)) : s[key];
        e.target.value = s[key];
        schedule();
      };
    }
    $('readTemp').onclick = () => {
      if (!current) return;
      s.envK = current.k;
      schedule();
      toast(current.kSource + ' · ' + s.envK + ' K');
    };
    $('matchTemp').onclick = () => {
      s.wbK = s.envK;
      schedule();
      toast('相機白平衡已匹配環境光源');
    };
  } else {
    host.innerHTML =
      '<div class="small-line"><strong>機身／鏡頭防手震</strong><button id="stabSwitch" class="switch" role="switch" aria-label="防手震"></button></div><div class="small-line"><span>補償級數</span><div class="small-picks">' +
      [2, 3, 4, 5].map(n => '<button data-stop="' + n + '" aria-label="' + n + ' 級防手震">' + n + '</button>').join('') +
      '</div></div><div class="safe-read"><div class="small-line"><strong>個人安全快門</strong><output id="safeValue" class="mono"></output></div><p id="shakeRead"></p></div><div class="small-line"><span>手持穩定度</span><strong id="steadyName"></strong></div><div class="tab-actions"><button id="testBtn" class="btn">' +
      icon('cross') + '測驗手持穩定度</button></div>';
    $('stabSwitch').onclick = () => {
      s.isOn = !s.isOn;
      schedule();
    };
    $all('[data-stop]').forEach(b => b.onclick = () => {
      s.stops = +b.dataset.stop;
      schedule();
    });
    $('testBtn').onclick = () => {
      showDialog('手持穩定度測驗');
      modalCleanup = stabilityTest($('modalBody'), g => {
        s.grade = g.level;
        s.steadyFactor = g.factor;
        s.tested = true;
        keep('steady', g);
        schedule();
      });
    };
  }
  if (current && crop) updateInterface();
}

function setupFixed() {
  document.addEventListener('input', event => {
    if (event.target.type !== 'range') return;
    adjusting = true;
    clearTimeout(refineTimer);
    refineTimer = setTimeout(() => {
      adjusting = false;
      schedule();
    }, 150);
  }, true);

  const f = $('focalList');
  focalLengths.forEach(mm => {
    const b = document.createElement('button');
    b.dataset.focal = mm;
    b.textContent = mm;
    b.setAttribute('aria-label', mm + ' mm');
    b.onclick = () => {
      if (current && crop) {
        const next = cropFor(current.img.width, current.img.height, mm, s.axis),
          fracX = (s.point[0] - crop.x) / crop.w,
          fracY = (s.point[1] - crop.y) / crop.h;
        if (fracX >= 0 && fracX <= 1 && fracY >= 0 && fracY <= 1) s.axis = [clamp(s.point[0] + (.5 - fracX) * next.w, next.w / 2, 1 - next
          .w / 2), clamp(s.point[1] + (.5 - fracY) * next.h, next.h / 2, 1 - next.h / 2)];
      }
      s.focal = mm;
      s.focus = Math.max(s.focus, minimumFocus(mm));
      schedule();
    };
    f.append(b);
  });
  for (let i = 0; i <= 30; i++) {
    const b = document.createElement('b');
    if (i % 5 === 0) b.className = 'major';
    if (i === 15) b.classList.add('zero');
    $('meterTicks').append(b);
  }
  $all('[data-mode]').forEach(b => b.onclick = () => {
    s.mode = b.dataset.mode;
    buildTab();
    schedule();
  });
  const tabs = $all('[data-tab]');
  tabs.forEach((b, index) => {
    b.onclick = () => {
      s.tab = b.dataset.tab;
      buildTab();
      schedule();
    };
    b.onkeydown = e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const next = tabs[(index + (e.key === 'ArrowLeft' ? 2 : 1)) % 3];
      next.click();
      next.focus();
    };
  });
  $('metering').onchange = e => {
    s.metering = e.target.value;
    schedule();
  };
  $('focusRange').oninput = e => {
    const val = +e.target.value;
    s.focus = focusFromDial(val, s.focal);
    locateFocusPlane();
    schedule();
  };
  $('gridBtn').onclick = () => {
    s.grid = !s.grid;
    keep('grid', s.grid);
    schedule();
  };
  $('fullBtn').onclick = () => expandView(!$('viewerPanel').classList.contains('expanded'));
  $('resetBtn').onclick = () => {
    if (!current) return;
    applyDefaults(current);
    buildTab();
    setTool('');
    schedule();
    toast('已重設此場景的相機參數');
  };
  $('motionSpeed').onchange = e => {
    s.motionSpeed = +e.target.value;
    schedule();
  };
  $('motionDir').onchange = e => {
    s.motionDir = +e.target.value;
    schedule();
  };
  $('markMotion').onclick = $('viewMotion').onclick = editMotion;
  $('showMotion').onchange = drawMotionOverlay;
  $('removeMotion').onclick = () => {
    if (current && !sceneBusy) changeMotionSelection(emptySelection(), null);
  };
  const depthTools = document.createElement('div');
  depthTools.id = 'depthTools';
  depthTools.hidden = true;
  depthTools.className = 'upload-depth';
  depthTools.innerHTML =
    '<div class="subject-controls"><label>照片深度<select id="depthPreset"><option value="1">近景 1 m</option><option value="5" selected>中景 5 m</option><option value="30">遠景 30 m</option></select></label><button id="markDepth" class="btn">' +
    icon('cross') + '標記深度</button><button id="clearDepth" class="text-btn">清除標記</button></div>';
  document.querySelector('.lens-body').append(depthTools);
  $('depthPreset').onchange = e => depthChoice = +e.target.value;
  $('markDepth').onclick = () => {
    setTool(toolMode === 'depth' ? '' : 'depth');
    if (toolMode) $('stage').scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };
  $('clearDepth').onclick = () => {
    if (!current) return;
    s.marks = [];
    updateMap();
    schedule();
    toast('已恢復照片的預估深度');
  };
  $('uploadBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await importFile(file);
  };
  $('scenesBtn').onclick = chooseScene;
  $('guideBtn').onclick = guide;
  $('missionLink').onclick = () => navigate('tasks');
  $('shutterBtn').onclick = takeShot;
  let moving = null;
  $('stage').addEventListener('pointerdown', e => {
    if (e.button !== 0 || !current || sceneBusy) return;
    moving = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startCrop: crop,
      axis: [...s.axis],
      drag: false
    };
  });
  $('stage').addEventListener('pointermove', e => {
    if (!moving || e.pointerId !== moving.id || toolMode) return;
    const dx = e.clientX - moving.x,
      dy = e.clientY - moving.y;
    if (Math.hypot(dx, dy) < 7 && !moving.drag) return;
    moving.drag = true;
    const r = $('stage').getBoundingClientRect(),
      c = moving.startCrop;
    s.axis = [clamp(c.x + c.w / 2 - dx / r.width * c.w, c.w / 2, 1 - c.w / 2), clamp(c.y + c.h / 2 - dy / r.height * c.h, c.h / 2, 1 - c.h /
      2)];
    schedule();
  });
  $('stage').addEventListener('pointerup', e => {
    if (!moving || e.pointerId !== moving.id) return;
    const drag = moving.drag;
    moving = null;
    if (drag) return;
    const r = $('stage').getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) stageAction((e.clientX - r.left) / r
      .width, (e.clientY - r.top) / r.height);
  });
  $('stage').addEventListener('pointercancel', () => moving = null);
  $('stage').addEventListener('pointerleave', () => {
    moving = null;
  });
  $('stage').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      stageAction(.5, .5);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('modal').open) return;
      if (toolMode) setTool('');
      else expandView(false);
      return;
    }
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || $('modal').open || $('sim-page').hidden || e.target.closest(
        'input,select,textarea,button,a,summary')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      takeShot();
    } else if (e.code === 'KeyG') $('gridBtn').click();
  });
  const stageObserver = new ResizeObserver(schedule);
  stageObserver.observe($('stage'));
}

function expandView(on) {
  $('viewerPanel').classList.toggle('expanded', on);
  document.body.classList.toggle('no-scroll', on);
  $('fullBtn').setAttribute('aria-label', on ? '縮小觀景窗' : '放大觀景窗');
  $('fullBtn').title = on ? '縮小觀景窗' : '放大觀景窗';
  schedule();
}

function setTool(value) {
  toolMode = value;
  const t = $('stageNote');
  t.hidden = !value;
  t.textContent = value === 'depth' ? '點選照片中的 ' + depthChoice + ' m 區域' : '';
  $('markDepth')?.classList.toggle('primary', value === 'depth');
}

function stageAction(x, y) {
  if (!crop || !current || sceneBusy) return;
  const u = crop.x + clamp(x, 0, 1) * crop.w,
    v = crop.y + clamp(y, 0, 1) * crop.h;
  if (toolMode === 'depth') {
    s.marks.push({
      x: u,
      y: v,
      m: depthChoice,
      rx: crop.w * .2,
      ry: crop.h * .25
    });
    updateMap();
    s.point = [u, v];
    s.focus = Math.max(depthChoice, minimumFocus(s.focal));
    setTool('');
    toast('已設定此區域深度');
  } else {
    s.point = [u, v];
    const d = 1 / sampleMap(current.map, u, v).di;
    s.focus = d > 150 ? Infinity : Math.max(minimumFocus(s.focal), d);
  }
  schedule();
}

function locateFocusPlane() {
  if (!current || !crop) return;
  const x0 = clamp((s.point[0] - crop.x) / crop.w, 0, 1),
    y0 = clamp((s.point[1] - crop.y) / crop.h, 0, 1),
    wanted = Number.isFinite(s.focus) ? 1 / s.focus : 0;
  let best = Infinity,
    point = s.point;
  for (let row = 0; row < 32; row++)
    for (let col = 0; col < 48; col++) {
      const x = (col + .5) / 48,
        y = (row + .5) / 32,
        u = crop.x + x * crop.w,
        v = crop.y + y * crop.h;
      const mismatch = Math.abs(sampleMap(current.map, u, v).di - wanted) / Math.max(.025, wanted);
      const score = mismatch + .07 * ((x - x0) ** 2 + (y - y0) ** 2);
      if (score < best) {
        best = score;
        point = [u, v];
      }
    }
  s.point = point;
}

function updateMap() {
  current.map = depthMap(current.img.width, current.img.height, s.sceneId, null, s.marks);
  renderer.setMap(current.map);
}

function drawMotionOverlay() {
  const overlay = $('motionOverlay');
  const source = current?.motionSelection ? renderer.subjectMask?.canvas : current?.motionPreset;
  overlay.hidden = !$('showMotion').checked || !s.hasMotionSubject || !source || !crop;
  if (overlay.hidden) return;
  const width = renderer.canvas.width, height = renderer.canvas.height;
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  drawCrop(ctx, source, crop, width, height);
}

function editMotion() {
  if (!current || !crop || sceneBusy) return;
  setTool('');
  showDialog('編輯主體範圍');
  $('modal').classList.add('motion-dialog');
  const body = $('modalBody');
  body.replaceChildren($('motionEditorTemplate').content.cloneNode(true));
  hydrateIcons(body);
  const cleanup = startMotionEditor(body.querySelector('.motion-editor'), {
    photo: current.img, preset: current.motionPreset, initial: current.motionSelection, crop,
    apply: changeMotionSelection, close: closeDialog
  });
  modalCleanup = () => {
    cleanup();
    $('modal').classList.remove('motion-dialog');
  };
}

function changeMotionSelection(selection, compiled) {
  const scene = current;
  scene.motionSelection = selection;
  s.hasMotionSubject = selection === null || !!compiled;
  renderer.setMotionMask(compiled);
  const resume = !!compiled && s.motionSpeed === 0;
  if (resume) s.motionSpeed = 1;
  schedule();
  if (resume) toast('已套用範圍，移動速度已設為一般。');
  else if (!s.hasMotionSubject) toast('已移除主體標記與主體拖影。');
  else toast(selection ? '已套用自訂主體範圍。' : '已還原場景預設範圍。');
  if (scene.id === 'upload' && uploadRecord) uploadRecord.meta.motionSelection = selection;
  saveMotionSelection(scene, selection).catch(() => {
    if (current === scene && scene.motionSelection === selection) toast('範圍已套用，目前僅保留於本次使用。');
  });
}

async function saveMotionSelection(scene, selection) {
  const db = await dbReady;
  if (scene.id !== 'upload') {
    const key = 'motion:' + scene.id;
    return dbOp(db, 'current', 'readwrite', store => selection === null ? store.delete(key) : store.put(selection, key));
  }
  // Editing in an older tab must never overwrite a newer uploaded photo.
  return dbOp(db, 'current', 'readwrite', store => {
    const request = store.get('upload');
    request.onsuccess = () => {
      const saved = request.result;
      if (!saved || saved.meta.photoId !== scene.photoId) return;
      saved.meta.motionSelection = selection;
      store.put(saved, 'upload');
    };
    return request;
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error('decode'));
    img.src = src;
  });
}

function toBlob(canvas, type = 'image/jpeg', quality = .9) {
  return new Promise((res, rej) => {
    canvas.toBlob(b => b ? res(b) : rej(Error('encode')), type, quality);
  });
}
async function normalise(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const c = document.createElement('canvas'),
      k = Math.min(1, 2304 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d5d5d5';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await toBlob(c, 'image/jpeg', .95);
    return {
      blob,
      canvas: c
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sceneTemplate(id, img, meta, stats = imageStats(img)) {
  const c = cropFor(img.width, img.height, 24, meta.axis);
  return {
    ...meta,
    id,
    img,
    stats,
    baseLum: measure(stats, c, 'matrix', meta.point),
    motionSelection: meta.motionSelection ?? null,
    map: null
  };
}

function applyDefaults(scene) {
  Object.assign(s, {
    mode: 'M',
    focal: 24,
    aperture: 4,
    iso: 400,
    shutter: nearest(shutters, 4 / Math.pow(2, scene.ev)),
    comp: 0,
    envK: scene.k,
    wbK: scene.k,
    focus: scene.focus,
    point: [...scene.point],
    axis: [...scene.axis],
    metering: 'matrix',
    isOn: false,
    stops: 3,
    motionSpeed: scene.motion,
    motionDir: 0,
    marks: []
  });
  if (current === scene && scene.map) updateMap();
}

function assignScene(item) {
  current = item;
  s.sceneId = item.id;
  current.map = null;
  applyDefaults(item);
  current.map = depthMap(item.img.width, item.img.height, item.id, null, []);
  renderer.setScene(item.img, current.map);
  item.motionPreset = defaultMask(current.map);
  const compiled = compileSelection(item.img, item.motionSelection, item.motionPreset);
  s.hasMotionSubject = item.motionSelection === null || !!compiled;
  renderer.setMotionMask(compiled);
  const fallback = $('stageFallback');
  fallback.src = item.id === 'upload' ? uploadPreviewURL : scenes[item.id].src;
  sceneBusy = false;
  setTool('');
  buildTab();
  sync();
}
async function changeScene(id) {
  if (id === 'upload' && !uploadRecord) return;
  const serial = ++loadingSerial;
  sceneBusy = true;
  $('shutterBtn').disabled = true;
  try {
    let item = sceneCache.get(id);
    if (!item) {
      if (id === 'upload') {
        if (!uploadPreviewURL) uploadPreviewURL = URL.createObjectURL(uploadRecord.blob);
        const img = await loadImage(uploadPreviewURL);
        item = sceneTemplate(id, img, uploadRecord.meta);
      } else {
        const meta = scenes[id],
          img = await loadImage(meta.src);
        item = sceneTemplate(id, img, {
          ...meta,
          kSource: '場景預設光源'
        });
        try {
          item.motionSelection = await dbOp(await dbReady, 'current', 'readonly', store => store.get('motion:' + id)) ?? null;
        } catch { /* The preset also works without local storage. */ }
      }
      if (loadingSerial !== serial) return;
      sceneCache.set(id, item);
    }
    if (loadingSerial !== serial) return;
    assignScene(item);
  } catch (error) {
    if (loadingSerial !== serial) return;
    console.error('場景載入失敗', error);
    sceneBusy = false;
    if (current) schedule();
    toast('無法開啟場景，請重新選擇或上傳可讀取的照片。');
  }
}
async function importFile(file) {
  const serial = ++loadingSerial;
  sceneBusy = true;
  $('shutterBtn').disabled = true;
  toast('正在讀取照片與光源…');
  try {
    const [norm, meta] = await Promise.all([normalise(file), readExif(file)]);
    if (serial !== loadingSerial) return;
    const stats = imageStats(norm.canvas),
      k = meta.k || stats.k,
      ev = Number.isFinite(meta.ev) ? clamp(meta.ev, 2, 16) : clamp(scenes.taipei.ev + Math.log2(Math.max(.005, stats.avg) / .15), 5, 14);
    const m = {
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || '自訂照片',
      detail: '自訂場景・本機照片',
      photoId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now() + '-' + Math.random(),
      ev,
      k: k || 5500,
      kSource: meta.k ? 'EXIF 光源類型估算' : '照片色彩估算',
      focus: 8,
      point: [.5, .55],
      axis: [.5, .5],
      motion: 1
    };
    const item = sceneTemplate('upload', norm.canvas, m, stats);
    item.focus = 1 / sampleMap(depthMap(norm.canvas.width, norm.canvas.height, 'upload', null), .5, .55).di;
    m.focus = item.focus;
    const record = {
      blob: norm.blob,
      meta: m
    };
    uploadRecord = record;
    if (uploadPreviewURL) URL.revokeObjectURL(uploadPreviewURL);
    uploadPreviewURL = URL.createObjectURL(norm.blob);
    sceneCache.set('upload', item);
    assignScene(item);
    navigate('sim');
    toast('已匯入照片 · ' + m.kSource + ' ' + m.k + ' K');
    try {
      await dbOp(await dbReady, 'current', 'readwrite', os => os.put(record, 'upload'));
    } catch {
      toast('照片已載入，此瀏覽器僅能在本次使用。');
    }
  } catch {
    if (serial !== loadingSerial) return;
    sceneBusy = false;
    if (current) schedule();
    toast('這張照片無法解碼，請選擇 JPG、PNG 或 WebP 圖片。');
  }
}

function chooseScene() {
  const picks = [...Object.entries(scenes).map(([id, m]) => ({
    id,
    name: m.name,
    detail: m.detail,
    src: m.src
  })), ...(uploadRecord ? [{
    id: 'upload',
    name: uploadRecord.meta.name,
    detail: '自訂場景・本機照片',
    src: uploadPreviewURL || (uploadPreviewURL = URL.createObjectURL(uploadRecord.blob))
  }] : [])];
  showDialog('切換場景', '<div class="scene-options">' + picks.map(p => '<button class="scene-option ' + (p.id === s.sceneId ? 'selected' : '') +
      '" data-scene="' + p.id + '"><img src="' + escapeText(p.src) + '" alt=""><span><strong>' + escapeText(p.name) + '</strong><small>' + p
      .detail + '</small></span>' + (p.id === s.sceneId ? icon('check') : '') + '</button>').join('') +
    '</div><div class="dialog-actions"><button class="btn" id="sceneUpload">' + icon('upload') + '上傳照片</button>' + (uploadRecord ?
      '<button class="text-btn" id="forgetUpload">移除自訂場景</button>' : '') + '</div>');
  $all('[data-scene]', $('modalBody')).forEach(b => b.onclick = () => {
    closeDialog();
    if (b.dataset.scene !== s.sceneId) changeScene(b.dataset.scene);
  });
  $('sceneUpload').onclick = () => {
    closeDialog();
    $('fileInput').click();
  };
  if ($('forgetUpload')) $('forgetUpload').onclick = () => {
    showDialog('移除自訂場景',
      '<p class="explain">移除最近匯入的場景照片？已拍攝的相片仍可在相簿中查看。</p><div class="dialog-actions"><button class="btn" id="cancelForget">取消</button><button class="btn primary" id="yesForget">移除場景</button></div>'
      );
    $('cancelForget').onclick = chooseScene;
    $('yesForget').onclick = async () => {
      try {
        const db = await dbReady;
        if (db) await dbOp(db, 'current', 'readwrite', os => os.delete('upload'));
      } catch {
        toast('未能移除場景，請再試一次');
        return;
      }
      closeDialog();
      if (s.sceneId === 'upload') await changeScene('taipei');
      uploadRecord = null;
      sceneCache.delete('upload');
      if (uploadPreviewURL) URL.revokeObjectURL(uploadPreviewURL);
      uploadPreviewURL = null;
      toast('已移除自訂場景');
    };
  };
}

function guide() {
  showDialog('操作指南',
    '<div class="guide-list"><section><h3>先拍一張，再改一個參數</h3><p>在「雨後台北」點選計程車對焦，按下快門。把焦段切換為 85 mm，再拍一張，到「我的相簿」比較兩張照片。換焦段時會盡量保持主體在畫面中的位置，放大後可拖曳重新構圖。</p></section><section><h3>認識 P、S、A、M</h3><p>P 自動搭配光圈與快門，S 由你決定快門，A 由你決定光圈，M 兩者皆可自行設定。四個模式都能調整 ISO。在自動模式，曝光補償可以調整亮暗目標。</p></section><section><h3>拍出景深、動態與雜訊</h3><p>用 A 模式比較 f/2 與 f/16 的清晰範圍。用 S 模式比較快慢快門，再提高 ISO 觀察暗部顆粒。點測光取樣於對焦點，全區測光取樣於目前取景範圍。</p></section><section><h3>上傳照片與白平衡</h3><p>匯入後會優先依 EXIF 光源類型估算 K 值，其次才以照片色彩估算。光源與相機 K 值相同時顯示參考色調。單張照片的深度、動態及光源皆為教學近似，可在「鏡頭與對焦」標記深度，或從觀景窗的虛線方框開啟「編輯主體範圍」。可用框選圈出大小，以筆刷補畫、橡皮擦修邊，再按「套用範圍」。在「主體動態」按「移除標記」，即可清除主體拖影。長焦取景會裁切原圖。</p></section><section><h3>測試手持穩定度</h3><p>在「防手震」做 6 秒測驗。安全快門以全片幅焦段倒數為基準，加入個人等級與防震級數。防手震會減輕相機晃動，移動主體的拖影仍取決於快門速度。</p></section><section><h3>安裝與離線使用</h3><p id="offlineStatus"></p><p>Android 或電腦可從瀏覽器選單安裝，iPhone 可從 Safari 的分享選單選「加入主畫面」。上傳照片、相簿與任務進度都保存在目前瀏覽器。</p><div id="installSlot"></div></section><section><h3>鍵盤快捷鍵</h3><p>Space 拍攝，G 切換三分線，Esc 關閉放大觀景窗。選到滑桿時，方向鍵可逐格微調。</p></section></div>'
    );
  refreshInstall();
}

function refreshInstall() {
  if (!$('offlineStatus')) return;
  $('offlineStatus').textContent = swState === 'ready' ? '離線資源已就緒，這部裝置可以離線練習。' : swState === 'failed' ? '目前無法建立離線快取，仍可連線練習。' : '首次連線時會下載離線練習資源。';
  const slot = $('installSlot');
  if (slot && installEvent) {
    slot.innerHTML = '<button class="btn" id="installApp">' + icon('download') + '安裝 FOCALAB</button>';
    $('installApp').onclick = async () => {
      await installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      slot.replaceChildren();
    };
  }
}

function navigate(id) {
  if (location.hash === '#' + id) route();
  else location.hash = id;
}

function route() {
  const name = ['sim', 'tasks', 'album'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'sim';
  for (const id of ['sim', 'tasks', 'album']) $(id + '-page').hidden = id !== name;
  $all('[data-nav]').forEach(b => {
    const yes = b.dataset.nav === name;
    b.classList.toggle('active', yes);
    if (yes) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.title = (name === 'sim' ? '攝影模擬器' : name === 'tasks' ? '拍攝任務' : '我的相簿') + '｜FOCALAB 光圈實驗室';
  if (name === 'tasks') renderTasks();
  if (name === 'album') renderAlbum();
  if (name === 'sim') schedule();
  else if ($('viewerPanel').classList.contains('expanded')) expandView(false);
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}

function updateMissions() {
  const m = nextMission();
  $('missionCount').textContent = completed.size + ' / ' + missions.length;
  $('missionTease').textContent = m.title;
  $('missionTeaseDesc').textContent = m.desc;
  const h = $('missionRibbon'),
    active = doneMission();
  h.hidden = !active;
  if (active) {
    h.innerHTML = '<span>' + icon('flag') + '<strong>' + active.title + '</strong><small>' + active.tip +
      '</small></span><button id="endMission" class="icon-btn" aria-label="結束目前任務">' + icon('close') + '</button>';
    $('endMission').onclick = () => {
      activeMission = null;
      keep('active', null);
      updateMissions();
    };
  }
  if (!$('tasks-page').hidden) renderTasks();
}

function renderTasks() {
  $('taskSummary').textContent = '已完成 ' + completed.size + ' / ' + missions.length;
  $('taskCards').innerHTML = missions.map((m, i) => '<article class="panel task-card"><div class="task-kicker"><span class="task-icon">' + icon(m
      .icon) + '</span><span>' + (completed.has(m.id) ? '已完成 ✓' : m.type) + '</span></div><h2>' + m.title + '</h2><p>' + m.desc +
    '</p><ul class="checks">' + m.rules.map(r => '<li>' + r[0] + '</li>').join('') + '</ul><button class="btn ' + (m.id === activeMission ?
      'primary' : '') + '" data-mission="' + m.id + '">' + (m.id === activeMission ? '繼續挑戰' : completed.has(m.id) ? '再次練習' : '開始挑戰') +
    '</button></article>').join('');
  $all('[data-mission]').forEach(b => b.onclick = () => {
    activeMission = b.dataset.mission;
    keep('active', activeMission);
    updateMissions();
    navigate('sim');
  });
}

function gradeShot(state) {
  const m = doneMission();
  if (!m) return null;
  const checks = m.rules.map(rule => [rule[0], rule[1](state)]),
    pass = checks.every(r => r[1]);
  if (pass) {
    completed.add(m.id);
    keep('done', [...completed]);
    activeMission = null;
    keep('active', null);
    updateMissions();
  }
  return {
    title: m.title,
    pass,
    checks
  };
}

function shotMeta() {
  return {
    scene: current.name,
    mode: s.mode,
    aperture: s.aperture,
    shutter: s.shutter,
    iso: s.iso,
    focal: s.focal,
    focus: Number.isFinite(s.focus) ? s.focus : null,
    env: s.envK,
    wb: s.wbK,
    meter: s.meterEV,
    meterName: $('metering').selectedOptions[0].textContent,
    stabilization: s.isOn ? s.stops : 0,
    safe: safeDisplay(s),
    steady: s.grade,
    motion: s.hasMotionSubject ? s.motionSpeed : 0
  };
}
async function takeShot() {
  if (sceneBusy || !current || shooting || $('sim-page').hidden) return;
  shooting = true;
  try {
    sync();
    const meta = shotMeta(),
      snapshot = {
        ...s
      },
      missionId = activeMission;
    const blobPromise = toBlob(renderer.canvas);
    const flash = $('flash');
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    const blob = await blobPromise;
    const gradeNow = activeMission === missionId ? gradeShot(snapshot) : null;
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2);
    const shot = {
      id,
      ts: Date.now(),
      blob,
      meta,
      challenge: gradeNow
    };
    let persistent = true;
    try {
      await dbOp(await dbReady, 'shots', 'readwrite', os => os.put(shot));
    } catch {
      volatileShots.set(id, shot);
      persistent = false;
    }
    s.seed = (s.seed + .137) % 32;
    if (gradeNow) {
      showDialog(gradeNow.pass ? '任務完成' : '這張照片的任務回饋', '<h3>' + gradeNow.title + '</h3><ul class="checks result-checks">' + gradeNow.checks
        .map(([r, ok]) => '<li class="' + (ok ? 'ok' : '') + '">' + (ok ? '已達成' : '待調整') + ' · ' + r + '</li>').join('') +
        '</ul><p class="explain">' + (persistent ? '照片已存入我的相簿。' : '照片目前保留於本次使用，可進入相簿下載。') +
        '</p><div class="dialog-actions"><button class="btn primary" id="backToSim">繼續拍攝</button><button class="btn" id="seeShot">查看成品</button></div>'
        );
      $('backToSim').onclick = closeDialog;
      $('seeShot').onclick = () => viewShot(shot);
    } else toast(persistent ? '已拍攝，照片已存入我的相簿。' : '已拍攝，本次相簿可下載照片。');
  } catch {
    toast('未能擷取畫面，請重新按下快門。');
  } finally {
    shooting = false;
    schedule();
  }
}
async function allShots() {
  let list = [];
  try {
    list = await dbOp(await dbReady, 'shots', 'readonly', os => os.getAll());
  } catch {}
  return [...list, ...volatileShots.values()].sort((a, b) => b.ts - a.ts);
}

function blobURL(shot) {
  if (!photoURLs.has(shot.id)) photoURLs.set(shot.id, URL.createObjectURL(shot.blob));
  return photoURLs.get(shot.id);
}
const dateText = ts => new Intl.DateTimeFormat('zh-TW', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
}).format(ts);
async function renderAlbum() {
  const ticket = ++albumSerial,
    list = await allShots();
  if (ticket !== albumSerial) return;
  $('albumCount').textContent = list.length + ' 張照片';
  if (!list.length) {
    $('albumItems').innerHTML = '<div class="panel empty-album"><span class="empty-icon">' + icon('gallery') +
      '</span><h2>第一張照片，從這裡開始</h2><p>在模擬器按下快門，照片和拍攝設定就會出現在這裡。</p><button id="toCamera" class="btn primary">' + icon('camera') +
      '前往拍攝</button></div>';
    $('toCamera').onclick = () => navigate('sim');
    return;
  }
  const g = document.createElement('div');
  g.className = 'album-grid';
  for (const shot of list) {
    const m = shot.meta,
      b = document.createElement('button');
    b.className = 'panel shot-card';
    b.innerHTML = '<img loading="lazy" alt="' + escapeText(m.scene) + '拍攝成果" src="' + blobURL(shot) + '"><div class="shot-info"><strong>' +
      escapeText(m.scene) + '</strong><span class="shot-settings">' + m.focal + ' mm · f/' + m.aperture + ' · ' + shutterText(m.shutter) +
      ' s · ISO ' + m.iso + '</span><small>' + dateText(shot.ts) + '</small></div>';
    b.onclick = () => viewShot(shot);
    g.append(b);
  }
  $('albumItems').replaceChildren(g);
}

function viewShot(shot) {
  const m = shot.meta,
    rows = [
      ['拍攝時間', new Date(shot.ts).toLocaleString('zh-TW')],
      ['相機模式', m.mode + ' · ' + modeNames[m.mode]],
      ['鏡頭／對焦', m.focal + ' mm · ' + distText(m.focus ?? Infinity)],
      ['光圈／快門／ISO', 'f/' + m.aperture + ' · ' + shutterText(m.shutter) + ' s · ISO ' + m.iso],
      ['測光／曝光差', m.meterName + ' · ' + fmtEv(m.meter) + ' EV'],
      ['環境光／白平衡', m.env + ' K / ' + m.wb + ' K'],
      ['手持／防手震', m.steady + ' · ' + (m.stabilization ? m.stabilization + ' 級' : '關閉') + ' · 安全快門 ' + m.safe]
    ];
  if (shot.challenge) rows.push(['拍攝任務', shot.challenge.title + ' · ' + (shot.challenge.pass ? '完成' : '練習中')]);
  showDialog(m.scene, '<img class="shot-detail" src="' + blobURL(shot) + '" alt="' + escapeText(m.scene) + '拍攝結果"><table class="meta-table">' +
    rows.map(([k, v]) => '<tr><th>' + k + '</th><td>' + escapeText(v) + '</td></tr>').join('') +
    '</table><div class="dialog-actions"><a class="btn primary" id="saveShot" download="FOCALAB-' + shot.ts + '.jpg" href="' + blobURL(shot) +
    '">' + icon('download') + '下載照片</a><button class="btn" id="deleteShot">' + icon('trash') + '刪除</button></div>');
  $('deleteShot').onclick = () => {
    showDialog('刪除這張照片？',
      '<p class="explain">這張拍攝成果將從目前裝置的相簿移除。</p><div class="dialog-actions"><button class="btn" id="cancelDel">取消</button><button class="btn primary" id="yesDel">刪除照片</button></div>'
      );
    $('cancelDel').onclick = () => viewShot(shot);
    $('yesDel').onclick = async () => {
      try {
        if (!volatileShots.has(shot.id)) await dbOp(await dbReady, 'shots', 'readwrite', os => os.delete(shot.id));
        volatileShots.delete(shot.id);
        URL.revokeObjectURL(photoURLs.get(shot.id));
        photoURLs.delete(shot.id);
        closeDialog();
        if (!$('album-page').hidden) renderAlbum();
        toast('照片已刪除');
      } catch {
        toast('未能刪除，請再試一次');
      }
    };
  };
}
window.addEventListener('hashchange', route);
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  refreshInstall();
});
setupFixed();
buildTab();
updateMissions();
route();
changeScene('taipei');
dbReady.then(async db => {
  if (!db) return;
  try {
    const saved = await dbOp(db, 'current', 'readonly', os => os.get('upload'));
    if (!uploadRecord && saved?.blob) uploadRecord = saved;
  } catch {}
});
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', {
    scope: './'
  }).then(() => navigator.serviceWorker.ready).then(() => {
    swState = 'ready';
    refreshInstall();
  }).catch(() => {
    swState = 'failed';
    refreshInstall();
  });
} else swState = 'failed';
