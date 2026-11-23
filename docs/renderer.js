import {
  clamp
} from './optics.js';
const vertex = 'attribute vec2 pos;varying vec2 uv;void main(){uv=vec2(pos.x*.5+.5,.5-pos.y*.5);gl_Position=vec4(pos,0.,1.);}';
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D base,smallA,smallB,smallC,depth;
uniform vec4 crop;
uniform vec2 movement,shake;
uniform vec3 gain;
uniform float inv,blur,light,noise,seed;
vec3 photo(vec2 p,float r){
 vec3 a=texture2D(base,p).rgb;
 if(r<.35)return a;
 vec3 b=texture2D(smallA,p).rgb;
 if(r<3.)return mix(a,b,smoothstep(.35,3.,r));
 vec3 c=texture2D(smallB,p).rgb;
 if(r<12.)return mix(b,c,smoothstep(3.,12.,r));
 return mix(c,texture2D(smallC,p).rgb,smoothstep(12.,40.,r));
}
float hash(vec2 p){return fract(sin(dot(mod(p,257.),vec2(12.9898,78.233))+seed)*43758.5453);}
void main(){
 vec2 p=crop.xy+uv*crop.zw;
 vec3 m=texture2D(depth,p).rgb;
 float di=(m.r*65280.+m.g*255.)*(4./65535.);
 float radius=abs(di-inv)*blur;
 vec3 color=photo(p,radius);
 vec2 dist=movement*m.b+shake;
 if(dot(dist,dist)>.00000001){
  vec3 total=vec3(0.);float weights=0.;
  for(int i=0;i<15;i++){
   float j=float(i)-7.;float t=(j+.24*sin(j*2.39996))/15.;
   vec2 pp=p+dist*t+shake.yx*(sin(t*6.28)*.18);
   float weight=1.-abs(t)*.65;
   total+=photo(pp,radius)*weight;weights+=weight;
  }
  color=total/weights;
 }
 color=pow(max(vec3(0.),pow(color,vec3(2.2))*gain*light),vec3(1./2.2));
 float n=(hash(gl_FragCoord.xy)-.5)+(hash(gl_FragCoord.yx+37.)-.5);
 color+=n*noise*(.55+.7*(1.-clamp(dot(color,vec3(.21,.72,.07)),0.,1.)));
 gl_FragColor=vec4(clamp(color,0.,1.),1.);
}`;

function levelCanvas(img, divisor) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width / divisor));
  c.height = Math.max(1, Math.round(img.height / divisor));
  const ctx = c.getContext('2d', {
    willReadFrequently: true
  });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function program(gl) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  return p;
}
const motionKernels = new Map([1, 5, 9, 17].map(count => {
  const samples = Array.from({
    length: count
  }, (_, i) => {
    const centered = i - (count - 1) / 2;
    return (centered + .24 * Math.sin(centered * 2.39996)) / count;
  });
  return [count, samples];
}));

function addBilinear(level, u, v, weight, out) {
  const w = level.w,
    h = level.h,
    fx = clamp(u * w - .5, 0, w - 1),
    fy = clamp(v * h - .5, 0, h - 1),
    x = Math.floor(fx),
    y = Math.floor(fy);
  const k = (y * w + x) * 4,
    dx = x < w - 1 ? 4 : 0,
    dy = y < h - 1 ? w * 4 : 0,
    a = fx - x,
    b = fy - y;
  const w00 = (1 - a) * (1 - b) * weight,
    w10 = a * (1 - b) * weight,
    w01 = (1 - a) * b * weight,
    w11 = a * b * weight,
    p = level.data;
  for (let ch = 0; ch < 3; ch++) {
    const j = k + ch;
    out[ch] += p[j] * w00 + p[j + dx] * w10 + p[j + dy] * w01 + p[j + dx + dy] * w11;
  }
}
export class CameraRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.textures = [];
    try {
      const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      });
      if (!gl) throw Error('No GL');
      this.gl = gl;
      const p = program(gl);
      this.p = p;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const pos = gl.getAttribLocation(p, 'pos');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      for (const key of ['base', 'smallA', 'smallB', 'smallC', 'depth', 'crop', 'movement', 'shake', 'gain', 'inv', 'blur', 'light', 'noise',
          'seed'
        ]) this.u[key] = gl.getUniformLocation(p, key);
      ['base', 'smallA', 'smallB', 'smallC', 'depth'].forEach((n, i) => gl.uniform1i(this.u[n], i));
      this.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        this.useCPU();
        if (this.map && this.levels) this.prepareCPU();
        this.onRecover?.();
      }, {
        once: true
      });
    } catch {
      this.useCPU();
    }
  }
  useCPU() {
    this.gl = null;
    const next = this.canvas.cloneNode(false);
    this.canvas.replaceWith(next);
    this.canvas = next;
    this.ctx = next.getContext('2d', {
      alpha: false
    });
    this.pixels = null;
  }
  setScene(img, map) {
    this.map = map;
    this.levels = [levelCanvas(img, 1), levelCanvas(img, 4), levelCanvas(img, 15), levelCanvas(img, 52)];
    if (this.gl) {
      this.levels.forEach((l, i) => this.texture(i, l));
      this.texture(4, map.canvas);
    } else this.prepareCPU();
  }
  setMap(map) {
    this.map = map;
    if (this.gl) this.texture(4, map.canvas);
  }
  texture(i, img) {
    const g = this.gl;
    const tex = this.textures[i] || (this.textures[i] = g.createTexture());
    g.activeTexture(g.TEXTURE0 + i);
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL, g.NONE);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
  }
  prepareCPU() {
    this.buffers = this.levels.map(l => ({
      w: l.width,
      h: l.height,
      data: l.getContext('2d').getImageData(0, 0, l.width, l.height).data
    }));
  }
  draw(p, width, interactive = false) {
    if (!this.levels) return;
    const w = this.gl ? clamp(Math.round(width / 16) * 16, 960, 1536) : (interactive ? clamp(Math.round(width / 24) * 16, 384, 608) : clamp(
        Math.round(width / 16) * 16, 576, 880)),
      h = w * 9 / 16;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.pixels = null;
    }
    if (!this.gl) {
      this.cpu(p, w, h);
      return;
    }
    const g = this.gl,
      u = this.u,
      c = p.crop;
    g.viewport(0, 0, w, h);
    g.uniform4f(u.crop, c.x, c.y, c.w, c.h);
    g.uniform2fv(u.movement, p.motion);
    g.uniform2fv(u.shake, p.shake);
    g.uniform3fv(u.gain, p.gain);
    for (const key of ['inv', 'blur', 'light', 'noise', 'seed']) g.uniform1f(u[key], p[key]);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }
  cpu(p, w, h) {
    const out = this.pixels || (this.pixels = this.ctx.createImageData(w, h)),
      d = out.data,
      c = p.crop,
      map = this.map,
      levels = this.buffers;
    const gain = p.gain.map(g => Math.pow(Math.max(.00001, g * p.light), 1 / 2.2));
    const rgb = new Float64Array(3);
    let rng = (Math.floor(p.seed * 1e6) + 21379) >>> 0;
    for (let y = 0, at = 0; y < h; y++) {
      const v = c.y + (y + .5) / h * c.h,
        depthRow = clamp(Math.floor(v * map.h), 0, map.h - 1) * map.w;
      for (let x = 0; x < w; x++, at += 4) {
        const u = c.x + (x + .5) / w * c.w,
          idx = depthRow + clamp(Math.floor(u * map.w), 0, map.w - 1);
        const r = Math.abs(map.inv[idx] - p.inv) * p.blur,
          l = r < 3 ? 0 : r < 12 ? 1 : 2,
          blend = clamp(l === 0 ? (r - .35) / 2.65 : l === 1 ? (r - 3) / 9 : (r - 12) / 28, 0, 1);
        const a = levels[l],
          b = levels[l + 1],
          dx = p.motion[0] * map.mask[idx] + p.shake[0],
          dy = p.motion[1] * map.mask[idx] + p.shake[1],
          travel = Math.abs(dx) * levels[0].w + Math.abs(dy) * levels[0].h,
          n = travel < .8 ? 1 : travel < 8 ? 5 : travel < 32 ? 9 : 17,
          kernel = motionKernels.get(n);
        rgb[0] = rgb[1] = rgb[2] = 0;
        for (let k = 0; k < n; k++) {
          const z = kernel[k],
            px = u + dx * z,
            py = v + dy * z;
          if (blend < 1) addBilinear(a, px, py, 1 - blend, rgb);
          if (blend > 0) addBilinear(b, px, py, blend, rgb);
        }
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        const grain = (rng / 4294967296 - .5) * p.noise * 350;
        d[at] = rgb[0] / n * gain[0] + grain;
        d[at + 1] = rgb[1] / n * gain[1] + grain;
        d[at + 2] = rgb[2] / n * gain[2] + grain;
        d[at + 3] = 255;
      }
    }
    this.ctx.putImageData(out, 0, 0);
  }
}
