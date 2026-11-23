import {
  icon
} from './icons.js';
import {
  clamp
} from './optics.js';
export function stabilityTest(body, onResult) {
  let frame = null,
    active = false,
    mode = 'pointer',
    start = 0,
    previous = 0,
    samples = 0,
    sum = 0,
    elapsed = 0,
    position = null,
    pointerId = null,
    gyroCount = 0,
    gyroSum = 0,
    motionListener = null,
    selected = true;
  const motionAPI = typeof window.DeviceMotionEvent !== 'undefined';
  body.innerHTML =
    '<p class="explain">用游標或手指追蹤移動中的圓心 6 秒，測量操作的穩定程度。有陀螺儀的手機也能直接測量手持晃動。</p><div class="chip-row"><button class="btn primary" data-method="pointer">' +
    icon('cross') + '指標追蹤</button>' + (motionAPI ? '<button class="btn" data-method="gyro">' + icon('device') + '手機感測</button>' : '') +
    '</div><div class="test-area" id="testArea"><div class="test-target"></div><div class="test-cursor" hidden></div></div><div class="test-bar"><b></b></div><p class="test-info" aria-live="polite"></p><div id="testResult"></div>';
  const area = body.querySelector('#testArea'),
    target = area.querySelector('.test-target'),
    cursor = area.querySelector('.test-cursor'),
    info = body.querySelector('.test-info'),
    result = body.querySelector('#testResult'),
    bar = body.querySelector('.test-bar b');
  const say = t => {
    info.textContent = t;
  };
  const coord = e => {
    const r = area.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const posAt = t => [.5 + .23 * Math.sin(t * 1.15), .5 + .17 * Math.sin(t * 1.6 + .45) * Math.min(t, 1)];

  function stop() {
    active = false;
    cancelAnimationFrame(frame);
    if (motionListener) {
      window.removeEventListener('devicemotion', motionListener);
      motionListener = null;
    }
    pointerId = null;
    cursor.hidden = true;
  }

  function reset() {
    stop();
    target.style.left = '50%';
    target.style.top = '50%';
    bar.style.width = '0';
    position = null;
    result.replaceChildren();
    say(mode === 'pointer' ? '按住圓心並跟著移動，中途放開可重試。' : '將手機自然握在手中，點一下圓心開始測量。');
  }

  function finish(score) {
    stop();
    bar.style.width = '100%';
    const level = score >= 83 ? '穩健' : score >= 55 ? '標準' : '練習中';
    const factor = score >= 83 ? .70 : score >= 55 ? 1 : 1.65;
    onResult({
      score,
      level,
      factor,
      method: mode === 'gyro' ? '手機感測' : '指標追蹤'
    });
    say('測驗完成，等級已套用至個人安全快門。');
    result.innerHTML = '<div class="test-result"><strong>' + level + ' · ' + score + ' 分</strong><p class="small-copy">' + (mode === 'gyro' ?
        '依手機角速度估算手持晃動。' : '依指標與目標的距離評分，作為桌面手持練習的參考。') +
      '</p></div><div class="dialog-actions"><button class="btn" id="tryAgain">再測一次</button></div>';
    result.querySelector('#tryAgain').onclick = reset;
  }

  function tick(now) {
    if (!active) return;
    if (document.hidden) {
      reset();
      say('離開測驗畫面後需要重新開始。');
      return;
    }
    const t = (now - start) / 1000,
      dt = Math.min((now - previous) / 1000, 1);
    previous = now;
    const pos = mode === 'pointer' ? posAt(t) : [.5, .5];
    target.style.left = (pos[0] * 100) + '%';
    target.style.top = (pos[1] * 100) + '%';
    bar.style.width = Math.min(100, t / 6 * 100) + '%';
    if (mode === 'pointer' && position && t > .18) {
      const error = Math.hypot((position[0] - pos[0]) * 1.55, position[1] - pos[1]);
      sum += error * error * dt;
      elapsed += dt;
      samples++;
    }
    if (mode === 'gyro' && t > 2 && gyroCount < 3) {
      stop();
      say('此裝置沒有提供角速度資料，請選擇「指標追蹤」進行測驗。');
      return;
    }
    if (t >= 6) {
      if (mode === 'gyro' && gyroCount < 10) {
        stop();
        say('感測樣本不足，請重試或改用指標追蹤。');
        return;
      }
      if (mode === 'pointer' && (samples < 5 || elapsed < 3)) {
        reset();
        say('有效追蹤時間不足，請保持頁面開啟再測一次。');
        return;
      }
      const e = mode === 'gyro' ? Math.sqrt(gyroSum / gyroCount) / 48 : Math.sqrt(sum / Math.max(.01, elapsed)) / .33;
      finish(Math.round(clamp(100 * (1 - e), 0, 100)));
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  async function begin(e) {
    if (active || !selected || result.firstChild) return;
    if (mode === 'pointer') {
      position = coord(e);
      if (Math.hypot((position[0] - .5) * 1.5, position[1] - .5) > .15) {
        say('請從中央的黃色圓心開始。');
        return;
      }
      pointerId = e.pointerId;
      area.setPointerCapture(pointerId);
      cursor.hidden = false;
      cursor.style.left = position[0] * 100 + '%';
      cursor.style.top = position[1] * 100 + '%';
    } else {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        let granted;
        try {
          granted = await DeviceMotionEvent.requestPermission();
        } catch {}
        if (!selected) return;
        if (granted !== 'granted') {
          say('無法取得動作感測授權，可切換至指標追蹤。');
          return;
        }
      }
      if (!selected) return;
      motionListener = e => {
        const r = e.rotationRate;
        if (!r) return;
        const valid = [r.alpha, r.beta, r.gamma].filter(Number.isFinite);
        if (!valid.length) return;
        gyroSum += valid.reduce((n, x) => n + x * x, 0) / valid.length;
        gyroCount++;
      };
      window.addEventListener('devicemotion', motionListener);
    }
    active = true;
    start = previous = performance.now();
    sum = elapsed = samples = gyroSum = gyroCount = 0;
    say(mode === 'gyro' ? '測量中，維持平常的拍攝姿勢。' : '追蹤中，持續按住並跟著圓心。');
    frame = requestAnimationFrame(tick);
  }
  area.onpointerdown = begin;
  area.onpointermove = e => {
    if (active && mode === 'pointer' && e.pointerId === pointerId) {
      position = coord(e);
      cursor.style.left = position[0] * 100 + '%';
      cursor.style.top = position[1] * 100 + '%';
    }
  };
  const released = e => {
    if (active && mode === 'pointer' && e.pointerId === pointerId) {
      reset();
      say('已放開，按住圓心可以重新開始。');
    }
  };
  area.onpointerup = released;
  area.onpointercancel = released;
  body.querySelectorAll('[data-method]').forEach(b => b.onclick = () => {
    mode = b.dataset.method;
    body.querySelectorAll('[data-method]').forEach(x => x.classList.toggle('primary', x === b));
    reset();
  });
  reset();
  return () => {
    selected = false;
    stop();
  };
}
