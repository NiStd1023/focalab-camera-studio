import {
  exposure,
  allowedTime,
  dof
} from './optics.js';
const balanced = s => Math.abs(s.meterEV) <= .5;
export const missions = [{
    id: 'meter',
    title: '找到正確曝光',
    type: '基礎曝光',
    icon: 'exposure',
    desc: '在手動模式平衡光圈、快門與 ISO，讓街頭的明暗細節都留下來。',
    tip: '先固定 ISO，微調快門，直到曝光指針靠近 0。',
    rules: [
      ['選擇 M 手動模式', s => s.mode === 'M'],
      ['測光讀值在 ±0.5 EV 內', balanced]
    ]
  },
  {
    id: 'depth',
    title: '讓主體從背景浮現',
    type: '景深控制',
    icon: 'focus',
    desc: '用大光圈與中長焦，為選定的主體保留一小段清晰空間。',
    tip: '選 A 模式、85 mm 和 f/2.8，點選近處主體再拍攝。',
    rules: [
      ['使用 70 mm 以上焦段', s => s.focal >= 70],
      ['光圈 f/2.8 或更大', s => s.aperture <= 2.8],
      ['對焦於 15 m 內，曝光在 ±0.5 EV 內', s => s.focus <= 15 && balanced(s)]
    ]
  },
  {
    id: 'freeze',
    title: '凝結移動瞬間',
    type: '高速快門',
    icon: 'bolt',
    desc: '選擇高速快門，把移動中的主體定格在畫面裡。',
    tip: '可使用 S 模式，快門設為 1/500 秒或更快。若畫面偏暗，提高 ISO。',
    rules: [
      ['啟用場景主體動態', s => s.motionSpeed > 0],
      ['快門達 1/500 s 或更快', s => s.shutter <= 1 / 500],
      ['測光讀值在 ±0.5 EV 內', balanced]
    ]
  },
  {
    id: 'trail',
    title: '留下一道動感軌跡',
    type: '慢速快門',
    icon: 'wind',
    desc: '放慢快門，讓移動主體留下拖影，同時穩住街景。',
    tip: '用 35 mm、S 模式與低 ISO 試試 1/8 秒。打開防手震以穩定背景。',
    rules: [
      ['移動速度為一般或快速', s => s.motionSpeed >= 1],
      ['快門 1/15 s 或更慢', s => s.shutter >= 1 / 15],
      ['符合個人安全快門，曝光在 ±0.5 EV 內', s => s.shutter <= allowedTime(s) && balanced(s)]
    ]
  },
  {
    id: 'white',
    title: '校準街燈下的白平衡',
    type: '色溫判讀',
    icon: 'sun',
    desc: '在暖色光源下調整相機 K 值，讓畫面回到中性色調。',
    tip: '在白平衡頁將環境光調到 3200 K 左右，再調整相機白平衡。',
    rules: [
      ['環境光源介於 2800–3500 K', s => s.envK >= 2800 && s.envK <= 3500],
      ['白平衡與環境相差 200 K 以內', s => Math.abs(s.envK - s.wbK) <= 200],
      ['測光讀值在 ±0.5 EV 內', balanced]
    ]
  },
  {
    id: 'steady',
    title: '穩住長焦鏡頭',
    type: '手持穩定',
    icon: 'hand',
    desc: '測出自己的手持等級，再用防手震完成長焦拍攝。',
    tip: '先完成穩定度測驗，在 200 mm 以上啟用防手震。選比無防震稍慢的快門。',
    rules: [
      ['完成穩定度測驗並選用 200 mm 以上', s => s.tested && s.focal >= 200],
      ['開啟防手震，快門慢於無防震基準', s => s.isOn && s.shutter > 1 / (s.focal * s.steadyFactor)],
      ['符合防震後安全快門，曝光在 ±0.5 EV 內', s => s.shutter <= allowedTime(s) && balanced(s)]
    ]
  }
];
export const safeJSON = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem('focalab.' + k)) ?? fallback;
  } catch {
    return fallback;
  }
};
export function keep(k, value) {
  try {
    localStorage.setItem('focalab.' + k, JSON.stringify(value));
  } catch {}
}
export function openStore() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    let req;
    try {
      req = indexedDB.open('focalab-camera-v1', 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('shots', {
        keyPath: 'id'
      });
      db.createObjectStore('current');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}
export async function dbOp(db, store, mode, act) {
  if (!db) throw Error('storage');
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      request = act(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
