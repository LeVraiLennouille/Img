(function () {
  'use strict';

  const Utils = {
    bytesToSize(bytes) {
      if (!bytes && bytes !== 0) return '—';
      if (bytes === 0) return '0 o';
      const units = ['o', 'Ko', 'Mo', 'Go'];
      const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
      const val = bytes / Math.pow(1024, i);
      return (i === 0 ? val : val.toFixed(val < 10 ? 2 : 1)) + ' ' + units[i];
    },
    clamp(v, min, max) {
      return Math.min(max, Math.max(min, v));
    },
    debounce(fn, ms) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    },
    nextFrame() {
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    },

    detectFormat(file) {
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      if (type.includes('svg') || name.endsWith('.svg')) return 'svg';
      if (type.includes('png') || name.endsWith('.png')) return 'png';
      if (type.includes('webp') || name.endsWith('.webp')) return 'webp';
      if (type.includes('avif') || name.endsWith('.avif')) return 'avif';
      if (type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')) return 'heic';
      if (type.includes('jpeg') || type.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
      return 'unknown';
    },
    mimeFor(format) {
      return {
        png: 'image/png',
        jpg: 'image/jpeg',
        webp: 'image/webp',
        avif: 'image/avif',
        svg: 'image/svg+xml'
      } [format] || 'application/octet-stream';
    },
    extFor(format) {
      return {
        jpg: 'jpg',
        png: 'png',
        webp: 'webp',
        avif: 'avif',
        svg: 'svg'
      } [format] || format;
    },
    labelFor(format) {
      return {
        jpg: 'JPG',
        png: 'PNG',
        webp: 'WEBP',
        avif: 'AVIF',
        svg: 'SVG',
        heic: 'HEIC'
      } [format] || (format || '').toUpperCase();
    },

    readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
        r.readAsText(file);
      });
    },

    _loadImgEl(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Ce fichier ne peut pas être décodé par votre navigateur."));
        img.src = url;
      });
    },
    parseSVGSize(svgText) {
      try {
        const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        const svg = doc.documentElement;
        if (!svg || svg.nodeName === 'parsererror') return {
          width: null,
          height: null
        };
        let w = parseFloat(svg.getAttribute('width'));
        let h = parseFloat(svg.getAttribute('height'));
        const vb = svg.getAttribute('viewBox');
        if ((!w || !h) && vb) {
          const parts = vb.trim().split(/[\s,]+/).map(Number);
          if (parts.length === 4) {
            w = w || parts[2];
            h = h || parts[3];
          }
        }
        return {
          width: isFinite(w) && w > 0 ? w : null,
          height: isFinite(h) && h > 0 ? h : null
        };
      } catch (e) {
        return {
          width: null,
          height: null
        };
      }
    },

    async loadImage(file) {
      const format = this.detectFormat(file);
      if (format === 'svg') {
        const text = await this.readFileAsText(file);
        const dims = this.parseSVGSize(text);
        const blob = new Blob([text], {
          type: 'image/svg+xml'
        });
        const url = URL.createObjectURL(blob);
        const img = await this._loadImgEl(url);
        return {
          img,
          url,
          width: Math.round(dims.width || img.naturalWidth || 300),
          height: Math.round(dims.height || img.naturalHeight || 150),
          format,
          svgText: text,
          isVector: true,
          fileSize: file.size,
          fileName: file.name
        };
      }
      const url = URL.createObjectURL(file);
      const img = await this._loadImgEl(url).catch(e => {
        URL.revokeObjectURL(url);
        throw e;
      });
      return {
        img,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format,
        isVector: false,
        fileSize: file.size,
        fileName: file.name
      };
    },

    canvasFrom(imgLike, w, h) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgLike, 0, 0, c.width, c.height);
      return c;
    },

    download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    downloadText(text, filename, mime) {
      this.download(new Blob([text], {
        type: mime || 'text/plain'
      }), filename);
    },

    canvasToBlob(canvas, mime, quality) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Export impossible dans ce format.'));
            return;
          }
          resolve(blob);
        }, mime, quality);
      });
    },

    setupDropzone(dropzoneEl, inputEl, onFile) {
      dropzoneEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzoneEl.classList.add('is-drag');
      });
      dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('is-drag'));
      dropzoneEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove('is-drag');
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
      inputEl.addEventListener('change', () => {
        const f = inputEl.files && inputEl.files[0];
        if (f) onFile(f);
        inputEl.value = '';
      });
    },

    showLoading(el, on) {
      el.classList.toggle('is-active', !!on);
    },

    _avifSupport: null,
    async checkAvifSupport() {
      if (this._avifSupport !== null) return this._avifSupport;
      try {
        const c = document.createElement('canvas');
        c.width = 2;
        c.height = 2;
        const blob = await this.canvasToBlob(c, 'image/avif', 0.8).catch(() => null);
        this._avifSupport = !!(blob && blob.type === 'image/avif');
      } catch (e) {
        this._avifSupport = false;
      }
      return this._avifSupport;
    },

    toast(msg) {
      let t = document.getElementById('gl-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'gl-toast';
        t.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:11px 18px;border-radius:8px;font-size:13px;box-shadow:var(--shadow-pop);z-index:999;opacity:0;transition:opacity .2s;max-width:80vw;text-align:center;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._h);
      t._h = setTimeout(() => {
        t.style.opacity = '0';
      }, 3400);
    },
  };

  const Engine = {};

  Engine.lanczosKernel = function (x, a) {
    if (x === 0) return 1;
    if (x <= -a || x >= a) return 0;
    const px = Math.PI * x;
    return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
  };

  Engine.resizeLanczos = function (src, srcW, srcH, dstW, dstH, a) {
    a = a || 3;
    const channels = 4;
    const xScale = srcW / dstW,
      yScale = srcH / dstH;
    const scaleForKernelX = xScale > 1 ? xScale : 1;
    const scaleForKernelY = yScale > 1 ? yScale : 1;
    const supportX = a * scaleForKernelX,
      supportY = a * scaleForKernelY;

    const temp = new Float32Array(dstW * srcH * channels);
    for (let dx = 0; dx < dstW; dx++) {
      const cx = (dx + 0.5) * xScale - 0.5;
      const left = Math.floor(cx - supportX),
        right = Math.ceil(cx + supportX);
      const weights = [];
      let wsum = 0;
      for (let sx = left; sx <= right; sx++) {
        const w = Engine.lanczosKernel((cx - sx) / scaleForKernelX, a);
        weights.push(w);
        wsum += w;
      }
      if (Math.abs(wsum) < 1e-9) wsum = 1;
      for (let sy = 0; sy < srcH; sy++) {
        let r = 0,
          g = 0,
          b = 0,
          al = 0;
        for (let k = 0; k < weights.length; k++) {
          const sx = left + k;
          const clx = sx < 0 ? 0 : sx >= srcW ? srcW - 1 : sx;
          const idx = (sy * srcW + clx) * channels,
            w = weights[k];
          r += src[idx] * w;
          g += src[idx + 1] * w;
          b += src[idx + 2] * w;
          al += src[idx + 3] * w;
        }
        const tIdx = (sy * dstW + dx) * channels;
        temp[tIdx] = r / wsum;
        temp[tIdx + 1] = g / wsum;
        temp[tIdx + 2] = b / wsum;
        temp[tIdx + 3] = al / wsum;
      }
    }
    const out = new Uint8ClampedArray(dstW * dstH * channels);
    for (let dy = 0; dy < dstH; dy++) {
      const cy = (dy + 0.5) * yScale - 0.5;
      const top = Math.floor(cy - supportY),
        bottom = Math.ceil(cy + supportY);
      const weights = [];
      let wsum = 0;
      for (let sy = top; sy <= bottom; sy++) {
        const w = Engine.lanczosKernel((cy - sy) / scaleForKernelY, a);
        weights.push(w);
        wsum += w;
      }
      if (Math.abs(wsum) < 1e-9) wsum = 1;
      for (let dx = 0; dx < dstW; dx++) {
        let r = 0,
          g = 0,
          b = 0,
          al = 0;
        for (let k = 0; k < weights.length; k++) {
          const sy = top + k;
          const cly = sy < 0 ? 0 : sy >= srcH ? srcH - 1 : sy;
          const idx = (cly * dstW + dx) * channels,
            w = weights[k];
          r += temp[idx] * w;
          g += temp[idx + 1] * w;
          b += temp[idx + 2] * w;
          al += temp[idx + 3] * w;
        }
        const oIdx = (dy * dstW + dx) * channels;
        out[oIdx] = r / wsum;
        out[oIdx + 1] = g / wsum;
        out[oIdx + 2] = b / wsum;
        out[oIdx + 3] = al / wsum;
      }
    }
    return out;
  };

  Engine.srgbToLinear = function (c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  Engine.rgbToLab = function (r, g, b) {
    const rl = Engine.srgbToLinear(r),
      gl = Engine.srgbToLinear(g),
      bl = Engine.srgbToLinear(b);
    let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
    x /= 0.95047;
    y /= 1.0;
    z /= 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(x),
      fy = f(y),
      fz = f(z);
    return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  Engine.labDistance = function (c1, c2) {
    const [L1, A1, B1] = Engine.rgbToLab(c1[0], c1[1], c1[2]);
    const [L2, A2, B2] = Engine.rgbToLab(c2[0], c2[1], c2[2]);
    return Math.sqrt((L1 - L2) ** 2 + (A1 - A2) ** 2 + (B1 - B2) ** 2);
  };

  Engine.NEIGHBOR_STEP_LIMIT = 22;
  Engine.floodFillBackground = function (data, width, height, tolerance, seeds, visitedOut) {
    const visited = visitedOut || new Uint8Array(width * height);
    const queue = [];
    let sumR = 0,
      sumG = 0,
      sumB = 0,
      cnt = 0;
    for (const [sx, sy] of seeds) {
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const idx = sy * width + sx;
      if (!visited[idx]) {
        visited[idx] = 1;
        queue.push(idx);
        const p = idx * 4;
        sumR += data[p];
        sumG += data[p + 1];
        sumB += data[p + 2];
        cnt++;
      }
    }
    const baseColor = cnt ? [sumR / cnt, sumG / cnt, sumB / cnt] : [128, 128, 128];
    let qHead = 0;
    while (qHead < queue.length) {
      const idx = queue[qHead++];
      const x = idx % width,
        y = (idx / width) | 0;
      const pIdx = idx * 4;
      const r = data[pIdx],
        g = data[pIdx + 1],
        b = data[pIdx + 2];
      data[pIdx + 3] = 0;
      const nb = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx]) continue;
        const nP = nIdx * 4;
        const cand = [data[nP], data[nP + 1], data[nP + 2]];
        if (Engine.labDistance([r, g, b], cand) > Engine.NEIGHBOR_STEP_LIMIT) continue;
        if (Engine.labDistance(baseColor, cand) <= tolerance) {
          visited[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }
    return visited;
  };
  Engine.featherAlpha = function (data, width, height, radius) {
    if (radius <= 0) return;
    const alpha = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) alpha[i] = data[i * 4 + 3];
    const tmp = new Float32Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let s = 0,
          c = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Utils.clamp(x + k, 0, width - 1);
          s += alpha[y * width + sx];
          c++;
        }
        tmp[y * width + x] = s / c;
      }
    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++) {
        let s = 0,
          c = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Utils.clamp(y + k, 0, height - 1);
          s += tmp[sy * width + x];
          c++;
        }
        data[(y * width + x) * 4 + 3] = Math.round(s / c);
      }
  };

  Engine.boxBlurRGB = function (data, width, height, radius) {
    const out = new Float32Array(data.length);
    const tmp = new Float32Array(data.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          cnt = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Utils.clamp(x + k, 0, width - 1);
          const idx = (y * width + sx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          cnt++;
        }
        const oi = (y * width + x) * 4;
        tmp[oi] = r / cnt;
        tmp[oi + 1] = g / cnt;
        tmp[oi + 2] = b / cnt;
        tmp[oi + 3] = data[oi + 3];
      }
    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++) {
        let r = 0,
          g = 0,
          b = 0,
          cnt = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Utils.clamp(y + k, 0, height - 1);
          const idx = (sy * width + x) * 4;
          r += tmp[idx];
          g += tmp[idx + 1];
          b += tmp[idx + 2];
          cnt++;
        }
        const oi = (y * width + x) * 4;
        out[oi] = r / cnt;
        out[oi + 1] = g / cnt;
        out[oi + 2] = b / cnt;
        out[oi + 3] = data[oi + 3];
      }
    return out;
  };
  Engine.unsharpMask = function (data, width, height, amount, radius) {
    radius = radius || 1;
    const blurred = Engine.boxBlurRGB(data, width, height, radius);
    const out = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      out[i] = data[i] + amount * (data[i] - blurred[i]);
      out[i + 1] = data[i + 1] + amount * (data[i + 1] - blurred[i + 1]);
      out[i + 2] = data[i + 2] + amount * (data[i + 2] - blurred[i + 2]);
      out[i + 3] = data[i + 3];
    }
    return out;
  };

  Engine.minifySVG = function (svgText) {
    let out = svgText;
    out = out.replace(/<!--[\s\S]*?-->/g, '');
    out = out.replace(/<\?xml[^>]*\?>/g, '');
    out = out.replace(/<(metadata|sodipodi:namedview)[^>]*>[\s\S]*?<\/\1>/gi, '');
    out = out.replace(/<(metadata|sodipodi:namedview)[^>]*\/>/gi, '');
    out = out.replace(/\s(inkscape|sodipodi):[\w-]+="[^"]*"/gi, '');
    out = out.replace(/\sxmlns:(inkscape|sodipodi)="[^"]*"/gi, '');
    out = out.replace(/>\s+</g, '><');
    out = out.trim();
    out = out.replace(/[ \t\r\n]{2,}/g, ' ');
    out = out.replace(/\d+\.\d{4,}/g, (m) => {
      let s = parseFloat(m).toFixed(3);
      s = s.replace(/0+$/, '').replace(/\.$/, '');
      return s;
    });
    return out;
  };

  Engine.buildPalette = function (data, maxColors) {
    const buckets = new Map();
    const shift = 3;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const key = ((r >> shift) << 10) | ((g >> shift) << 5) | (b >> shift);
      let e = buckets.get(key);
      if (!e) {
        e = {
          count: 0,
          r: 0,
          g: 0,
          b: 0
        };
        buckets.set(key, e);
      }
      e.count++;
      e.r += r;
      e.g += g;
      e.b += b;
    }
    const arr = [...buckets.values()].map(e => ({
      r: Math.round(e.r / e.count),
      g: Math.round(e.g / e.count),
      b: Math.round(e.b / e.count),
      count: e.count
    }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, maxColors);
  };
  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  Engine.quantizeImage = function (data, width, height, maxColors, dither) {
    const palette = Engine.buildPalette(data, maxColors);
    if (palette.length <= 1) return palette;
    const BITS = 6,
      SHIFT = 8 - BITS,
      LEVELS = 1 << BITS;
    const lut = new Int16Array(LEVELS * LEVELS * LEVELS).fill(-1);
    const ditherStrength = 255 / (2 * Math.cbrt(maxColors));

    function nearestIdx(r, g, b) {
      let best = 0,
        bestD = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const dr = r - palette[p].r,
          dg = g - palette[p].g,
          db = b - palette[p].b;
        const d = 0.9 * dr * dr + 1.5 * dg * dg + 0.6 * db * db;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 8) continue;
        let r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (dither) {
          const t = (BAYER4[y & 3][x & 3] / 16 - 0.5) * ditherStrength;
          r = Utils.clamp(Math.round(r + t), 0, 255);
          g = Utils.clamp(Math.round(g + t), 0, 255);
          b = Utils.clamp(Math.round(b + t), 0, 255);
        }
        const li = (((r >> SHIFT) * LEVELS) + (g >> SHIFT)) * LEVELS + (b >> SHIFT);
        let idx = lut[li];
        if (idx === -1) {
          idx = nearestIdx(r, g, b);
          lut[li] = idx;
        }
        data[i] = palette[idx].r;
        data[i + 1] = palette[idx].g;
        data[i + 2] = palette[idx].b;
      }
    return palette;
  };

  Engine.scopeCSS = function (css, scopeSelector) {
    let i = 0;
    const n = css.length;

    function skipWs() {
      while (i < n && /\s/.test(css[i])) i++;
    }

    function captureRaw() {
      let start = i,
        depth = 1;
      while (i < n && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      return css.slice(start, i);
    }

    function parseList() {
      let result = '';
      while (i < n) {
        skipWs();
        if (i >= n) break;
        if (css[i] === '}') return result;
        if (css[i] === '@') {
          let start = i;
          while (i < n && css[i] !== '{' && css[i] !== ';') i++;
          const atHeader = css.slice(start, i).trim();
          if (i < n && css[i] === ';') {
            result += atHeader + ';';
            i++;
            continue;
          }
          if (i >= n) {
            result += atHeader;
            break;
          }
          i++;
          const m = atHeader.match(/^@([a-zA-Z-]+)/);
          const atName = m ? m[1].toLowerCase() : '';
          if (atName === 'media' || atName === 'supports') {
            const inner = parseList();
            result += atHeader + '{' + inner + '}';
            if (css[i] === '}') i++;
          } else {
            const raw = captureRaw();
            result += atHeader + '{' + raw + '}';
            if (css[i] === '}') i++;
          }
          continue;
        }
        let selStart = i;
        while (i < n && css[i] !== '{' && css[i] !== '}') i++;
        if (i >= n || css[i] === '}') {
          result += css.slice(selStart, i);
          return result;
        }
        const rawSel = css.slice(selStart, i).trim();
        i++;
        const decls = captureRaw();
        if (css[i] === '}') i++;
        if (!rawSel) continue;
        const scoped = rawSel.split(',').map(s => {
          s = s.trim();
          if (!s) return null;
          if (/^(html|body)$/i.test(s)) return scopeSelector;
          if (/^(html|body)\b/i.test(s)) return s.replace(/^(html|body)\b/i, scopeSelector);
          return scopeSelector + ' ' + s;
        }).filter(Boolean).join(', ');
        result += scoped + '{' + decls + '}';
      }
      return result;
    }
    return parseList();
  };

  window.__AtelierEngine = Engine;
  window.__AtelierUtils = Utils;

  Utils.capDimensions = function (w, h, maxPixels) {
    maxPixels = maxPixels || 30000000;
    const total = w * h;
    if (total <= maxPixels) return {
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
      capped: false
    };
    const scale = Math.sqrt(maxPixels / total);
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      capped: true
    };
  };

  function initNav() {
    const btns = Array.prototype.slice.call(document.querySelectorAll('.rail-btn'));
    const panels = Array.prototype.slice.call(document.querySelectorAll('.tool-panel'));

    function activate(tool) {
      btns.forEach(b => b.setAttribute('aria-current', String(b.dataset.tool === tool)));
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.tool === tool));
      const workspace = document.getElementById('workspace');
      if (workspace) workspace.scrollTop = 0;
      window.scrollTo(0, 0);
      const activeBtn = btns.find(b => b.dataset.tool === tool);
      if (activeBtn && activeBtn.scrollIntoView) activeBtn.scrollIntoView({
        inline: 'center',
        block: 'nearest'
      });
    }
    btns.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.tool)));
  }

  const Compress = {
    state: {
      data: null
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('cp-dropzone'),
        input: $('cp-file-input'),
        stage: $('cp-stage'),
        loading: $('cp-loading'),
        preview: $('cp-preview'),
        stats: $('cp-stats'),
        statBefore: $('cp-stat-before'),
        statAfter: $('cp-stat-after'),
        statGain: $('cp-stat-gain'),
        statDims: $('cp-stat-dims'),
        controlsRaster: $('cp-controls-raster'),
        quality: $('cp-quality-slider'),
        qualityValue: $('cp-quality-value'),
        pngField: $('cp-png-field'),
        quantizeToggle: $('cp-quantize-toggle'),
        colorsSelect: $('cp-colors-select'),
        controlsSvg: $('cp-controls-svg'),
        downloadBtn: $('cp-download-btn'),
        resetBtn: $('cp-reset-btn'),
      };
      this.els.qualityField = this.els.quality.closest('.field');
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.quality.addEventListener('input', () => {
        this.els.qualityValue.textContent = this.els.quality.value + '%';
      });
      this.els.quality.addEventListener('change', () => this.process());
      this.els.quantizeToggle.addEventListener('change', () => {
        this.els.colorsSelect.disabled = !this.els.quantizeToggle.checked;
        this.process();
      });
      this.els.colorsSelect.addEventListener('change', () => this.process());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        const isSvg = data.format === 'svg';
        this.els.controlsRaster.style.display = isSvg ? 'none' : 'block';
        this.els.controlsSvg.style.display = isSvg ? 'block' : 'none';
        this.els.pngField.style.display = (!isSvg && data.format === 'png') ? 'block' : 'none';
        this.els.qualityField.style.display = (!isSvg && data.format !== 'png') ? 'block' : 'none';
        this.els.quantizeToggle.checked = false;
        this.els.colorsSelect.disabled = true;
        this.els.statBefore.textContent = Utils.bytesToSize(data.fileSize);
        this.els.statDims.textContent = data.width + ' × ' + data.height;
        await this.process();
      } catch (e) {
        Utils.toast(e.message || 'Impossible de charger ce fichier.');
      }
    },
    async process() {
      const data = this.state.data;
      if (!data) return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        if (data.format === 'svg') {
          const minified = Engine.minifySVG(data.svgText);
          this._resultBlob = new Blob([minified], {
            type: 'image/svg+xml'
          });
          this._resultExt = 'svg';
        } else {
          const canvas = Utils.canvasFrom(data.img, data.width, data.height);
          const ctx = canvas.getContext('2d');
          const mime = Utils.mimeFor(data.format);
          const quality = parseInt(this.els.quality.value, 10) / 100;
          if (data.format === 'png' && this.els.quantizeToggle.checked) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            Engine.quantizeImage(imgData.data, canvas.width, canvas.height, parseInt(this.els.colorsSelect.value, 10), true);
            ctx.putImageData(imgData, 0, 0);
          }
          const blob = await Utils.canvasToBlob(canvas, mime, quality);
          if (blob.type !== mime) throw new Error("Votre navigateur ne peut pas ré-encoder ce format ici.");
          this._resultBlob = blob;
          this._resultExt = Utils.extFor(data.format);
        }
        this.els.preview.src = URL.createObjectURL(this._resultBlob);
        this.els.statAfter.textContent = Utils.bytesToSize(this._resultBlob.size);
        const gain = data.fileSize ? Math.round((1 - this._resultBlob.size / data.fileSize) * 100) : 0;
        this.els.statGain.textContent = (gain > 0 ? '-' : gain < 0 ? '+' : '') + Math.abs(gain) + '%';
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || 'La compression a échoué.');
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-compresse.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.preview.src = '';
      this.els.quantizeToggle.checked = false;
      this.els.colorsSelect.disabled = true;
    }
  };

  const Resize = {
    state: {
      data: null,
      mode: 'percent',
      lockAspect: true
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('rs-dropzone'),
        input: $('rs-file-input'),
        stage: $('rs-stage'),
        loading: $('rs-loading'),
        preview: $('rs-preview'),
        stats: $('rs-stats'),
        statBefore: $('rs-stat-before'),
        statAfter: $('rs-stat-after'),
        statSize: $('rs-stat-size'),
        controlsRaster: $('rs-controls-raster'),
        modePercentBtn: $('rs-mode-percent-btn'),
        modePixelBtn: $('rs-mode-pixel-btn'),
        percentBlock: $('rs-percent-block'),
        percentSlider: $('rs-percent-slider'),
        percentValue: $('rs-percent-value'),
        pixelBlock: $('rs-pixel-block'),
        widthInput: $('rs-width-input'),
        heightInput: $('rs-height-input'),
        lockBtn: $('rs-lock-btn'),
        controlsSvg: $('rs-controls-svg'),
        svgPercent: $('rs-svg-percent'),
        svgPercentValue: $('rs-svg-percent-value'),
        downloadBtn: $('rs-download-btn'),
        resetBtn: $('rs-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.modePercentBtn.addEventListener('click', () => this.setMode('percent'));
      this.els.modePixelBtn.addEventListener('click', () => this.setMode('pixel'));
      this.els.percentSlider.addEventListener('input', () => {
        this.els.percentValue.textContent = this.els.percentSlider.value + '%';
      });
      this.els.percentSlider.addEventListener('change', () => this.process());
      this.els.widthInput.addEventListener('input', () => this.onWidthInput());
      this.els.heightInput.addEventListener('input', () => this.onHeightInput());
      this.els.widthInput.addEventListener('change', () => this.process());
      this.els.heightInput.addEventListener('change', () => this.process());
      this.els.lockBtn.addEventListener('click', () => {
        this.state.lockAspect = !this.state.lockAspect;
        this.els.lockBtn.setAttribute('aria-pressed', String(this.state.lockAspect));
      });
      this.els.svgPercent.addEventListener('input', () => {
        this.els.svgPercentValue.textContent = this.els.svgPercent.value + '%';
      });
      this.els.svgPercent.addEventListener('change', () => this.process());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    setMode(mode) {
      this.state.mode = mode;
      this.els.modePercentBtn.setAttribute('aria-pressed', String(mode === 'percent'));
      this.els.modePixelBtn.setAttribute('aria-pressed', String(mode === 'pixel'));
      this.els.percentBlock.style.display = mode === 'percent' ? 'block' : 'none';
      this.els.pixelBlock.style.display = mode === 'pixel' ? 'block' : 'none';
      if (this.state.data) this.process();
    },
    onWidthInput() {
      if (!this.state.data) return;
      const w = parseInt(this.els.widthInput.value, 10);
      if (this.state.lockAspect && w > 0) this.els.heightInput.value = Math.round(w * (this.state.data.height / this.state.data.width));
    },
    onHeightInput() {
      if (!this.state.data) return;
      const h = parseInt(this.els.heightInput.value, 10);
      if (this.state.lockAspect && h > 0) this.els.widthInput.value = Math.round(h * (this.state.data.width / this.state.data.height));
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        const isSvg = data.format === 'svg';
        this.els.controlsRaster.style.display = isSvg ? 'none' : 'block';
        this.els.controlsSvg.style.display = isSvg ? 'block' : 'none';
        this.els.widthInput.value = data.width;
        this.els.heightInput.value = data.height;
        this.els.statBefore.textContent = data.width + ' × ' + data.height;
        this.els.percentSlider.value = 100;
        this.els.percentValue.textContent = '100%';
        this.els.svgPercent.value = 100;
        this.els.svgPercentValue.textContent = '100%';
        this.state.mode = 'percent';
        this.els.modePercentBtn.setAttribute('aria-pressed', 'true');
        this.els.modePixelBtn.setAttribute('aria-pressed', 'false');
        this.els.percentBlock.style.display = 'block';
        this.els.pixelBlock.style.display = 'none';
        await this.process();
      } catch (e) {
        Utils.toast(e.message || 'Impossible de charger ce fichier.');
      }
    },
    async process() {
      const data = this.state.data;
      if (!data) return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        if (data.format === 'svg') {
          const pct = parseInt(this.els.svgPercent.value, 10) / 100;
          const newW = Math.max(1, Math.round(data.width * pct)),
            newH = Math.max(1, Math.round(data.height * pct));
          const doc = new DOMParser().parseFromString(data.svgText, 'image/svg+xml');
          const svg = doc.documentElement;
          if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + data.width + ' ' + data.height);
          svg.setAttribute('width', String(newW));
          svg.setAttribute('height', String(newH));
          const serialized = new XMLSerializer().serializeToString(svg);
          this._resultBlob = new Blob([serialized], {
            type: 'image/svg+xml'
          });
          this._resultExt = 'svg';
          this.els.preview.src = URL.createObjectURL(this._resultBlob);
          this.els.statAfter.textContent = newW + ' × ' + newH;
          this.els.statSize.textContent = Utils.bytesToSize(this._resultBlob.size);
        } else {
          let targetW, targetH;
          if (this.state.mode === 'percent') {
            const pct = parseInt(this.els.percentSlider.value, 10) / 100;
            targetW = data.width * pct;
            targetH = data.height * pct;
          } else {
            targetW = parseInt(this.els.widthInput.value, 10) || data.width;
            targetH = parseInt(this.els.heightInput.value, 10) || data.height;
          }
          const capped = Utils.capDimensions(targetW, targetH);
          if (capped.capped) Utils.toast('Dimensions limitées à ~30 mégapixels pour rester fluide dans le navigateur.');
          const newW = capped.width,
            newH = capped.height;
          const srcCanvas = Utils.canvasFrom(data.img, data.width, data.height);
          const srcImgData = srcCanvas.getContext('2d').getImageData(0, 0, data.width, data.height);
          const outData = Engine.resizeLanczos(srcImgData.data, data.width, data.height, newW, newH);
          const outCanvas = document.createElement('canvas');
          outCanvas.width = newW;
          outCanvas.height = newH;
          outCanvas.getContext('2d').putImageData(new ImageData(outData, newW, newH), 0, 0);
          const mime = Utils.mimeFor(data.format);
          const blob = await Utils.canvasToBlob(outCanvas, mime, 0.92);
          this._resultBlob = blob;
          this._resultExt = Utils.extFor(data.format);
          this.els.preview.src = URL.createObjectURL(blob);
          this.els.statAfter.textContent = newW + ' × ' + newH;
          this.els.statSize.textContent = Utils.bytesToSize(blob.size);
        }
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || 'Le redimensionnement a échoué.');
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-redimensionne.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.preview.src = '';
    }
  };

  Utils.extForMime = function (mime) {
    const map = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/svg+xml': 'svg'
    };
    return map[mime] || 'png';
  };

  const Convert = {
    state: {
      data: null
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('cv-dropzone'),
        input: $('cv-file-input'),
        stage: $('cv-stage'),
        loading: $('cv-loading'),
        preview: $('cv-preview'),
        stats: $('cv-stats'),
        statFrom: $('cv-stat-from'),
        statTo: $('cv-stat-to'),
        statSize: $('cv-stat-size'),
        formatSelect: $('cv-format-select'),
        optAvif: $('cv-opt-avif'),
        qualityRow: $('cv-quality-row'),
        qualitySlider: $('cv-quality-slider'),
        qualityValue: $('cv-quality-value'),
        svgScaleRow: $('cv-svg-scale-row'),
        svgWidth: $('cv-svg-width'),
        notice: $('cv-notice'),
        downloadBtn: $('cv-download-btn'),
        resetBtn: $('cv-reset-btn'),
      };
      Utils.checkAvifSupport().then(supported => {
        if (!supported) {
          this.els.optAvif.disabled = true;
          this.els.optAvif.textContent = 'AVIF — indisponible sur ce navigateur';
        }
      });
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.formatSelect.addEventListener('change', () => {
        this.updateFormatUI();
        this.process();
      });
      this.els.qualitySlider.addEventListener('input', () => {
        this.els.qualityValue.textContent = this.els.qualitySlider.value + '%';
      });
      this.els.qualitySlider.addEventListener('change', () => this.process());
      this.els.svgWidth.addEventListener('change', () => this.process());
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    updateFormatUI() {
      const fmt = this.els.formatSelect.value;
      this.els.qualityRow.style.display = (fmt === 'jpg' || fmt === 'webp' || fmt === 'avif') ? 'block' : 'none';
      const isSvgSource = this.state.data && this.state.data.format === 'svg';
      this.els.svgScaleRow.style.display = (isSvgSource && fmt !== 'svg') ? 'block' : 'none';
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        this.els.statFrom.textContent = Utils.labelFor(data.format);
        if (data.isVector) this.els.svgWidth.value = data.width;
        this.updateFormatUI();
        await this.process();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async process() {
      const data = this.state.data;
      if (!data) return;
      const targetFormat = this.els.formatSelect.value;
      this.els.notice.style.display = 'none';
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        if (targetFormat === 'svg') {
          let outText;
          if (data.format === 'svg') {
            outText = Engine.minifySVG(data.svgText);
          } else {
            const canvas = Utils.canvasFrom(data.img, data.width, data.height);
            const dataUrl = canvas.toDataURL('image/png');
            outText = '<svg xmlns="http://www.w3.org/2000/svg" width="' + data.width + '" height="' + data.height + '" viewBox="0 0 ' + data.width + ' ' + data.height + '"><image width="' + data.width + '" height="' + data.height + '" href="' + dataUrl + '"/></svg>';
            this.els.notice.style.display = 'flex';
            this.els.notice.textContent = "Ce SVG encapsule l'image en base64 : ce n'est pas une vectorisation par tracé, mais un conteneur vectoriel valide et portable.";
          }
          this._resultBlob = new Blob([outText], {
            type: 'image/svg+xml'
          });
          this._resultExt = 'svg';
        } else {
          let sourceCanvas;
          if (data.format === 'svg') {
            const targetW = Math.max(16, parseInt(this.els.svgWidth.value, 10) || data.width);
            const targetH = Math.max(1, Math.round(targetW * (data.height / data.width)));
            sourceCanvas = Utils.canvasFrom(data.img, targetW, targetH);
          } else {
            sourceCanvas = Utils.canvasFrom(data.img, data.width, data.height);
          }
          const mime = Utils.mimeFor(targetFormat);
          const quality = parseInt(this.els.qualitySlider.value, 10) / 100;
          const blob = await Utils.canvasToBlob(sourceCanvas, mime, quality);
          if (blob.type !== mime) {
            this.els.notice.style.display = 'flex';
            this.els.notice.textContent = "Votre navigateur ne prend pas en charge l'export " + Utils.labelFor(targetFormat) + " : image renvoyée en " + Utils.labelFor(Utils.extForMime(blob.type)) + " à la place.";
          }
          this._resultBlob = blob;
          this._resultExt = Utils.extForMime(blob.type);
        }
        this.els.preview.src = URL.createObjectURL(this._resultBlob);
        this.els.statTo.textContent = Utils.labelFor(this._resultExt);
        this.els.statSize.textContent = Utils.bytesToSize(this._resultBlob.size);
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || "La conversion a échoué.");
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-converti.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.preview.src = '';
      this.els.notice.style.display = 'none';
    }
  };

  const CropRotate = {
    state: {
      data: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      aspect: null,
      crop: {
        x: 0,
        y: 0,
        w: 0,
        h: 0
      }
    },
    drag: null,
    working: null,
    displayScale: 1,
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('cr-dropzone'),
        input: $('cr-file-input'),
        stage: $('cr-stage'),
        loading: $('cr-loading'),
        cropStage: $('cr-crop-stage'),
        image: $('cr-image'),
        cropBox: $('cr-crop-box'),
        stats: $('cr-stats'),
        statSel: $('cr-stat-sel'),
        statRot: $('cr-stat-rot'),
        rotateSlider: $('cr-rotate-slider'),
        rotateValue: $('cr-rotate-value'),
        rotateLeft90: $('cr-rotate-left90'),
        rotateRight90: $('cr-rotate-right90'),
        flipHBtn: $('cr-flip-h'),
        flipVBtn: $('cr-flip-v'),
        aspectRow: $('cr-aspect-row'),
        resetCropBtn: $('cr-reset-crop-btn'),
        svgNote: $('cr-svg-note'),
        downloadBtn: $('cr-download-btn'),
        resetBtn: $('cr-reset-btn'),
      };
      this.handles = Array.prototype.slice.call(this.els.cropBox.querySelectorAll('.crop-handle'));
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      this.els.rotateSlider.addEventListener('input', () => {
        this.state.rotation = parseInt(this.els.rotateSlider.value, 10);
        this.els.rotateValue.textContent = this.state.rotation + '°';
        this.els.statRot.textContent = this.state.rotation + '°';
      });
      this.els.rotateSlider.addEventListener('change', () => this.renderWorking(true));
      this.els.rotateLeft90.addEventListener('click', () => this.nudgeRotation(-90));
      this.els.rotateRight90.addEventListener('click', () => this.nudgeRotation(90));
      this.els.flipHBtn.addEventListener('click', () => {
        this.state.flipH = !this.state.flipH;
        this.renderWorking(false);
      });
      this.els.flipVBtn.addEventListener('click', () => {
        this.state.flipV = !this.state.flipV;
        this.renderWorking(false);
      });
      Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(chip => {
        chip.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
          const r = chip.dataset.ratio;
          this.state.aspect = r === 'free' ? null : this._parseRatio(r);
          this.resetCropRect();
          this.renderCropBox();
        });
      });
      this.els.resetCropBtn.addEventListener('click', () => {
        this.resetCropRect();
        this.renderCropBox();
      });
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
      this.els.cropBox.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();
        this.startDrag('move', e);
      });
      this.handles.forEach(h => h.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.startDrag(h.dataset.h, e);
      }));
      window.addEventListener('pointermove', (e) => this.onDrag(e));
      window.addEventListener('pointerup', () => this.endDrag());
    },
    _parseRatio(r) {
      const parts = r.split(':').map(Number);
      return parts[0] / parts[1];
    },
    nudgeRotation(delta) {
      let r = this.state.rotation + delta;
      if (r > 180) r -= 360;
      if (r < -180) r += 360;
      this.state.rotation = r;
      this.els.rotateSlider.value = r;
      this.els.rotateValue.textContent = r + '°';
      this.els.statRot.textContent = r + '°';
      this.renderWorking(true);
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        if (data.isVector) {
          const targetW = Math.max(data.width, 900);
          const targetH = Math.max(1, Math.round(targetW * (data.height / data.width)));
          const raster = Utils.canvasFrom(data.img, targetW, targetH);
          data.img = raster;
          data.width = targetW;
          data.height = targetH;
          this.els.svgNote.style.display = 'flex';
        } else {
          this.els.svgNote.style.display = 'none';
        }
        this.state.data = data;
        this.state.rotation = 0;
        this.state.flipH = false;
        this.state.flipV = false;
        this.state.aspect = null;
        this.els.rotateSlider.value = 0;
        this.els.rotateValue.textContent = '0°';
        this.els.statRot.textContent = '0°';
        Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.ratio === 'free')));
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        await this.renderWorking(true);
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async renderWorking(resetCrop) {
      const data = this.state.data;
      if (!data) return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        const deg = this.state.rotation;
        const isExact90 = (deg % 90 === 0);
        const canvas = isExact90 ?
          this._rotateExact(data.img, data.width, data.height, ((deg % 360) + 360) % 360, this.state.flipH, this.state.flipV) :
          this._rotateFree(data.img, data.width, data.height, deg, this.state.flipH, this.state.flipV);
        this.working = canvas;
        const blob = await Utils.canvasToBlob(canvas, 'image/png');
        const url = URL.createObjectURL(blob);
        const oldUrl = this.els.image.src;
        await new Promise(resolve => {
          this.els.image.onload = resolve;
          this.els.image.src = url;
        });
        if (oldUrl && oldUrl.indexOf('blob:') === 0) URL.revokeObjectURL(oldUrl);
        this.displayScale = this.els.image.clientWidth / canvas.width;
        if (resetCrop || !this.state.crop.w) this.resetCropRect();
        this.renderCropBox();
        this.els.downloadBtn.disabled = false;
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    _rotateExact(img, w, h, deg, flipH, flipV) {
      const swapped = (deg === 90 || deg === 270);
      const cw = swapped ? h : w,
        ch = swapped ? w : h;
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.rotate(deg * Math.PI / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      return canvas;
    },
    _rotateFree(img, w, h, deg, flipH, flipV) {
      const rad = deg * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)),
        sin = Math.abs(Math.sin(rad));
      const cw = Math.ceil(w * cos + h * sin),
        ch = Math.ceil(w * sin + h * cos);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      return canvas;
    },
    resetCropRect() {
      if (!this.working) return;
      let w = this.working.width,
        h = this.working.height;
      if (this.state.aspect) {
        const targetRatio = this.state.aspect;
        if (w / h > targetRatio) w = h * targetRatio;
        else h = w / targetRatio;
      }
      this.state.crop = {
        x: (this.working.width - w) / 2,
        y: (this.working.height - h) / 2,
        w,
        h
      };
    },
    renderCropBox() {
      const c = this.state.crop,
        s = this.displayScale;
      this.els.cropBox.style.left = (c.x * s) + 'px';
      this.els.cropBox.style.top = (c.y * s) + 'px';
      this.els.cropBox.style.width = (c.w * s) + 'px';
      this.els.cropBox.style.height = (c.h * s) + 'px';
      this.els.statSel.textContent = Math.round(c.w) + ' × ' + Math.round(c.h);
    },
    startDrag(handle, e) {
      this.drag = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: Object.assign({}, this.state.crop)
      };
    },
    onDrag(e) {
      if (!this.drag || !this.working) return;
      const s = this.displayScale || 1;
      const dx = (e.clientX - this.drag.startX) / s,
        dy = (e.clientY - this.drag.startY) / s;
      const start = this.drag.startCrop;
      const W = this.working.width,
        H = this.working.height;
      const ratio = this.state.aspect;
      const hgrip = this.drag.handle;
      let x, y, w, h;
      if (hgrip === 'move') {
        w = start.w;
        h = start.h;
        x = Utils.clamp(start.x + dx, 0, W - w);
        y = Utils.clamp(start.y + dy, 0, H - h);
      } else if (!ratio) {
        let nx = start.x,
          ny = start.y,
          nx2 = start.x + start.w,
          ny2 = start.y + start.h;
        if (hgrip.indexOf('w') !== -1) nx = Utils.clamp(start.x + dx, 0, nx2 - 20);
        if (hgrip.indexOf('e') !== -1) nx2 = Utils.clamp(start.x + start.w + dx, nx + 20, W);
        if (hgrip.indexOf('n') !== -1) ny = Utils.clamp(start.y + dy, 0, ny2 - 20);
        if (hgrip.indexOf('s') !== -1) ny2 = Utils.clamp(start.y + start.h + dy, ny + 20, H);
        x = nx;
        y = ny;
        w = nx2 - nx;
        h = ny2 - ny;
      } else if (hgrip === 'n' || hgrip === 's') {
        let ny = start.y,
          ny2 = start.y + start.h;
        if (hgrip === 'n') ny = Utils.clamp(start.y + dy, 0, ny2 - 20);
        else ny2 = Utils.clamp(start.y + start.h + dy, ny + 20, H);
        h = ny2 - ny;
        w = h * ratio;
        if (w > W) {
          w = W;
          h = w / ratio;
        }
        const cx = start.x + start.w / 2;
        x = Utils.clamp(cx - w / 2, 0, W - w);
        y = ny;
      } else if (hgrip === 'e' || hgrip === 'w') {
        let nx = start.x,
          nx2 = start.x + start.w;
        if (hgrip === 'w') nx = Utils.clamp(start.x + dx, 0, nx2 - 20);
        else nx2 = Utils.clamp(start.x + start.w + dx, nx + 20, W);
        w = nx2 - nx;
        h = w / ratio;
        if (h > H) {
          h = H;
          w = h * ratio;
        }
        const cy = start.y + start.h / 2;
        y = Utils.clamp(cy - h / 2, 0, H - h);
        x = nx;
      } else {
        let fx, fy, signX, signY, dsx, dsy;
        if (hgrip === 'nw') {
          fx = start.x + start.w;
          fy = start.y + start.h;
          signX = -1;
          signY = -1;
          dsx = start.x;
          dsy = start.y;
        } else if (hgrip === 'ne') {
          fx = start.x;
          fy = start.y + start.h;
          signX = 1;
          signY = -1;
          dsx = start.x + start.w;
          dsy = start.y;
        } else if (hgrip === 'sw') {
          fx = start.x + start.w;
          fy = start.y;
          signX = -1;
          signY = 1;
          dsx = start.x;
          dsy = start.y + start.h;
        } else {
          fx = start.x;
          fy = start.y;
          signX = 1;
          signY = 1;
          dsx = start.x + start.w;
          dsy = start.y + start.h;
        }
        const mx = dsx + dx;
        let newW = Math.max(20, Math.abs(mx - fx));
        const maxWByX = signX > 0 ? (W - fx) : fx;
        newW = Math.min(newW, Math.max(20, maxWByX));
        let newH = newW / ratio;
        const maxHByY = signY > 0 ? (H - fy) : fy;
        if (newH > maxHByY) {
          newH = Math.max(20, maxHByY);
          newW = newH * ratio;
        }
        const draggedX = fx + signX * newW,
          draggedY = fy + signY * newH;
        x = Math.min(fx, draggedX);
        y = Math.min(fy, draggedY);
        w = newW;
        h = newH;
      }
      this.state.crop = {
        x,
        y,
        w: Math.max(10, w),
        h: Math.max(10, h)
      };
      this.renderCropBox();
    },
    endDrag() {
      this.drag = null;
    },
    async download() {
      if (!this.working) return;
      const c = this.state.crop;
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(c.w));
      out.height = Math.max(1, Math.round(c.h));
      out.getContext('2d').drawImage(this.working, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
      const blob = await Utils.canvasToBlob(out, 'image/png');
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(blob, base + '-recadre.png');
    },
    reset() {
      this.state.data = null;
      this.working = null;
      this.state.rotation = 0;
      this.state.flipH = false;
      this.state.flipV = false;
      this.state.aspect = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.rotateSlider.value = 0;
      this.els.rotateValue.textContent = '0°';
      this.els.image.src = '';
      Array.prototype.slice.call(this.els.aspectRow.querySelectorAll('.aspect-chip')).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.ratio === 'free')));
    }
  };

  const Enhance = {
    state: {
      data: null,
      scale: 2
    },
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('en-dropzone'),
        input: $('en-file-input'),
        stage: $('en-stage'),
        loading: $('en-loading'),
        compare: $('en-compare'),
        before: $('en-preview-before'),
        overlay: $('en-overlay'),
        after: $('en-preview-after'),
        divider: $('en-divider'),
        svgNote: $('en-svg-note'),
        stats: $('en-stats'),
        statBefore: $('en-stat-before'),
        statAfter: $('en-stat-after'),
        statSize: $('en-stat-size'),
        scaleSeg: $('en-scale-seg'),
        sharpSlider: $('en-sharpness-slider'),
        sharpValue: $('en-sharpness-value'),
        denoiseToggle: $('en-denoise-toggle'),
        downloadBtn: $('en-download-btn'),
        resetBtn: $('en-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      Array.prototype.slice.call(this.els.scaleSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.scaleSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.scale = parseFloat(btn.dataset.scale);
          this.process();
        });
      });
      this.els.sharpSlider.addEventListener('input', () => {
        this.els.sharpValue.textContent = this.els.sharpSlider.value + '%';
      });
      this.els.sharpSlider.addEventListener('change', () => this.process());
      this.els.denoiseToggle.addEventListener('change', () => this.process());
      this.setupCompareDrag();
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    setupCompareDrag() {
      let dragging = false;
      const move = (clientX) => {
        const rect = this.els.compare.getBoundingClientRect();
        let pct = ((clientX - rect.left) / rect.width) * 100;
        pct = Utils.clamp(pct, 0, 100);
        this.els.divider.style.left = pct + '%';
        this.els.overlay.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
      };
      this.els.divider.addEventListener('pointerdown', (e) => {
        dragging = true;
        e.preventDefault();
        e.stopPropagation();
      });
      this.els.compare.addEventListener('pointerdown', (e) => {
        dragging = true;
        move(e.clientX);
      });
      window.addEventListener('pointermove', (e) => {
        if (dragging) move(e.clientX);
      });
      window.addEventListener('pointerup', () => {
        dragging = false;
      });
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        if (data.format === 'svg') {
          this.els.svgNote.style.display = 'flex';
          this.els.compare.style.display = 'none';
          this.els.stats.style.display = 'none';
          this.els.downloadBtn.disabled = true;
          return;
        }
        this.els.svgNote.style.display = 'none';
        this.els.compare.style.display = 'block';
        this.els.stats.style.display = 'flex';
        this.els.statBefore.textContent = data.width + ' × ' + data.height;
        this.els.before.src = data.url;
        this.els.divider.style.left = '50%';
        this.els.overlay.style.clipPath = 'inset(0 0 0 50%)';
        await this.process();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async process() {
      const data = this.state.data;
      if (!data || data.format === 'svg') return;
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        const capped = Utils.capDimensions(data.width * this.state.scale, data.height * this.state.scale);
        if (capped.capped) Utils.toast('Agrandissement limité à ~30 mégapixels pour rester fluide dans le navigateur.');
        const newW = capped.width,
          newH = capped.height;
        const srcCanvas = Utils.canvasFrom(data.img, data.width, data.height);
        let srcImgData = srcCanvas.getContext('2d').getImageData(0, 0, data.width, data.height);
        let srcPixels = srcImgData.data;
        if (this.els.denoiseToggle.checked) {
          srcPixels = new Uint8ClampedArray(Engine.boxBlurRGB(srcPixels, data.width, data.height, 1));
        }
        let outData = Engine.resizeLanczos(srcPixels, data.width, data.height, newW, newH);
        const sharpAmount = parseInt(this.els.sharpSlider.value, 10) / 100;
        if (sharpAmount > 0) outData = Engine.unsharpMask(outData, newW, newH, sharpAmount * 1.15, 1);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = newW;
        outCanvas.height = newH;
        outCanvas.getContext('2d').putImageData(new ImageData(outData, newW, newH), 0, 0);
        const mime = Utils.mimeFor(data.format);
        const blob = await Utils.canvasToBlob(outCanvas, mime, 0.92);
        this._resultBlob = blob;
        this._resultExt = Utils.extFor(data.format);
        this.els.after.src = URL.createObjectURL(blob);
        this.els.statAfter.textContent = newW + ' × ' + newH;
        this.els.statSize.textContent = Utils.bytesToSize(blob.size);
        this.els.downloadBtn.disabled = false;
      } catch (e) {
        Utils.toast(e.message || "L'amélioration a échoué.");
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    download() {
      if (!this._resultBlob) return;
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(this._resultBlob, base + '-ameliore.' + this._resultExt);
    },
    reset() {
      this.state.data = null;
      this._resultBlob = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.compare.style.display = 'none';
      this.els.svgNote.style.display = 'none';
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
    }
  };

  const RemoveBG = {
    state: {
      data: null,
      mode: 'auto',
      brushMode: 'erase'
    },
    canvas: null,
    ctx: null,
    _original: null,
    undoSnapshot: null,
    isPainting: false,
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('bg-dropzone'),
        input: $('bg-file-input'),
        stage: $('bg-stage'),
        loading: $('bg-loading'),
        canvas: $('bg-canvas'),
        brushCursor: $('bg-brush-cursor'),
        stats: $('bg-stats'),
        statMode: $('bg-stat-mode'),
        statTol: $('bg-stat-tol'),
        statDims: $('bg-stat-dims'),
        svgNote: $('bg-svg-note'),
        modeSeg: $('bg-mode-seg'),
        modeHint: $('bg-mode-hint'),
        toleranceSlider: $('bg-tolerance-slider'),
        toleranceValue: $('bg-tolerance-value'),
        featherSlider: $('bg-feather-slider'),
        featherValue: $('bg-feather-value'),
        restoreBtn: $('bg-restore-btn'),
        brushSeg: $('bg-brush-seg'),
        brushSize: $('bg-brush-size'),
        brushSizeValue: $('bg-brush-size-value'),
        undoBtn: $('bg-undo-btn'),
        exportFormat: $('bg-export-format'),
        matteRow: $('bg-matte-row'),
        matteColor: $('bg-matte-color'),
        downloadBtn: $('bg-download-btn'),
        resetBtn: $('bg-reset-btn'),
      };
      this.canvas = this.els.canvas;
      this.ctx = this.canvas.getContext('2d', {
        willReadFrequently: true
      });
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.mode = btn.dataset.mode;
          this.els.statMode.textContent = this.state.mode === 'auto' ? 'Auto' : 'Points manuels';
          this.els.modeHint.textContent = this.state.mode === 'auto' ?
            "Détecte le fond depuis les bords de l'image. Ajustez, puis relâchez le curseur." :
            "Cliquez sur une zone de fond dans l'aperçu pour la retirer à partir de ce point.";
        });
      });
      this.els.toleranceSlider.addEventListener('input', () => {
        this.els.toleranceValue.textContent = this.els.toleranceSlider.value;
        this.els.statTol.textContent = this.els.toleranceSlider.value;
      });
      this.els.toleranceSlider.addEventListener('change', () => {
        if (this.state.mode === 'auto') this.runAutoDetect();
      });
      this.els.featherSlider.addEventListener('input', () => {
        this.els.featherValue.textContent = this.els.featherSlider.value;
      });
      this.els.featherSlider.addEventListener('change', () => {
        if (this.state.mode === 'auto') this.runAutoDetect();
      });
      this.els.restoreBtn.addEventListener('click', () => this.restoreOriginal());
      Array.prototype.slice.call(this.els.brushSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.brushSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.brushMode = btn.dataset.brush;
        });
      });
      this.els.brushSize.addEventListener('input', () => {
        this.els.brushSizeValue.textContent = this.els.brushSize.value + ' px';
      });
      this.els.undoBtn.addEventListener('click', () => this.undo());
      this.els.exportFormat.addEventListener('change', () => {
        this.els.matteRow.style.display = this.els.exportFormat.value === 'jpg' ? 'flex' : 'none';
      });
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
      this.setupCanvasPointer();
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        let img = data.img,
          w = data.width,
          h = data.height;
        if (data.isVector) {
          const targetW = Math.max(w, 800);
          const targetH = Math.max(1, Math.round(targetW * (h / w)));
          img = Utils.canvasFrom(img, targetW, targetH);
          w = targetW;
          h = targetH;
          this.els.svgNote.style.display = 'flex';
        } else {
          this.els.svgNote.style.display = 'none';
        }
        this.state.data = Object.assign({}, data, {
          img,
          width: w,
          height: h
        });
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(img, 0, 0, w, h);
        this._original = this.ctx.getImageData(0, 0, w, h);
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.stats.style.display = 'flex';
        this.els.statDims.textContent = w + ' × ' + h;
        this.undoSnapshot = null;
        this.els.undoBtn.disabled = true;
        await Utils.nextFrame();
        await this.runAutoDetect();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    saveUndo() {
      this.undoSnapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.els.undoBtn.disabled = false;
    },
    undo() {
      if (!this.undoSnapshot) return;
      this.ctx.putImageData(this.undoSnapshot, 0, 0);
      this.undoSnapshot = null;
      this.els.undoBtn.disabled = true;
      this.els.downloadBtn.disabled = false;
    },
    restoreOriginal() {
      if (!this._original) return;
      this.saveUndo();
      this.ctx.putImageData(this._original, 0, 0);
      this.els.downloadBtn.disabled = false;
    },
    async runAutoDetect() {
      if (!this.state.data) return;
      this.saveUndo();
      Utils.showLoading(this.els.loading, true);
      await Utils.nextFrame();
      try {
        const w = this.canvas.width,
          h = this.canvas.height;
        this.ctx.putImageData(this._original, 0, 0);
        const imgData = this.ctx.getImageData(0, 0, w, h);
        const tol = parseInt(this.els.toleranceSlider.value, 10);
        const seeds = [];
        for (let x = 0; x < w; x++) {
          seeds.push([x, 0]);
          seeds.push([x, h - 1]);
        }
        for (let y = 0; y < h; y++) {
          seeds.push([0, y]);
          seeds.push([w - 1, y]);
        }
        Engine.floodFillBackground(imgData.data, w, h, tol, seeds);
        const feather = parseInt(this.els.featherSlider.value, 10);
        if (feather > 0) Engine.featherAlpha(imgData.data, w, h, feather);
        this.ctx.putImageData(imgData, 0, 0);
        this.els.downloadBtn.disabled = false;
      } finally {
        Utils.showLoading(this.els.loading, false);
      }
    },
    setupCanvasPointer() {
      const toImageCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width,
          sy = this.canvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * sx,
          y: (e.clientY - rect.top) * sy,
          cssX: e.clientX - rect.left,
          cssY: e.clientY - rect.top,
          cssScale: rect.width / this.canvas.width
        };
      };
      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.state.data) return;
        const p = toImageCoords(e);
        const size = parseInt(this.els.brushSize.value, 10);
        this.els.brushCursor.style.display = 'block';
        this.els.brushCursor.style.width = this.els.brushCursor.style.height = (size * p.cssScale) + 'px';
        this.els.brushCursor.style.left = p.cssX + 'px';
        this.els.brushCursor.style.top = p.cssY + 'px';
        if (this.isPainting) this.paintAt(p.x, p.y);
      });
      this.canvas.addEventListener('pointerleave', () => {
        this.els.brushCursor.style.display = 'none';
      });
      this.canvas.addEventListener('pointerdown', (e) => {
        if (!this.state.data) return;
        const p = toImageCoords(e);
        if (this.state.mode === 'manual') {
          this.saveUndo();
          const w = this.canvas.width,
            h = this.canvas.height;
          const imgData = this.ctx.getImageData(0, 0, w, h);
          Engine.floodFillBackground(imgData.data, w, h, parseInt(this.els.toleranceSlider.value, 10), [
            [Math.round(p.x), Math.round(p.y)]
          ]);
          const feather = parseInt(this.els.featherSlider.value, 10);
          if (feather > 0) Engine.featherAlpha(imgData.data, w, h, feather);
          this.ctx.putImageData(imgData, 0, 0);
          this.els.downloadBtn.disabled = false;
        } else {
          this.isPainting = true;
          this.saveUndo();
          this.paintAt(p.x, p.y);
        }
      });
      window.addEventListener('pointerup', () => {
        this.isPainting = false;
      });
    },
    paintAt(x, y) {
      const w = this.canvas.width,
        h = this.canvas.height;
      const size = parseInt(this.els.brushSize.value, 10);
      const r = size / 2;
      const rx0 = Utils.clamp(Math.floor(x - r - 1), 0, w - 1),
        ry0 = Utils.clamp(Math.floor(y - r - 1), 0, h - 1);
      const rx1 = Utils.clamp(Math.ceil(x + r + 1), 0, w),
        ry1 = Utils.clamp(Math.ceil(y + r + 1), 0, h);
      const rw = Math.max(1, rx1 - rx0),
        rh = Math.max(1, ry1 - ry0);
      const imgData = this.ctx.getImageData(rx0, ry0, rw, rh);
      const erase = this.state.brushMode === 'erase';
      const orig = this._original.data;
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const gx = rx0 + xx,
            gy = ry0 + yy;
          const d = Math.hypot(gx - x, gy - y);
          if (d <= r) {
            const i = (yy * rw + xx) * 4;
            const edge = Math.max(0.6, r - 1.2);
            if (erase) {
              const a = d <= edge ? 0 : Utils.clamp((d - edge) / 1.2, 0, 1) * 255;
              imgData.data[i + 3] = Math.min(imgData.data[i + 3], a);
            } else {
              const gi = (gy * w + gx) * 4;
              const targetA = orig[gi + 3];
              const blend = d <= edge ? 1 : Utils.clamp((r - d) / 1.2, 0, 1);
              imgData.data[i] = orig[gi];
              imgData.data[i + 1] = orig[gi + 1];
              imgData.data[i + 2] = orig[gi + 2];
              imgData.data[i + 3] = Math.max(imgData.data[i + 3], targetA * blend);
            }
          }
        }
      }
      this.ctx.putImageData(imgData, rx0, ry0);
      this.els.downloadBtn.disabled = false;
    },
    async download() {
      if (!this.state.data) return;
      const w = this.canvas.width,
        h = this.canvas.height;
      const format = this.els.exportFormat.value;
      let outCanvas = this.canvas;
      if (format === 'jpg') {
        const flat = document.createElement('canvas');
        flat.width = w;
        flat.height = h;
        const fctx = flat.getContext('2d');
        fctx.fillStyle = this.els.matteColor.value;
        fctx.fillRect(0, 0, w, h);
        fctx.drawImage(this.canvas, 0, 0);
        outCanvas = flat;
      }
      const mime = Utils.mimeFor(format);
      const blob = await Utils.canvasToBlob(outCanvas, mime, format === 'jpg' ? 0.92 : undefined);
      const base = (this.state.data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      Utils.download(blob, base + '-detoure.' + Utils.extForMime(blob.type));
    },
    reset() {
      this.state.data = null;
      this._original = null;
      this.undoSnapshot = null;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.stats.style.display = 'none';
      this.els.downloadBtn.disabled = true;
      this.els.undoBtn.disabled = true;
      this.els.svgNote.style.display = 'none';
      if (this.canvas.width && this.canvas.height) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  const Watermark = {
    state: {
      data: null,
      mode: 'text',
      tile: false,
      posPct: {
        x: 0.5,
        y: 0.5
      }
    },
    PRESETS: {
      tl: {
        x: .12,
        y: .12
      },
      tc: {
        x: .5,
        y: .12
      },
      tr: {
        x: .88,
        y: .12
      },
      cl: {
        x: .12,
        y: .5
      },
      cc: {
        x: .5,
        y: .5
      },
      cr: {
        x: .88,
        y: .5
      },
      bl: {
        x: .12,
        y: .88
      },
      bc: {
        x: .5,
        y: .88
      },
      br: {
        x: .88,
        y: .88
      }
    },
    _logoImg: null,
    _logoDataUrl: null,
    _fontsReady: {},
    els: {},
    init() {
      const $ = id => document.getElementById(id);
      this.els = {
        dropzone: $('wm-dropzone'),
        input: $('wm-file-input'),
        stage: $('wm-stage'),
        loading: $('wm-loading'),
        canvas: $('wm-canvas'),
        textHandle: $('wm-text-handle'),
        svgBadge: $('wm-svg-badge'),
        modeSeg: $('wm-mode-seg'),
        textField: $('wm-text-field'),
        fontField: $('wm-font-field'),
        logoField: $('wm-logo-field'),
        textInput: $('wm-text-input'),
        fontSelect: $('wm-font-select'),
        logoInput: $('wm-logo-input'),
        sizeSlider: $('wm-size-slider'),
        sizeValue: $('wm-size-value'),
        colorField: $('wm-color-field'),
        colorInput: $('wm-color-input'),
        colorHex: $('wm-color-hex'),
        opacitySlider: $('wm-opacity-slider'),
        opacityValue: $('wm-opacity-value'),
        rotationSlider: $('wm-rotation-slider'),
        rotationValue: $('wm-rotation-value'),
        strokeToggle: $('wm-stroke-toggle'),
        shadowToggle: $('wm-shadow-toggle'),
        tileToggle: $('wm-tile-toggle'),
        positionBlock: $('wm-position-block'),
        posGrid: $('wm-pos-grid'),
        densityField: $('wm-density-field'),
        densitySlider: $('wm-density-slider'),
        densityValue: $('wm-density-value'),
        downloadBtn: $('wm-download-btn'),
        resetBtn: $('wm-reset-btn'),
      };
      Utils.setupDropzone(this.els.dropzone, this.els.input, f => this.onFile(f));
      Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.modeSeg.querySelectorAll('button')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.mode = btn.dataset.wmmode;
          this.els.textField.style.display = this.state.mode === 'text' ? 'block' : 'none';
          this.els.fontField.style.display = this.state.mode === 'text' ? 'block' : 'none';
          this.els.colorField.style.display = this.state.mode === 'text' ? 'block' : 'none';
          this.els.logoField.style.display = this.state.mode === 'image' ? 'block' : 'none';
          this.render();
        });
      });
      this.els.textInput.addEventListener('input', Utils.debounce(() => this.render(), 60));
      this.els.fontSelect.addEventListener('change', () => this.render());
      this.els.logoInput.addEventListener('change', () => this.onLogoFile());
      this.els.sizeSlider.addEventListener('input', () => {
        this.els.sizeValue.textContent = this.els.sizeSlider.value + '%';
        this.render();
      });
      this.els.colorInput.addEventListener('input', () => {
        this.els.colorHex.textContent = this.els.colorInput.value.toUpperCase();
        this.render();
      });
      this.els.opacitySlider.addEventListener('input', () => {
        this.els.opacityValue.textContent = this.els.opacitySlider.value + '%';
        this.render();
      });
      this.els.rotationSlider.addEventListener('input', () => {
        this.els.rotationValue.textContent = this.els.rotationSlider.value + '°';
        this.render();
      });
      this.els.strokeToggle.addEventListener('change', () => this.render());
      this.els.shadowToggle.addEventListener('change', () => this.render());
      this.els.tileToggle.addEventListener('change', () => {
        this.state.tile = this.els.tileToggle.checked;
        this.els.positionBlock.style.display = this.state.tile ? 'none' : 'block';
        this.els.densityField.style.display = this.state.tile ? 'block' : 'none';
        this.render();
      });
      this.els.densitySlider.addEventListener('input', () => {
        this.els.densityValue.textContent = this.els.densitySlider.value;
        this.render();
      });
      Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(btn => {
        btn.addEventListener('click', () => {
          Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          this.state.posPct = Object.assign({}, this.PRESETS[btn.dataset.pos]);
          this.render();
        });
      });
      this.setupDragHandle();
      this.els.downloadBtn.addEventListener('click', () => this.download());
      this.els.resetBtn.addEventListener('click', () => this.reset());
    },
    setupDragHandle() {
      let dragging = false;
      this.els.textHandle.addEventListener('pointerdown', (e) => {
        if (this.state.tile) return;
        dragging = true;
        this.els.textHandle.classList.add('is-dragging');
        e.preventDefault();
      });
      window.addEventListener('pointermove', (e) => {
        if (!dragging || !this.state.data) return;
        const rect = this.els.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width,
          py = (e.clientY - rect.top) / rect.height;
        this.state.posPct = {
          x: Utils.clamp(px, 0, 1),
          y: Utils.clamp(py, 0, 1)
        };
        Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(b => b.setAttribute('aria-pressed', 'false'));
        this.render();
      });
      window.addEventListener('pointerup', () => {
        dragging = false;
        this.els.textHandle.classList.remove('is-dragging');
      });
    },
    async onLogoFile() {
      const f = this.els.logoInput.files[0];
      if (!f) return;
      try {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Lecture du logo impossible.'));
          r.readAsDataURL(f);
        });
        this._logoDataUrl = dataUrl;
        this._logoImg = await Utils._loadImgEl(dataUrl);
        this.render();
      } catch (e) {
        Utils.toast(e.message);
      }
    },
    async onFile(file) {
      try {
        const data = await Utils.loadImage(file);
        this.state.data = data;
        this.els.dropzone.style.display = 'none';
        this.els.stage.classList.add('is-active');
        this.els.svgBadge.style.display = data.format === 'svg' ? 'flex' : 'none';
        await this.render();
      } catch (e) {
        Utils.toast(e.message || "Impossible de charger ce fichier.");
      }
    },
    async ensureFontLoaded(fontStack, fontSize) {
      if (this._fontsReady[fontStack]) return;
      if (document.fonts && document.fonts.load) {
        try {
          await document.fonts.load(Math.round(fontSize || 32) + 'px ' + fontStack);
        } catch (e) {}
      }
      this._fontsReady[fontStack] = true;
    },
    drawTextAt(ctx, text, cx, cy, fontSize, fontStack, color, rotationDeg, stroke, shadow) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationDeg * Math.PI / 180);
      ctx.font = '600 ' + fontSize + 'px ' + fontStack;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = fontSize * 0.1;
        ctx.shadowOffsetY = fontSize * 0.035;
      }
      if (stroke) {
        ctx.lineWidth = Math.max(1, fontSize * 0.045);
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText(text, 0, 0);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    },
    drawImageAt(ctx, img, cx, cy, w, h, rotationDeg, shadow) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationDeg * Math.PI / 180);
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = w * 0.05;
        ctx.shadowOffsetY = w * 0.02;
      }
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    },
    async render() {
      const data = this.state.data;
      if (!data) return;
      const canvas = this.els.canvas;
      canvas.width = data.width;
      canvas.height = data.height;
      const ctx = canvas.getContext('2d');

      const opacity = parseInt(this.els.opacitySlider.value, 10) / 100;
      const rotation = parseInt(this.els.rotationSlider.value, 10);
      const sizePct = parseInt(this.els.sizeSlider.value, 10) / 100;
      const stroke = this.els.strokeToggle.checked,
        shadow = this.els.shadowToggle.checked;
      const color = this.els.colorInput.value;
      const text = this.els.textInput.value || '';
      const fontStack = this.els.fontSelect.selectedOptions[0].dataset.stack;
      const fontSize = Math.max(6, data.width * sizePct);
      if (this.state.mode === 'text') await this.ensureFontLoaded(fontStack, fontSize);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(data.img, 0, 0, data.width, data.height);
      ctx.save();
      ctx.globalAlpha = opacity;
      if (this.state.tile) {
        const density = parseInt(this.els.densitySlider.value, 10);
        const stepX = data.width / (density + 1),
          stepY = data.height / (density + 1);
        const margin = Math.max(stepX, stepY);
        for (let gy = -margin; gy < data.height + margin; gy += stepY) {
          for (let gx = -margin; gx < data.width + margin; gx += stepX) {
            if (this.state.mode === 'text') this.drawTextAt(ctx, text, gx, gy, fontSize, fontStack, color, rotation, stroke, false);
            else if (this._logoImg) {
              const lw = data.width * sizePct * 2,
                lh = lw * (this._logoImg.naturalHeight / this._logoImg.naturalWidth);
              this.drawImageAt(ctx, this._logoImg, gx, gy, lw, lh, rotation, false);
            }
          }
        }
      } else {
        const cx = this.state.posPct.x * data.width,
          cy = this.state.posPct.y * data.height;
        if (this.state.mode === 'text') this.drawTextAt(ctx, text, cx, cy, fontSize, fontStack, color, rotation, stroke, shadow);
        else if (this._logoImg) {
          const lw = data.width * sizePct * 2,
            lh = lw * (this._logoImg.naturalHeight / this._logoImg.naturalWidth);
          this.drawImageAt(ctx, this._logoImg, cx, cy, lw, lh, rotation, shadow);
        }
      }
      ctx.restore();
      this.positionHandle();
      this.els.downloadBtn.disabled = false;
    },
    positionHandle() {
      const data = this.state.data;
      if (!data || this.state.tile) {
        this.els.textHandle.style.display = 'none';
        return;
      }
      this.els.textHandle.style.display = 'block';
      const rect = this.els.canvas.getBoundingClientRect();
      const x = this.state.posPct.x * rect.width,
        y = this.state.posPct.y * rect.height;
      const sizePct = parseInt(this.els.sizeSlider.value, 10) / 100;
      const fontSizeCss = data.width * sizePct * (rect.width / data.width || 1);
      const text = this.els.textInput.value || ' ';
      const rotation = parseInt(this.els.rotationSlider.value, 10);
      this.els.textHandle.style.left = x + 'px';
      this.els.textHandle.style.top = y + 'px';
      this.els.textHandle.style.width = Math.max(50, text.length * fontSizeCss * 0.55) + 'px';
      this.els.textHandle.style.height = (fontSizeCss * 1.3) + 'px';
      this.els.textHandle.style.transform = 'translate(-50%,-50%) rotate(' + rotation + 'deg)';
    },
    buildWatermarkedSVG() {
      const data = this.state.data;
      const doc = new DOMParser().parseFromString(data.svgText, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + data.width + ' ' + data.height);
      const vb = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
      const vbX = vb[0],
        vbY = vb[1],
        vbW = vb[2],
        vbH = vb[3];
      const sizePct = parseInt(this.els.sizeSlider.value, 10) / 100;
      const fontSize = vbW * sizePct;
      const color = this.els.colorInput.value;
      const opacity = parseInt(this.els.opacitySlider.value, 10) / 100;
      const rotation = parseInt(this.els.rotationSlider.value, 10);
      const fontStack = this.els.fontSelect.selectedOptions[0].dataset.stack;
      const text = this.els.textInput.value || '';
      const ns = 'http://www.w3.org/2000/svg';
      const g = doc.createElementNS(ns, 'g');
      g.setAttribute('data-atelier-watermark', '1');

      const makeText = (cx, cy) => {
        const t = doc.createElementNS(ns, 'text');
        t.setAttribute('x', cx.toFixed(2));
        t.setAttribute('y', cy.toFixed(2));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-family', fontStack);
        t.setAttribute('font-size', fontSize.toFixed(2));
        t.setAttribute('font-weight', '600');
        t.setAttribute('fill', color);
        t.setAttribute('fill-opacity', opacity.toFixed(2));
        if (rotation) t.setAttribute('transform', 'rotate(' + rotation + ' ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')');
        t.textContent = text;
        return t;
      };
      const makeImage = (cx, cy) => {
        const ratio = this._logoImg ? (this._logoImg.naturalHeight / this._logoImg.naturalWidth) : 1;
        const w = vbW * sizePct * 2,
          h = w * ratio;
        const im = doc.createElementNS(ns, 'image');
        im.setAttribute('x', (cx - w / 2).toFixed(2));
        im.setAttribute('y', (cy - h / 2).toFixed(2));
        im.setAttribute('width', w.toFixed(2));
        im.setAttribute('height', h.toFixed(2));
        im.setAttribute('opacity', opacity.toFixed(2));
        im.setAttribute('href', this._logoDataUrl || '');
        if (rotation) im.setAttribute('transform', 'rotate(' + rotation + ' ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')');
        return im;
      };
      const makeAt = (cx, cy) => this.state.mode === 'text' ? makeText(cx, cy) : makeImage(cx, cy);

      if (this.state.tile) {
        const density = parseInt(this.els.densitySlider.value, 10);
        const stepX = vbW / (density + 1),
          stepY = vbH / (density + 1);
        const margin = Math.max(stepX, stepY);
        for (let gy = vbY - margin; gy < vbY + vbH + margin; gy += stepY)
          for (let gx = vbX - margin; gx < vbX + vbW + margin; gx += stepX)
            g.appendChild(makeAt(gx, gy));
      } else {
        const cx = vbX + this.state.posPct.x * vbW,
          cy = vbY + this.state.posPct.y * vbH;
        g.appendChild(makeAt(cx, cy));
      }
      svg.appendChild(g);
      return new XMLSerializer().serializeToString(svg);
    },
    async download() {
      const data = this.state.data;
      if (!data) return;
      const base = (data.fileName || 'image').replace(/\.[a-z0-9]+$/i, '');
      if (data.format === 'svg') {
        const svgText = this.buildWatermarkedSVG();
        Utils.downloadText(svgText, base + '-filigrane.svg', 'image/svg+xml');
      } else {
        const blob = await Utils.canvasToBlob(this.els.canvas, Utils.mimeFor(data.format), 0.92);
        Utils.download(blob, base + '-filigrane.' + Utils.extFor(data.format));
      }
    },
    reset() {
      this.state.data = null;
      this._logoImg = null;
      this._logoDataUrl = null;
      this.state.posPct = {
        x: .5,
        y: .5
      };
      this.state.tile = false;
      this.els.dropzone.style.display = 'flex';
      this.els.stage.classList.remove('is-active');
      this.els.downloadBtn.disabled = true;
      this.els.svgBadge.style.display = 'none';
      this.els.textHandle.style.display = 'none';
      this.els.tileToggle.checked = false;
      this.els.positionBlock.style.display = 'block';
      this.els.densityField.style.display = 'none';
      Array.prototype.slice.call(this.els.posGrid.querySelectorAll('.pos-btn')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pos === 'cc')));
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    Compress.init();
    Resize.init();
    Convert.init();
    CropRotate.init();
    Enhance.init();
    RemoveBG.init();
    Watermark.init();
  });

})();