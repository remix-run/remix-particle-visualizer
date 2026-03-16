import type { Preset } from "./types";

const jellyfish: Preset = {
  name: "Jellyfish",
  code: `
const pulse = addControl("pulse", "Pulse Speed", 0.2, 4.0, 1.2);
const tentLen = addControl("tentLen", "Tentacle Length", 10, 60, 30);
const glow = addControl("glow", "Glow Intensity", 0.3, 2.0, 1.0);
const drift = addControl("drift", "Drift", 0, 5, 1.5);

const ratio = i / count;
const bellCount = Math.floor(count * 0.55);
const isBell = i < bellCount;

const spin = time * 0.15;
const cosS = Math.cos(spin);
const sinS = Math.sin(spin);

if (isBell) {
  const t = i / bellCount;
  const theta = t * Math.PI * 2 * 40;
  const phi = Math.sqrt(t) * Math.PI * 0.52;
  const breathe = 1.0 + 0.15 * Math.sin(time * pulse);
  const r = 20 * Math.sin(phi) * breathe;
  const bellY = 20 * Math.cos(phi) * breathe;
  const ripple = 1.0 + 0.05 * Math.sin(theta * 0.5 + time * 3.0);
  const lx = Math.cos(theta) * r * ripple;
  const lz = Math.sin(theta) * r * ripple;
  target.set(lx * cosS - lz * sinS, bellY - 5, lx * sinS + lz * cosS);
  const h = 0.55 + 0.15 * Math.sin(t * 6.28 + time * 0.5);
  const l = 0.4 + 0.3 * glow * Math.pow(Math.sin(t * 3.14), 2) + 0.1 * Math.sin(time * 2.0 + i * 0.01);
  color.setHSL(h, 0.9, Math.min(l, 1.0));
} else {
  const tentI = i - bellCount;
  const tentCount = count - bellCount;
  const numStrands = 10;
  const strand = tentI % numStrands;
  const posInStrand = Math.floor(tentI / numStrands) / Math.floor(tentCount / numStrands);
  const strandAngle = (strand / numStrands) * Math.PI * 2;
  const attachR = 18 * Math.sin(Math.PI * 0.5) * (1.0 + 0.15 * Math.sin(time * pulse));
  const baseX = Math.cos(strandAngle) * attachR * (0.6 + 0.4 * Math.sin(strand * 1.7));
  const baseZ = Math.sin(strandAngle) * attachR * (0.6 + 0.4 * Math.cos(strand * 1.3));
  const depth = posInStrand * tentLen;
  const wave = Math.sin(posInStrand * 4.0 + time * 1.5 + strand * 0.8) * (2 + posInStrand * drift * 3);
  const wave2 = Math.cos(posInStrand * 3.0 + time * 1.2 + strand * 1.2) * (1 + posInStrand * drift * 2);
  const lx = baseX + wave;
  const lz = baseZ + wave2;
  target.set(lx * cosS - lz * sinS, -5 - depth, lx * sinS + lz * cosS);
  const h = 0.6 + 0.1 * Math.sin(posInStrand * 3.0 + strand);
  const l = 0.3 + 0.4 * glow * (1.0 - posInStrand * 0.5) * (0.5 + 0.5 * Math.sin(time * 3.0 + posInStrand * 10.0));
  color.setHSL(h, 0.85, Math.max(0.1, Math.min(l, 1.0)));
}

if (i === 0) {
  setInfo("Bioluminescent Jellyfish", "A deep-sea medusa pulsing with light");
  annotate("bell", new THREE.Vector3(0, 15, 0), "Bell");
  annotate("tentacles", new THREE.Vector3(0, -25, 0), "Tentacles");
}
`.trim(),
};

const racetrack: Preset = {
  name: "Racetrack",
  cameraPosition: [-0.80, -17.40, 81.40],
  cameraTarget: [0, -20, -30],
  code: `
const fogMode = addControl("_fogMode", "Fog: Color / Scene", 0, 1, 1);

const speed = addControl("speed", "Speed", 0.1, 2.0, 1.0);
const trackW = addControl("trackW", "Track Width", 5, 60, 40);
const curveAmp = addControl("curve", "Curve Intensity", 0, 25, 10.25);

addControl("_camPosX", "Camera X", -80, 80, -0.80);
addControl("_camPosY", "Camera Y", -60, 60, -17.40);
addControl("_camPosZ", "Camera Z", 10, 150, 81.40);
addControl("_camTgtX", "Look-at X", -80, 80, 0);
addControl("_camTgtY", "Look-at Y", -60, 60, -20);
addControl("_camTgtZ", "Look-at Z", -120, 60, -30);

const zNear = 72;
const zFar = -100;
const trackY = -24;
const curbFrac = 0.15;
const surfaceEnd = Math.floor(count * (1 - curbFrac * 2));
const leftEnd = surfaceEnd + Math.floor(count * curbFrac);

const phi = 1.6180339887;
const along = (((i * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
const across = (i * 0.7071067812) % 1.0;

const t2 = along * along;
const z = zNear + (zFar - zNear) * t2;

const cx = Math.sin(along * Math.PI * 3) * curveAmp
         + Math.sin(along * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;

const perspNarrow = 1.0 - along * 0.5;

if (i < surfaceEnd) {
  const lane = (across - 0.5) * trackW * perspNarrow;
  const jx = Math.sin(i * 7.37) * 0.2;
  const jy = Math.cos(i * 3.91) * 0.1;
  target.set(cx + lane + jx, trackY + jy, z);

  const tarmac = 0.06 + 0.03 * Math.sin(i * 3.77 + along * 20);
  color.setHSL(0, 0, tarmac);
  if (fogMode < 0.5) {
    const fog = 1.0 - along;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < leftEnd) {
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

} else {
  const bi = i - leftEnd;
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
}

if (i === 0) {
  setInfo("Racetrack", "A circuit streaming past at speed");
}
`.trim(),
};

const galaxy: Preset = {
  name: "Spiral Galaxy",
  code: `
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
  modelUrl: "/models/remix-logo.glb",
  code: `
const scale = addControl("scale", "Scale", 5, 80, 27);
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

export const presets: Preset[] = [remixLogo, jellyfish, racetrack, galaxy, tesseract];
