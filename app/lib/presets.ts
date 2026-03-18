import type { Preset } from "./types";

const racecar: Preset = {
  name: "Racecar",
  modelUrl: "/models/racecar.pts",
  code: `
addControl("_separation", "Particle Distance", 0, 1, 0);
const scale = addControl("scale", "Scale", 5, 150, 80);
const spin = addControl("spin", "Spin Speed", 0, 1.0, 0.2);
const shimmer = addControl("shimmer", "Shimmer", 0, 2.0, 0.6);

const angle = time * spin;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

const idx = i * 3;
const mx = modelPositions[idx] * scale;
const my = modelPositions[idx + 1] * scale;
const mz = modelPositions[idx + 2] * scale;

target.set(mx * cosA - mz * sinA, my, mx * sinA + mz * cosA);

const rawZ = modelPositions[idx + 2];
const rawY = modelPositions[idx + 1];
const front = rawZ * 0.6 + rawY * 0.4;
const norm = front * 4.0 + 0.5;
const bright = Math.max(0.0, Math.min(1.0, norm));
const pulse = 1.0 + shimmer * 0.08 * Math.sin(time * 3.0 + i * 0.03);
const lum = (0.12 + bright * 0.55) * pulse;
color.setRGB(
  Math.min(0.0 * lum, 1.0),
  Math.min(0.50 * lum + 0.08, 1.0),
  Math.min(0.24 * lum, 1.0)
);

if (i === 0) {
  setInfo("Racecar", "Ligier JS P325 LMP3 prototype racer");
}
`.trim(),
};

