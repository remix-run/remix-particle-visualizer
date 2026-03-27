import * as THREE from "three";

const MODEL_TEX_W = 512;
const MODEL_TEX_H = 256;

const VERTEX_SHADER = /* glsl */ `
  attribute float aIndex;
  attribute float aSize;
  attribute float aRandom;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vViewDist;
  varying float vIntro;
  varying float vPulse;
  varying float vCoc;

  uniform float uPointSize;
  uniform float uPixelRatio;
  uniform float uIntroProgress;
  uniform float uDofAmount;
  uniform float uDofFocus;
  uniform float uTime;
  uniform float uCount;
  uniform float uPresetA;
  uniform float uPresetB;
  uniform float uBlend;
  uniform float uSeparation;
  uniform vec2 uMousePos;
  uniform float uCursorRepulsion;
  uniform float uMorphEase;
  uniform float uCtrlA[8];
  uniform float uCtrlB[8];
  uniform float uModelCount0;
  uniform float uModelCount1;
  uniform sampler2D uModelTex0;
  uniform sampler2D uModelTex1;

  /* ── helpers ───────────────────────────────────────────── */

  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float hp = h * 6.0;
    float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
    float m = l - c * 0.5;
    vec3 rgb;
    if      (hp < 1.0) rgb = vec3(c, x, 0.0);
    else if (hp < 2.0) rgb = vec3(x, c, 0.0);
    else if (hp < 3.0) rgb = vec3(0.0, c, x);
    else if (hp < 4.0) rgb = vec3(0.0, x, c);
    else if (hp < 5.0) rgb = vec3(x, 0.0, c);
    else               rgb = vec3(c, 0.0, x);
    return rgb + m;
  }

  float grHash(float fi, float k) {
    float hi = floor(fi * 0.0078125);
    float lo = fi - hi * 128.0;
    return fract(fract(hi * fract(128.0 * k)) + fract(lo * k));
  }

  vec3 sampleModel(int slot, float fi) {
    float cnt = (slot == 0) ? uModelCount0 : uModelCount1;
    float idx = (cnt > 0.0) ? mod(fi, cnt) : 0.0;
    float u = (mod(idx, ${MODEL_TEX_W}.0) + 0.5) / ${MODEL_TEX_W}.0;
    float v = (floor(idx / ${MODEL_TEX_W}.0) + 0.5) / ${MODEL_TEX_H}.0;
    vec2 uv = vec2(u, v);
    if (slot == 0) return texture2D(uModelTex0, uv).xyz;
    else           return texture2D(uModelTex1, uv).xyz;
  }

  /* ── preset 0: Remix Logo ─────────────────────────────── */

  void presetRemixLogo(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float scale = c0;
    float rX = c1 * 0.01745329;
    float rY = c2 * 0.01745329;
    float rZ = c3 * 0.01745329;

    vec3 mp = sampleModel(0, fi);
    float px = mp.x * scale;
    float py = mp.y * scale;
    float pz = mp.z * scale;

    float cx = cos(rX), sx = sin(rX);
    float t1y = py * cx - pz * sx;
    float t1z = py * sx + pz * cx;
    py = t1y; pz = t1z;

    float cy = cos(rY), sy = sin(rY);
    float t2x = px * cy + pz * sy;
    float t2z = -px * sy + pz * cy;
    px = t2x; pz = t2z;

    float cz = cos(rZ), sz = sin(rZ);
    float t3x = px * cz - py * sz;
    float t3y = px * sz + py * cz;
    px = t3x; py = t3y;

    pos = vec3(px, py, pz);

    float t = fi / float(cnt);
    float l = 0.5 + 0.3 * sin(t * 6.28 + time * 0.5);
    col = vec3(l);
  }

  /* ── preset 1: Racecar ────────────────────────────────── */

  void presetRacecar(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float scale = c0;
    float spin = c1;
    float shimmer = c2;

    float angle = time * spin;
    float cosA = cos(angle), sinA = sin(angle);

    vec3 mp = sampleModel(1, fi);
    float mx = mp.x * scale;
    float my = mp.y * scale;
    float mz = mp.z * scale;

    pos = vec3(mx * cosA - mz * sinA, my, mx * sinA + mz * cosA);

    float front = mp.z * 0.6 + mp.y * 0.4;
    float norm = front * 4.0 + 0.5;
    float bright = clamp(norm, 0.0, 1.0);
    float pulse = 1.0 + shimmer * 0.08 * sin(time * 3.0 + fi * 0.03);
    float lum = (0.12 + bright * 0.55) * pulse;
    col = vec3(
      min(0.0, 1.0),
      min(0.50 * lum + 0.08, 1.0),
      min(0.24 * lum, 1.0)
    );
  }

  /* ── preset 2: Racetrack ──────────────────────────────── */

  void presetRacetrack(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float speed = c0;
    float trackW = c1;
    float curveAmp = c2;
    float hillH = c3;
    float fogMode = c4;

    float zNear = 72.0;
    float zFar  = -100.0;
    float trackY = -24.0;
    float PI = 3.14159265;
    float hillWidth = 50.0;
    float fcnt = float(cnt);

    int surfaceEnd   = int(floor(fcnt * 0.30));
    int leftCurbEnd  = surfaceEnd + int(floor(fcnt * 0.05));
    int rightCurbEnd = leftCurbEnd + int(floor(fcnt * 0.05));
    int leftHillEnd  = rightCurbEnd + int(floor(fcnt * 0.30));
    int idx = int(fi);

    if (idx < surfaceEnd) {
      float along = fract(grHash(fi, 0.6180339887) - time * speed * 0.12);
      float across = grHash(fi, 0.7071067812);
      float z = zNear + (zFar - zNear) * along * along;
      float cx = sin(along * PI * 3.0) * curveAmp
               + sin(along * PI * 5.5 + 2.0) * curveAmp * 0.3;
      float perspN = 1.0 - along * 0.5;
      float lane = (across - 0.5) * trackW * perspN;
      pos = vec3(cx + lane + sin(fi * 7.37) * 0.2, trackY, z);
      float tarmac = 0.06 + 0.03 * sin(fi * 3.77 + along * 20.0);
      col = vec3(tarmac);
      if (fogMode < 0.5) col *= (1.0 - along);

    } else if (idx < leftCurbEnd) {
      float bi = float(idx - surfaceEnd);
      float bt = fract(grHash(bi, 0.6180339887) - time * speed * 0.12);
      float bz = zNear + (zFar - zNear) * bt * bt;
      float bcx = sin(bt * PI * 3.0) * curveAmp
                + sin(bt * PI * 5.5 + 2.0) * curveAmp * 0.3;
      float bN = 1.0 - bt * 0.5;
      float strip = mod(bi, 8.0) / 8.0 * 1.5;
      pos = vec3(bcx - trackW * 0.5 * bN - strip, trackY, bz);
      col = (mod(floor(bt * 35.0), 2.0) < 0.5)
        ? hsl2rgb(0.0, 0.85, 0.45) : vec3(0.85);
      if (fogMode < 0.5) col *= (1.0 - bt);

    } else if (idx < rightCurbEnd) {
      float bi = float(idx - leftCurbEnd);
      float bt = fract(grHash(bi, 0.6180339887) - time * speed * 0.12);
      float bz = zNear + (zFar - zNear) * bt * bt;
      float bcx = sin(bt * PI * 3.0) * curveAmp
                + sin(bt * PI * 5.5 + 2.0) * curveAmp * 0.3;
      float bN = 1.0 - bt * 0.5;
      float strip = mod(bi, 8.0) / 8.0 * 1.5;
      pos = vec3(bcx + trackW * 0.5 * bN + strip, trackY, bz);
      col = (mod(floor(bt * 35.0), 2.0) < 0.5)
        ? hsl2rgb(0.0, 0.85, 0.45) : vec3(0.85);
      if (fogMode < 0.5) col *= (1.0 - bt);

    } else if (idx < leftHillEnd) {
      float hi = float(idx - rightCurbEnd);
      float ht = fract(grHash(hi, 0.6180339887) - time * speed * 0.12);
      float hz = zNear + (zFar - zNear) * ht * ht;
      float hcx = sin(ht * PI * 3.0) * curveAmp
                + sin(ht * PI * 5.5 + 2.0) * curveAmp * 0.3;
      float hN = 1.0 - ht * 0.5;
      float lat = grHash(hi, 0.7071067812);
      float xOff = (trackW * 0.5 + 1.5 + lat * hillWidth) * hN;
      float nx = lat * 3.5;
      float nz = ht * 8.0;
      float ridge = sin(nz * 1.1 + nx * 0.7) * 0.5 + 0.5;
      float broad = sin(nz * 0.4 + nx * 1.3 + 2.0) * 0.5 + 0.5;
      float fine  = sin(nz * 3.7 + nx * 2.1 + 5.0) * 0.3;
      float slope = lat * 0.4 + 0.1;
      float nearCurb = 1.0 - exp(-lat * 6.0);
      float elev = (ridge * 0.5 + broad * 0.35 + fine * 0.15 + slope) * hillH * nearCurb;
      pos = vec3(hcx - xOff, trackY + elev, hz);
      float eN = min(elev / hillH, 1.0);
      col = hsl2rgb(0.30 - eN * 0.06, 0.75 - eN * 0.35, 0.08 + eN * 0.14 + 0.03 * sin(hi * 1.73));
      if (fogMode < 0.5) col *= (1.0 - ht);

    } else {
      float hi = float(idx - leftHillEnd);
      float ht = fract(grHash(hi, 0.6180339887) - time * speed * 0.12);
      float hz = zNear + (zFar - zNear) * ht * ht;
      float hcx = sin(ht * PI * 3.0) * curveAmp
                + sin(ht * PI * 5.5 + 2.0) * curveAmp * 0.3;
      float hN = 1.0 - ht * 0.5;
      float lat = grHash(hi, 0.7071067812);
      float xOff = (trackW * 0.5 + 1.5 + lat * hillWidth) * hN;
      float nx = lat * 3.5;
      float nz = ht * 8.0;
      float ridge = sin(nz * 1.1 + nx * 0.7 + 1.5) * 0.5 + 0.5;
      float broad = sin(nz * 0.4 + nx * 1.3 + 4.0) * 0.5 + 0.5;
      float fine  = sin(nz * 3.7 + nx * 2.1 + 8.0) * 0.3;
      float slope = lat * 0.4 + 0.1;
      float nearCurb = 1.0 - exp(-lat * 6.0);
      float elev = (ridge * 0.5 + broad * 0.35 + fine * 0.15 + slope) * hillH * nearCurb;
      pos = vec3(hcx + xOff, trackY + elev, hz);
      float eN = min(elev / hillH, 1.0);
      col = hsl2rgb(0.30 - eN * 0.06, 0.75 - eN * 0.35, 0.08 + eN * 0.14 + 0.03 * sin(hi * 1.73));
      if (fogMode < 0.5) col *= (1.0 - ht);
    }
  }

  /* ── preset 3: Spiral Galaxy ──────────────────────────── */

  void presetGalaxy(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float armsF = floor(c0 + 0.5);
    float tightness = c1;
    float rotSpeed = c2;
    float diskH = c3;

    float arm = mod(fi, armsF);
    float posInArm = floor(fi / armsF) / floor(float(cnt) / armsF);

    float baseAngle = (arm / armsF) * 6.28318530;
    float r = 2.0 + posInArm * 45.0;
    float spiral = baseAngle + log(1.0 + r * 0.1) * tightness * 4.0;
    float angle = spiral + time * rotSpeed / (1.0 + r * 0.02);

    float scatter = (1.0 - exp(-posInArm * 3.0)) * 3.0;
    float js = fi * 1.3717;
    float jx = sin(js) * scatter;
    float jz = cos(js * 1.73) * scatter;
    float jy = sin(js * 2.37) * diskH * (1.0 - posInArm * 0.3) * exp(-posInArm * 1.5);

    pos = vec3(cos(angle) * r + jx, jy, sin(angle) * r + jz);

    float coreGlow = exp(-r * 0.08);
    float h = 0.08 * coreGlow + 0.6 * (1.0 - coreGlow);
    float s = 0.5 + 0.4 * (1.0 - coreGlow);
    float l = 0.3 + 0.5 * coreGlow + 0.1 * sin(posInArm * 20.0 + arm);
    col = hsl2rgb(h, s, min(l, 1.0));
  }

  /* ── preset 4: 4D Tesseract ───────────────────────────── */

  vec4 tessVert(int idx) {
    float fi = float(idx);
    return vec4(
      mod(fi, 2.0) * 2.0 - 1.0,
      mod(floor(fi / 2.0), 2.0) * 2.0 - 1.0,
      mod(floor(fi / 4.0), 2.0) * 2.0 - 1.0,
      floor(fi / 8.0) * 2.0 - 1.0
    );
  }

  void tessEdge(int eIdx, out vec4 vA, out vec4 vB) {
    int dim = eIdx / 8;
    int sub = eIdx - dim * 8;
    int idxA, idxB;
    if (dim == 0) {
      idxA = sub * 2;
      idxB = idxA + 1;
    } else if (dim == 1) {
      int lo = sub - (sub / 2) * 2;
      int hi = sub / 2;
      idxA = lo + hi * 4;
      idxB = idxA + 2;
    } else if (dim == 2) {
      int lo = sub - (sub / 4) * 4;
      int hi = sub / 4;
      idxA = lo + hi * 8;
      idxB = idxA + 4;
    } else {
      idxA = sub;
      idxB = sub + 8;
    }
    vA = tessVert(idxA);
    vB = tessVert(idxB);
  }

  void presetTesseract(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float speedXW = c0;
    float speedYZ = c1;
    float projDist = c2;
    float edgeDens = c3;

    float ppef = max(float(cnt) / 32.0, 1.0);
    int eIdx = int(min(fi / ppef, 31.0));
    float t = mod(fi, ppef) / ppef;

    vec4 vA, vB;
    tessEdge(eIdx, vA, vB);

    float noise = sin(fi * 7.37) * 0.1 * edgeDens;
    float px = vA.x + (vB.x - vA.x) * t + noise;
    float py = vA.y + (vB.y - vA.y) * t + cos(fi * 3.91) * 0.1 * edgeDens;
    float pz = vA.z + (vB.z - vA.z) * t + sin(fi * 5.13) * 0.1 * edgeDens;
    float pw = vA.w + (vB.w - vA.w) * t + cos(fi * 2.17) * 0.1 * edgeDens;

    float axw = time * speedXW;
    float cXW = cos(axw), sXW = sin(axw);
    float rx = px * cXW - pw * sXW;
    float rw = px * sXW + pw * cXW;

    float ayz = time * speedYZ;
    float cYZ = cos(ayz), sYZ = sin(ayz);
    float ry = py * cYZ - pz * sYZ;
    float rz = py * sYZ + pz * cYZ;

    float sc = projDist / (projDist - rw);
    pos = vec3(rx * sc * 20.0, ry * sc * 20.0, rz * sc * 20.0);

    float h = (float(eIdx) / 32.0) * 0.8 + 0.1;
    float l = 0.4 + 0.3 * sc + 0.1 * sin(time + float(eIdx));
    col = hsl2rgb(h, 0.7, clamp(l, 0.2, 1.0));
  }

  /* ── dispatch ─────────────────────────────────────────── */

  void computePreset(int id, float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    if      (id == 0) presetRacetrack (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else if (id == 1) presetRacecar   (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else if (id == 2) presetRemixLogo (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else if (id == 3) presetGalaxy    (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else              presetTesseract (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
  }

  /* ── main ─────────────────────────────────────────────── */

  void main() {
    float fi = aIndex;
    int i = int(fi);
    int cnt = int(uCount);

    vec3 posA, colA;
    computePreset(int(uPresetA), fi, cnt, uTime,
      uCtrlA[0], uCtrlA[1], uCtrlA[2], uCtrlA[3],
      uCtrlA[4], uCtrlA[5], uCtrlA[6], uCtrlA[7],
      posA, colA);

    vec3 finalPos, finalCol;
    if (uBlend > 0.001) {
      vec3 posB, colB;
      computePreset(int(uPresetB), fi, cnt, uTime,
        uCtrlB[0], uCtrlB[1], uCtrlB[2], uCtrlB[3],
        uCtrlB[4], uCtrlB[5], uCtrlB[6], uCtrlB[7],
        posB, colB);
      float tk = pow(uBlend, uMorphEase);
      float t = tk / (tk + pow(1.0 - uBlend, uMorphEase));
      finalPos = mix(posA, posB, t);
      finalCol = mix(colA, colB, t);
    } else {
      finalPos = posA;
      finalCol = colA;
    }

    float h = fi * 2.3999;
    finalPos.x += sin(h) * uSeparation;
    finalPos.y += cos(h * 1.731) * uSeparation;
    finalPos.z += sin(h * 2.419) * uSeparation;

    if (uCursorRepulsion > 0.0) {
      vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
      vec2 ndc = clipPos.xy / clipPos.w;
      vec2 diff = ndc - uMousePos;
      float d2 = dot(diff, diff);
      float radius = 0.15;
      float falloff = exp(-d2 / (radius * radius));
      vec2 push = normalize(diff + vec2(0.0001)) * falloff * uCursorRepulsion * 8.0;
      vec4 invMV = inverse(modelViewMatrix) * vec4(push, 0.0, 0.0);
      finalPos += invMV.xyz;
    }

    vColor = finalCol;

    float delay = aRandom * 0.7;
    float fallDuration = 0.5;
    float local = clamp((uIntroProgress - delay) / fallDuration, 0.0, 1.0);
    float inv = 1.0 - local;
    float easedLocal = 1.0 - inv * inv * inv;
    float landTime = delay + fallDuration;
    float sinceL = max(uIntroProgress - landTime, 0.0);
    vPulse = (local >= 1.0) ? exp(-sinceL * 8.0) : 0.0;

    float landed = step(1.0, local);
    float opacityRamp = 1.0 - exp(-sinceL * 3.0);
    vIntro = mix(easedLocal * 0.5, 0.5 + 0.5 * opacityRamp, landed);

    float introOffset = (1.0 - easedLocal) * (10.0 + aRandom * 6.0);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos + vec3(0.0, introOffset, 0.0), 1.0);
    float dist = -mvPosition.z;
    vViewDist = dist;

    float baseSize = aSize * uPointSize * uPixelRatio * (300.0 / dist);
    float coc = uDofAmount > 0.0
      ? abs(dist - uDofFocus) * uDofAmount * 0.01
      : 0.0;
    vCoc = clamp(coc, 0.0, 1.0);

    gl_PointSize = clamp(baseSize + coc * 12.0, 1.0, 128.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = smoothstep(500.0, 50.0, dist);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vViewDist;
  varying float vIntro;
  varying float vPulse;
  varying float vCoc;
  uniform float uFogEnabled;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uHdrIntensity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float sharpness = mix(10.0, 2.0, vCoc);
    float glow = exp(-d * sharpness);
    float core = smoothstep(0.5, 0.2 + vCoc * 0.3, d);
    float alpha = (glow * 0.3 + core * 0.7) * vAlpha * vIntro;
    alpha *= mix(1.0, 0.35, vCoc);

    vec3 col = vColor * (0.8 + core * 0.4) * (1.0 + vPulse * 9.0);

    if (uFogEnabled > 0.0) {
      float fogFactor = smoothstep(uFogNear, uFogFar, vViewDist) * uFogEnabled;
      col *= 1.0 - fogFactor;
      alpha *= 1.0 - fogFactor;
    }

    col *= uHdrIntensity;

    gl_FragColor = vec4(col, alpha);
  }
`;

