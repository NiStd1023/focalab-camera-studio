// Camera JPEGs may identify the light source by category in the EXIF IFD.
export async function readExif(blob) {
  try {
    const v = new DataView(await blob.slice(0, 262144).arrayBuffer()),
      n = v.byteLength;
    if (n < 20 || v.getUint16(0) !== 0xffd8) return {};
    for (let p = 2; p + 4 < n;) {
      if (v.getUint8(p) !== 255) break;
      const tag = v.getUint8(p + 1);
      if (tag === 0xda || tag === 0xd9) break;
      const length = v.getUint16(p + 2);
      if (length < 2 || p + 2 + length > n) break;
      if (tag === 0xe1 && v.getUint32(p + 4) === 0x45786966) {
        const base = p + 10,
          end = p + 2 + length,
          le = v.getUint16(base) === 0x4949;
        const u16 = i => v.getUint16(i, le),
          u32 = i => v.getUint32(i, le);
        if (u16(base + 2) !== 42) return {};
        const get = (off, wanted) => {
          const t = base + off;
          if (t < base || t + 2 > end) return;
          const count = Math.min(u16(t), 512);
          for (let j = 0; j < count; j++) {
            const i = t + 2 + j * 12;
            if (i + 12 > end) break;
            if (u16(i) !== wanted) continue;
            const type = u16(i + 2),
              num = u32(i + 4);
            if (type === 3 && num >= 1) return num <= 2 ? u16(i + 8) : u16(base + u32(i + 8));
            if (type === 4 && num === 1) return u32(i + 8);
            if (type === 5 && num === 1) {
              const at = base + u32(i + 8);
              if (at + 8 <= end && u32(at + 4)) return u32(at) / u32(at + 4);
            }
          }
        };
        const ex = get(u32(base + 4), 0x8769);
        if (!ex) return {};
        const source = get(ex, 0x9208),
          ap = get(ex, 0x829d),
          time = get(ex, 0x829a),
          iso = get(ex, 0x8827);
        const k = ({
          1: 5500,
          2: 4200,
          3: 3000,
          4: 5500,
          9: 5500,
          10: 6500,
          11: 7500,
          12: 6200,
          13: 5000,
          14: 4100,
          15: 3500,
          17: 2850,
          18: 4900,
          19: 6750,
          20: 5500,
          21: 6500,
          22: 7500,
          23: 5000,
          24: 3200
        })[source];
        const ev = ap > 0 && time > 0 && iso > 0 ? Math.log2(ap * ap / time * 100 / iso) : undefined;
        return {
          k,
          ev
        };
      }
      p += length + 2;
    }
  } catch {}
  return {};
}