const racetrack: Preset = {
  name: "Racetrack",
  cameraPosition: [-0.80, -18.60, 81.40],
  cameraTarget: [0, -4.20, -30],
  code: `
const fogMode = addControl("_fogMode", "Fog: Color / Scene", 0, 1, 1);
addControl("_separation", "Particle Distance", 0, 1, 0);

const speed = addControl("speed", "Speed", 0.1, 2.0, 0.2);
const trackW = addControl("trackW", "Track Width", 5, 60, 40);
const curveAmp = addControl("curve", "Curve Intensity", 0, 25, 10.25);
const hillH = addControl("hillH", "Hill Height", 5, 40, 7.8);

addControl("_camPosX", "Camera X", -80, 80, -0.80);
addControl("_camPosY", "Camera Y", -60, 60, -18.60);
addControl("_camPosZ", "Camera Z", 10, 150, 81.40);
addControl("_camTgtX", "Look-at X", -80, 80, 0);
addControl("_camTgtY", "Look-at Y", -60, 60, -4.20);
addControl("_camTgtZ", "Look-at Z", -120, 60, -30);

const zNear = 72;
const zFar = -100;
const trackY = -24;

const surfaceEnd = Math.floor(count * 0.30);
const leftCurbEnd = surfaceEnd + Math.floor(count * 0.05);
const rightCurbEnd = leftCurbEnd + Math.floor(count * 0.05);
const leftHillEnd = rightCurbEnd + Math.floor(count * 0.30);

const phi = 1.6180339887;
const hillWidth = 50;

if (i < surfaceEnd) {
  const along = (((i * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const across = (i * 0.7071067812) % 1.0;
  const t2 = along * along;
  const z = zNear + (zFar - zNear) * t2;
  const cx = Math.sin(along * Math.PI * 3) * curveAmp
           + Math.sin(along * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const perspNarrow = 1.0 - along * 0.5;
  const lane = (across - 0.5) * trackW * perspNarrow;
  const jx = Math.sin(i * 7.37) * 0.2;
  target.set(cx + lane + jx, trackY, z);

  const tarmac = 0.06 + 0.03 * Math.sin(i * 3.77 + along * 20);
  color.setHSL(0, 0, tarmac);
  if (fogMode < 0.5) {
    const fog = 1.0 - along;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < leftCurbEnd) {
  const bi = i - surfaceEnd;
  const bt = (((bi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const bt2 = bt * bt;
  const bz = zNear + (zFar - zNear) * bt2;
  const bcx = Math.sin(bt * Math.PI * 3) * curveAmp
            + Math.sin(bt * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const bNarrow = 1.0 - bt * 0.5;
  const stripOff = (bi % 8) / 8 * 1.5;
  target.set(bcx - trackW * 0.5 * bNarrow - stripOff, trackY, bz);

  const isRed = Math.floor(bt * 35) % 2 === 0;
  if (isRed) color.setHSL(0, 0.85, 0.45);
  else color.setHSL(0, 0, 0.85);
  if (fogMode < 0.5) {
    const fog = 1.0 - bt;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < rightCurbEnd) {
  const bi = i - leftCurbEnd;
  const bt = (((bi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const bt2 = bt * bt;
  const bz = zNear + (zFar - zNear) * bt2;
  const bcx = Math.sin(bt * Math.PI * 3) * curveAmp
            + Math.sin(bt * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const bNarrow = 1.0 - bt * 0.5;
  const stripOff = (bi % 8) / 8 * 1.5;
  target.set(bcx + trackW * 0.5 * bNarrow + stripOff, trackY, bz);

  const isRed = Math.floor(bt * 35) % 2 === 0;
  if (isRed) color.setHSL(0, 0.85, 0.45);
  else color.setHSL(0, 0, 0.85);
  if (fogMode < 0.5) {
    const fog = 1.0 - bt;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < leftHillEnd) {
  const hi = i - rightCurbEnd;
  const ht = (((hi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const ht2 = ht * ht;
  const hz = zNear + (zFar - zNear) * ht2;
  const hcx = Math.sin(ht * Math.PI * 3) * curveAmp
            + Math.sin(ht * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const hNarrow = 1.0 - ht * 0.5;

  const lat = (hi * 0.7071067812) % 1.0;
  const xOff = (trackW * 0.5 + 1.5 + lat * hillWidth) * hNarrow;

  const nx = lat * 3.5;
  const nz = ht * 8.0;
  const ridge = Math.sin(nz * 1.1 + nx * 0.7) * 0.5 + 0.5;
  const broad = Math.sin(nz * 0.4 + nx * 1.3 + 2.0) * 0.5 + 0.5;
  const fine = Math.sin(nz * 3.7 + nx * 2.1 + 5.0) * 0.3;
  const slope = lat * 0.4 + 0.1;
  const nearCurb = 1.0 - Math.exp(-lat * 6.0);
  const elev = (ridge * 0.5 + broad * 0.35 + fine * 0.15 + slope) * hillH * nearCurb;

  target.set(hcx - xOff, trackY + elev, hz);

  const elevNorm = Math.min(elev / hillH, 1.0);
  const hue = 0.30 - elevNorm * 0.06;
  const sat = 0.75 - elevNorm * 0.35;
  const lit = 0.08 + elevNorm * 0.14 + 0.03 * Math.sin(hi * 1.73);
  color.setHSL(hue, sat, lit);
  if (fogMode < 0.5) {
    const fog = 1.0 - ht;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else {
  const hi = i - leftHillEnd;
  const ht = (((hi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const ht2 = ht * ht;
  const hz = zNear + (zFar - zNear) * ht2;
  const hcx = Math.sin(ht * Math.PI * 3) * curveAmp
            + Math.sin(ht * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const hNarrow = 1.0 - ht * 0.5;

  const lat = (hi * 0.7071067812) % 1.0;
  const xOff = (trackW * 0.5 + 1.5 + lat * hillWidth) * hNarrow;

  const nx = lat * 3.5;
  const nz = ht * 8.0;
  const ridge = Math.sin(nz * 1.1 + nx * 0.7 + 1.5) * 0.5 + 0.5;
  const broad = Math.sin(nz * 0.4 + nx * 1.3 + 4.0) * 0.5 + 0.5;
  const fine = Math.sin(nz * 3.7 + nx * 2.1 + 8.0) * 0.3;
  const slope = lat * 0.4 + 0.1;
  const nearCurb = 1.0 - Math.exp(-lat * 6.0);
  const elev = (ridge * 0.5 + broad * 0.35 + fine * 0.15 + slope) * hillH * nearCurb;

  target.set(hcx + xOff, trackY + elev, hz);

  const elevNorm = Math.min(elev / hillH, 1.0);
  const hue = 0.30 - elevNorm * 0.06;
  const sat = 0.75 - elevNorm * 0.35;
  const lit = 0.08 + elevNorm * 0.14 + 0.03 * Math.sin(hi * 1.73);
  color.setHSL(hue, sat, lit);
  if (fogMode < 0.5) {
    const fog = 1.0 - ht;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }
}

if (i === 0) {
  setInfo("Racetrack", "A mountain circuit streaming past at speed");
}
`.trim(),
};

const galaxy: Preset = {
  name: "Spiral Galaxy",
  code: `
addControl("_separation", "Particle Distance", 0, 1, 1);
const arms = addControl("arms", "Spiral Arms", 2, 8, 8);
const tightness = addControl("tight", "Tightness", 0.2, 2.0, 1.8);
const rotSpeed = addControl("rot", "Rotation Speed", 0.05, 1.0, 0.2);
const diskH = addControl("disk", "Disk Height", 0.5, 8, 6);

const ratio = i / count;
const arm = i % Math.round(arms);
const posInArm = Math.floor(i / Math.round(arms)) / Math.floor(count / Math.round(arms));

const baseAngle = (arm / Math.round(arms)) * Math.PI * 2;
const r = 2 + posInArm * 45;
const spiral = baseAngle + Math.log(1 + r * 0.1) * tightness * 4;
const angle = spiral + time * rotSpeed * (1.0 / (1 + r * 0.02));

const scatter = (1.0 - Math.exp(-posInArm * 3)) * 3;
const jitterSeed = i * 1.3717;
const jx = Math.sin(jitterSeed) * scatter;
const jz = Math.cos(jitterSeed * 1.73) * scatter;
const jy = Math.sin(jitterSeed * 2.37) * diskH * (1 - posInArm * 0.3) * Math.exp(-posInArm * 1.5);

target.set(
  Math.cos(angle) * r + jx,
  jy,
  Math.sin(angle) * r + jz
);

const coreGlow = Math.exp(-r * 0.08);
const h = 0.08 * coreGlow + 0.6 * (1 - coreGlow);
const s = 0.5 + 0.4 * (1 - coreGlow);
const l = 0.3 + 0.5 * coreGlow + 0.1 * Math.sin(posInArm * 20 + arm);
color.setHSL(h, s, Math.min(l, 1.0));

if (i === 0) {
  setInfo("Spiral Galaxy", Math.round(arms) + "-arm galaxy spinning through the void");
  annotate("core", new THREE.Vector3(0, 0, 0), "Galactic Core");
}
`.trim(),
};