export class ParticleSystem {
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private count = 0;

  init(scene: THREE.Scene, count: number, pointSize: number) {
    this.dispose(scene);
    this.count = count;

    const positions = new Float32Array(count * 3);
    const indices = new Float32Array(count);
    const sizes = new Float32Array(count);
    const randoms = new Float32Array(count);
    sizes.fill(1.0);
    for (let i = 0; i < count; i++) {
      indices[i] = i;
      randoms[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("aIndex", new THREE.BufferAttribute(indices, 1));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPointSize: { value: pointSize },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIntroProgress: { value: 0.0 },
        uFogEnabled: { value: 0.0 },
        uFogNear: { value: 10.0 },
        uFogFar: { value: 180.0 },
        uHdrIntensity: { value: 1.0 },
        uDofAmount: { value: 0.0 },
        uDofFocus: { value: 80.0 },
        uTime: { value: 0.0 },
        uCount: { value: count },
        uPresetA: { value: 0 },
        uPresetB: { value: 0 },
        uBlend: { value: 0.0 },
        uSeparation: { value: 0.0 },
        uMousePos: { value: [0, 0] },
        uCursorRepulsion: { value: 0 },
        uMorphEase: { value: 2.0 },
        uCtrlA: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
        uCtrlB: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
        uModelCount0: { value: 0 },
        uModelCount1: { value: 0 },
        uModelTex0: { value: new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType) },
        uModelTex1: { value: new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setPointSize(size: number) {
    if (this.material) this.material.uniforms.uPointSize.value = size;
  }

  setIntroProgress(value: number) {
    if (this.material) this.material.uniforms.uIntroProgress.value = value;
  }

  setFog(intensity: number, near: number, far: number) {
    if (this.material) {
      this.material.uniforms.uFogEnabled.value = intensity;
      this.material.uniforms.uFogNear.value = near;
      this.material.uniforms.uFogFar.value = far;
    }
  }

  setHdrIntensity(value: number) {
    if (this.material) this.material.uniforms.uHdrIntensity.value = value;
  }

  setDof(amount: number, focus: number) {
    if (this.material) {
      this.material.uniforms.uDofAmount.value = amount;
      this.material.uniforms.uDofFocus.value = focus;
    }
  }

  setPresets(presetA: number, presetB: number, blend: number) {
    if (!this.material) return;
    this.material.uniforms.uPresetA.value = presetA;
    this.material.uniforms.uPresetB.value = presetB;
    this.material.uniforms.uBlend.value = blend;
  }

  setTime(time: number) {
    if (this.material) this.material.uniforms.uTime.value = time;
  }

  setSeparation(value: number) {
    if (this.material) this.material.uniforms.uSeparation.value = value;
  }

  setMousePos(x: number, y: number) {
    if (this.material) {
      const v = this.material.uniforms.uMousePos.value as number[];
      v[0] = x;
      v[1] = y;
    }
  }

  setCursorRepulsion(value: number) {
    if (this.material) this.material.uniforms.uCursorRepulsion.value = value;
  }

  setMorphEase(value: number) {
    if (this.material) this.material.uniforms.uMorphEase.value = value;
  }

  setControls(ctrlA: number[], ctrlB: number[]) {
    if (!this.material) return;
    const a = this.material.uniforms.uCtrlA.value as number[];
    const b = this.material.uniforms.uCtrlB.value as number[];
    for (let j = 0; j < 8; j++) {
      a[j] = ctrlA[j] ?? 0;
      b[j] = ctrlB[j] ?? 0;
    }
  }

  setModelTexture(slot: number, texture: THREE.DataTexture, pointCount: number) {
    if (!this.material) return;
    if (slot === 0) {
      this.material.uniforms.uModelTex0.value = texture;
      this.material.uniforms.uModelCount0.value = pointCount;
    } else {
      this.material.uniforms.uModelTex1.value = texture;
      this.material.uniforms.uModelCount1.value = pointCount;
    }
  }

  dispose(scene?: THREE.Scene) {
    if (this.points && scene) scene.remove(this.points);
    this.geometry?.dispose();
    this.material?.dispose();
    this.points = null;
    this.geometry = null;
    this.material = null;
  }
}
