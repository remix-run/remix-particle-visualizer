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

if (isBell) {
  const t = i / bellCount;
  const theta = t * Math.PI * 2 * 40;
  const phi = Math.sqrt(t) * Math.PI * 0.52;
  const breathe = 1.0 + 0.15 * Math.sin(time * pulse);
  const r = 20 * Math.sin(phi) * breathe;
  const bellY = 20 * Math.cos(phi) * breathe;
  const ripple = 1.0 + 0.05 * Math.sin(theta * 0.5 + time * 3.0);
  target.set(
    Math.cos(theta) * r * ripple,
    bellY - 5,
    Math.sin(theta) * r * ripple
  );
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
  target.set(
    baseX + wave,
    -5 - depth,
    baseZ + wave2
  );
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

const bonsai: Preset = {
  name: "Bonsai",
  code: `
const scale = addControl("scale", "Scale", 8, 30, 16);
const wind = addControl("wind", "Wind", 0, 2.0, 0.4);
const foliage = addControl("foliage", "Foliage Density", 0.3, 1.5, 1.0);
const season = addControl("season", "Season", 0, 1, 0.2);

const trunkCount = Math.floor(count * 0.15);
const canopyCount = count - trunkCount;

if (i < trunkCount) {
  const t = i / trunkCount;
  const h = t * scale * 0.65;
  const taper = (1.0 - t * 0.7) * scale * 0.22;

  const curveX = Math.sin(t * Math.PI * 0.9) * scale * 0.4 + Math.sin(t * 5.2 + 0.8) * scale * 0.08;
  const curveZ = Math.cos(t * Math.PI * 0.7 + 1.5) * scale * 0.2 + Math.cos(t * 4.1 + 1.3) * scale * 0.06;

  const sway = Math.sin(time * wind + t * 3) * t * wind * 0.5;

  const angle = (i % 30) / 30 * Math.PI * 2;
  const knot = 1.0 + 0.35 * Math.sin(angle * 3 + t * 12) + 0.15 * Math.sin(t * 25);
  const r = taper * knot;

  target.set(
    Math.cos(angle) * r + curveX + sway,
    h - scale * 0.2,
    Math.sin(angle) * r + curveZ
  );

  const bark = 0.08 + 0.03 * Math.sin(t * 30);
  const lum = 0.13 + 0.12 * t;
  color.setHSL(bark, 0.65, lum);

} else {
  const ci = i - trunkCount;
  const t = ci / canopyCount;

  const cluster = ci % 5;
  const clusterSeed = Math.floor(ci / (canopyCount * 0.2));
  const trunkTipX = Math.sin(Math.PI * 0.9) * scale * 0.4;
  const trunkTipZ = Math.cos(Math.PI * 0.7 + 1.5) * scale * 0.2;
  const cx = trunkTipX + Math.sin(clusterSeed * 2.4 + 1.0) * scale * 0.55;
  const cz = trunkTipZ + Math.cos(clusterSeed * 3.7 + 2.0) * scale * 0.55;
  const cy = scale * 0.4 + Math.abs(Math.sin(clusterSeed * 1.8)) * scale * 0.2;

  const phi = t * Math.PI * 2 * 30 + clusterSeed * 7;
  const cosP = Math.cos(phi);
  const theta = t * Math.PI * 18 + clusterSeed * 4;

  const cloudR = scale * 0.55 * foliage * (0.4 + 0.6 * Math.sin(t * 60 + clusterSeed));
  const breathe = 1.0 + 0.04 * Math.sin(time * 1.5 + t * 10);
  const sway = Math.sin(time * wind * 0.7 + t * 5) * wind * 1.2;

  const sinTheta = Math.sin(theta);
  const wisp = 1.0 + 0.5 * Math.sin(t * 200 + clusterSeed * 3);

  const yNoise1 = Math.sin(ci * 1.37 + clusterSeed * 5.1) * 0.6;
  const yNoise2 = Math.cos(ci * 0.73 + clusterSeed * 3.3) * 0.3;
  const billow = Math.sin(t * 80 + clusterSeed * 2.7) * 0.4;

  target.set(
    cx + Math.cos(phi) * sinTheta * cloudR * breathe * wisp + sway,
    cy + Math.cos(theta) * cloudR * 0.65 * breathe + (yNoise1 + yNoise2 + billow) * cloudR * 0.5,
    cz + Math.sin(phi) * sinTheta * cloudR * breathe * wisp
  );

  const greenH = 0.28 + 0.07 * Math.sin(t * 40 + clusterSeed) - season * 0.15;
  const sat = 0.6 + 0.3 * (1.0 - season);
  const lum = 0.2 + 0.25 * (0.5 + 0.5 * cosP) + season * 0.15;
  color.setHSL(greenH, sat, Math.min(lum, 0.7));
}

if (i === 0) {
  setInfo("Bonsai", "A miniature tree swaying in the wind");
  annotate("base", new THREE.Vector3(0, -scale * 0.3, 0), "Root");
}
`.trim(),
};

const galaxy: Preset = {
  name: "Spiral Galaxy",
  code: `
const arms = addControl("arms", "Spiral Arms", 2, 8, 8);
const tightness = addControl("tight", "Tightness", 0.2, 2.0, 0.90);
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

export const presets: Preset[] = [jellyfish, bonsai, galaxy, tesseract];