const tesseract: Preset = {
  name: "4D Tesseract",
  code: `
addControl("_separation", "Particle Distance", 0, 1, 0.2);
const speedXW = addControl("sxw", "Rotation XW", 0.1, 2.0, 0.5);
const speedYZ = addControl("syz", "Rotation YZ", 0.1, 2.0, 0.3);
const projDist = addControl("proj", "Projection Dist", 1.5, 5.0, 2.5);
const edgeDens = addControl("dens", "Edge Spread", 0.5, 3.0, 1.0);

const numEdges = 32;
const particlesPerEdge = Math.floor(count / numEdges);
const edgeIdx = Math.floor(i / particlesPerEdge);
const t = (i % particlesPerEdge) / particlesPerEdge;

const vertices = [];
for (let a = 0; a < 2; a++)
  for (let b = 0; b < 2; b++)
    for (let c = 0; c < 2; c++)
      for (let d = 0; d < 2; d++)
        vertices.push([a * 2 - 1, b * 2 - 1, c * 2 - 1, d * 2 - 1]);

const edges = [];
for (let m = 0; m < 16; m++)
  for (let n = m + 1; n < 16; n++) {
    let diff = 0;
    for (let k = 0; k < 4; k++) diff += Math.abs(vertices[m][k] - vertices[n][k]);
    if (diff === 2) edges.push([m, n]);
  }

const eIdx = edgeIdx % edges.length;
const vA = vertices[edges[eIdx][0]];
const vB = vertices[edges[eIdx][1]];

const noise = Math.sin(i * 7.37) * 0.1 * edgeDens;
const px = vA[0] + (vB[0] - vA[0]) * t + noise;
const py = vA[1] + (vB[1] - vA[1]) * t + Math.cos(i * 3.91) * 0.1 * edgeDens;
const pz = vA[2] + (vB[2] - vA[2]) * t + Math.sin(i * 5.13) * 0.1 * edgeDens;
const pw = vA[3] + (vB[3] - vA[3]) * t + Math.cos(i * 2.17) * 0.1 * edgeDens;

const axw = time * speedXW;
const cosA = Math.cos(axw);
const sinA = Math.sin(axw);
const rx = px * cosA - pw * sinA;
const rw = px * sinA + pw * cosA;

const ayz = time * speedYZ;
const cosB = Math.cos(ayz);
const sinB = Math.sin(ayz);
const ry = py * cosB - pz * sinB;
const rz = py * sinB + pz * cosB;

const scale = projDist / (projDist - rw);
const finalX = rx * scale * 20;
const finalY = ry * scale * 20;
const finalZ = rz * scale * 20;

target.set(finalX, finalY, finalZ);

const h = (eIdx / edges.length) * 0.8 + 0.1;
const l = 0.4 + 0.3 * scale + 0.1 * Math.sin(time + eIdx);
color.setHSL(h, 0.7, Math.min(Math.max(l, 0.2), 1.0));

if (i === 0) {
  setInfo("4D Tesseract", "Hypercube projected from 4D space");
  annotate("origin", new THREE.Vector3(0, 0, 0), "4D Origin");
}
`.trim(),
};

const remixLogo: Preset = {
  name: "Remix Logo",
  modelUrl: "/models/remix-logo.pts",
  code: `
addControl("_separation", "Particle Distance", 0, 1, 0);
const scale = addControl("scale", "Scale", 5, 80, 26);
const spin = time * 0.15;
const cosS = Math.cos(spin);
const sinS = Math.sin(spin);

const idx = i * 3;
const mx = modelPositions[idx] * scale;
const my = modelPositions[idx + 1] * scale;
const mz = modelPositions[idx + 2] * scale;

target.set(mx * cosS - mz * sinS, my, mx * sinS + mz * cosS);

const t = i / count;
const h = 0.0;
const s = 0.0;
const l = 0.5 + 0.3 * Math.sin(t * 6.28 + time * 0.5);
color.setHSL(h, s, l);

if (i === 0) {
  setInfo("Remix Logo", "The Remix framework logo as particles");
}
`.trim(),
};

export const presets: Preset[] = [remixLogo, racecar, racetrack, galaxy, tesseract];
