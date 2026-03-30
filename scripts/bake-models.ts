/**
 * Bake GLB models into compact .pts point-cloud files.
 *
 * Usage:  npx tsx scripts/bake-models.ts
 *
 * Reads every .glb in source-models/, samples surface points with
 * MeshSurfaceSampler, then writes quantised .pts files to public/models/.
 *
 * .pts binary format (little-endian):
 *   [0..3]   magic  "PTS1"
 *   [4..7]   uint32  point count
 *   [8..11]  uint32  flags  (bit 0 = hasColors)
 *   [12..23] float32 ×3  bounds min (x, y, z)
 *   [24..35] float32 ×3  bounds max (x, y, z)
 *   [36..]   int16 ×(count×3)  quantised positions
 *   [after]  uint8 ×(count×3)  colours  (only when hasColors)
 */

/* ---- browser-API shims needed by three.js in Node ---- */
if (typeof (globalThis as any).document === "undefined") {
  (globalThis as any).document = {
    createElementNS: (_ns: string, tag: string) => {
      if (tag === "img") return { set src(_: string) {}, addEventListener() {} };
      if (tag === "canvas") return { getContext: () => null, width: 0, height: 0 };
      return {};
    },
    createElement: (tag: string) => {
      if (tag === "canvas") return { getContext: () => null, width: 0, height: 0 };
      return {};
    },
  };
}
if (typeof (globalThis as any).self === "undefined") {
  (globalThis as any).self = globalThis;
}
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).DOMParser === "undefined") {
  (globalThis as any).DOMParser = class {
    parseFromString() { return { documentElement: {} }; }
  };
}
if (typeof (globalThis as any).createImageBitmap === "undefined") {
  (globalThis as any).createImageBitmap = async () => ({
    width: 1, height: 1, close() {},
  });
}
if (typeof (globalThis as any).ProgressEvent === "undefined") {
  (globalThis as any).ProgressEvent = class ProgressEvent {
    type: string; lengthComputable: boolean; loaded: number; total: number;
    constructor(type: string, opts: any = {}) {
      this.type = type; this.lengthComputable = !!opts.lengthComputable;
      this.loaded = opts.loaded ?? 0; this.total = opts.total ?? 0;
    }
  };
}
/* ------------------------------------------------------- */

import * as fs from "node:fs";
import * as path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries as threemerge } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const SOURCE_DIR = "source-models";
const OUTPUT_DIR = "public/models";
const MAX_POINTS = 100_000;
const HEADER_BYTES = 36;

interface ModelConfig {
  edgeRatio?: number;
  edgeThresholdAngle?: number;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  "mockup-websites.glb": { edgeRatio: 0.95, edgeThresholdAngle: 15 },
};

async function loadGLB(filePath: string): Promise<THREE.Group> {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  const doc = await io.read(filePath);
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    ext.dispose();
  }
  await doc.transform(dedup(), prune());
  const glb = await io.writeBinary(doc);

  return new Promise((resolve, reject) => {
    const buf = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    const loader = new GLTFLoader();
    loader.parse(buf, "", (gltf) => resolve(gltf.scene), reject);
  });
}

const OVERSAMPLE = 10;

function poissonFilter(
  candidatePos: Float32Array,
  candidateCol: Float32Array | null,
  candidateCount: number,
  targetCount: number,
  distScale = 1.0,
) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < candidateCount; i++) {
    for (let c = 0; c < 3; c++) {
      const v = candidatePos[i * 3 + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }

  const dx = max[0] - min[0] || 1;
  const dy = max[1] - min[1] || 1;
  const dz = max[2] - min[2] || 1;
  const volume = dx * dy * dz;
  const minDist = Math.pow(volume / targetCount, 1 / 3) * 0.3 * distScale;
  const minDist2 = minDist * minDist;
  const cellSize = minDist;

  const gx = Math.ceil(dx / cellSize) + 1;
  const gy = Math.ceil(dy / cellSize) + 1;
  const gz = Math.ceil(dz / cellSize) + 1;
  const grid = new Map<number, number[]>();

  const toKey = (ix: number, iy: number, iz: number) => ix + iy * gx + iz * gx * gy;

  const positions = new Float32Array(targetCount * 3);
  const colors = candidateCol ? new Float32Array(targetCount * 3) : null;
  let accepted = 0;

  for (let ci = 0; ci < candidateCount && accepted < targetCount; ci++) {
    const px = candidatePos[ci * 3];
    const py = candidatePos[ci * 3 + 1];
    const pz = candidatePos[ci * 3 + 2];

    const ix = Math.floor((px - min[0]) / cellSize);
    const iy = Math.floor((py - min[1]) / cellSize);
    const iz = Math.floor((pz - min[2]) / cellSize);

    let tooClose = false;
    outer:
    for (let nx = ix - 1; nx <= ix + 1; nx++) {
      for (let ny = iy - 1; ny <= iy + 1; ny++) {
        for (let nz = iz - 1; nz <= iz + 1; nz++) {
          if (nx < 0 || ny < 0 || nz < 0 || nx >= gx || ny >= gy || nz >= gz) continue;
          const cell = grid.get(toKey(nx, ny, nz));
          if (!cell) continue;
          for (const ei of cell) {
            const ex = positions[ei * 3] - px;
            const ey = positions[ei * 3 + 1] - py;
            const ez = positions[ei * 3 + 2] - pz;
            if (ex * ex + ey * ey + ez * ez < minDist2) {
              tooClose = true;
              break outer;
            }
          }
        }
      }
    }

    if (tooClose) continue;

    const ai = accepted;
    positions[ai * 3] = px;
    positions[ai * 3 + 1] = py;
    positions[ai * 3 + 2] = pz;
    if (colors && candidateCol) {
      colors[ai * 3] = candidateCol[ci * 3];
      colors[ai * 3 + 1] = candidateCol[ci * 3 + 1];
      colors[ai * 3 + 2] = candidateCol[ci * 3 + 2];
    }

    const key = toKey(ix, iy, iz);
    const cell = grid.get(key);
    if (cell) cell.push(ai);
    else grid.set(key, [ai]);

    accepted++;
  }

  if (accepted < targetCount) {
    console.warn(`  Poisson filter accepted ${accepted}/${targetCount} (reduce minDist or increase oversample)`);
  }

  return { positions, colors, count: accepted };
}

function sampleEdges(
  meshes: THREE.Mesh[],
  count: number,
  thresholdAngle: number,
): Float32Array {
  const positions = new Float32Array(count * 3);
  const edgeSegments: { a: THREE.Vector3; b: THREE.Vector3; len: number }[] = [];
  let totalLen = 0;

  for (const mesh of meshes) {
    const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const posAttr = edgesGeo.getAttribute("position");
    for (let i = 0; i < posAttr.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1).applyMatrix4(mesh.matrixWorld);
      const len = a.distanceTo(b);
      if (len > 0) {
        edgeSegments.push({ a, b, len });
        totalLen += len;
      }
    }
    edgesGeo.dispose();
  }

  if (edgeSegments.length === 0 || totalLen === 0) {
    console.warn("  No edges found, falling back to all surface samples");
    return new Float32Array(0);
  }
  console.log(`(${edgeSegments.length} edge segments, total length ${totalLen.toFixed(1)}) `);

  const spacing = totalLen / count;
  const jitterAmt = spacing * 0.15;
  let cursor = Math.random() * spacing;
  let segIdx = 0;
  let segConsumed = 0;
  let written = 0;

  while (written < count && segIdx < edgeSegments.length) {
    const seg = edgeSegments[segIdx];
    const remaining = seg.len - segConsumed;

    if (cursor <= remaining) {
      const t = (segConsumed + cursor) / seg.len;
      const jx = (Math.random() - 0.5) * jitterAmt;
      const jy = (Math.random() - 0.5) * jitterAmt;
      const jz = (Math.random() - 0.5) * jitterAmt;
      positions[written * 3]     = seg.a.x + (seg.b.x - seg.a.x) * t + jx;
      positions[written * 3 + 1] = seg.a.y + (seg.b.y - seg.a.y) * t + jy;
      positions[written * 3 + 2] = seg.a.z + (seg.b.z - seg.a.z) * t + jz;
      written++;
      segConsumed += cursor;
      cursor = spacing;
    } else {
      cursor -= remaining;
      segIdx++;
      segConsumed = 0;
    }
  }

  console.log(`  (${written} edge points at ~${spacing.toFixed(4)} spacing) `);
  return positions.subarray(0, written * 3);
}

function sampleSurface(scene: THREE.Group, count: number, config?: ModelConfig) {
  scene.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });
  if (meshes.length === 0) throw new Error("No meshes found in model");
  console.log(`(${meshes.length} meshes) `);

  let targetMesh: THREE.Mesh;
  if (meshes.length === 1) {
    const geo = meshes[0].geometry.clone();
    geo.applyMatrix4(meshes[0].matrixWorld);
    targetMesh = new THREE.Mesh(geo);
  } else {
    const geos = meshes.map((m) => {
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      const posOnly = new THREE.BufferGeometry();
      posOnly.setAttribute("position", geo.getAttribute("position"));
      if (geo.index) posOnly.setIndex(geo.index);
      return posOnly;
    });
    const merged = threemerge(geos);
    if (!merged) throw new Error("Failed to merge geometries");
    targetMesh = new THREE.Mesh(merged);
    geos.forEach((g) => g.dispose());
  }

  const hasVertexColors = targetMesh.geometry.hasAttribute("color");
  const sampler = new MeshSurfaceSampler(targetMesh).build();

  const edgeRatio = config?.edgeRatio ?? 0;
  const edgeAngle = config?.edgeThresholdAngle ?? 15;

  let positions: Float32Array;
  let colors: Float32Array | null;
  let accepted: number;

  if (edgeRatio >= 1.0) {
    const worldMeshes = meshes.map((m) => {
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      return new THREE.Mesh(geo);
    });
    const edgePos = sampleEdges(worldMeshes, count, edgeAngle);
    worldMeshes.forEach((m) => m.geometry.dispose());
    accepted = edgePos.length / 3;
    positions = edgePos;
    colors = null;
  } else {
    const poolSize = count * OVERSAMPLE;
    const edgePoolCount = edgeRatio > 0 ? Math.floor(poolSize * edgeRatio) : 0;
    const surfacePoolCount = poolSize - edgePoolCount;

    const poolPos = new Float32Array(poolSize * 3);
    const poolCol = hasVertexColors ? new Float32Array(poolSize * 3) : null;

    if (edgePoolCount > 0) {
      const worldMeshes = meshes.map((m) => {
        const geo = m.geometry.clone();
        geo.applyMatrix4(m.matrixWorld);
        return new THREE.Mesh(geo);
      });
      const edgePos = sampleEdges(worldMeshes, edgePoolCount, edgeAngle);
      const edgesGenerated = Math.min(edgePos.length / 3, edgePoolCount);
      poolPos.set(edgePos.subarray(0, edgesGenerated * 3), 0);
      worldMeshes.forEach((m) => m.geometry.dispose());
    }

    const tempPos = new THREE.Vector3();
    const tempColor = new THREE.Color();
    for (let i = 0; i < surfacePoolCount; i++) {
      if (hasVertexColors) {
        sampler.sample(tempPos, undefined, tempColor);
      } else {
        sampler.sample(tempPos);
      }
      const writeIdx = (edgePoolCount + i) * 3;
      poolPos[writeIdx] = tempPos.x;
      poolPos[writeIdx + 1] = tempPos.y;
      poolPos[writeIdx + 2] = tempPos.z;
      if (poolCol) {
        poolCol[writeIdx] = tempColor.r;
        poolCol[writeIdx + 1] = tempColor.g;
        poolCol[writeIdx + 2] = tempColor.b;
      }
    }

    const distScale = edgeRatio > 0.5 ? 0.3 : 1.0;
    ({ positions, colors, count: accepted } = poissonFilter(poolPos, poolCol, poolSize, count, distScale));
  }

  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < accepted; i++) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i * 3 + c];
      if (v < bmin[c]) bmin[c] = v;
      if (v > bmax[c]) bmax[c] = v;
    }
  }
  const cx = (bmin[0] + bmax[0]) / 2;
  const cy = (bmin[1] + bmax[1]) / 2;
  const cz = (bmin[2] + bmax[2]) / 2;
  const extent = Math.max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]);
  const normScale = extent > 0 ? 2.0 / extent : 1;
  for (let i = 0; i < accepted; i++) {
    positions[i * 3]     = (positions[i * 3]     - cx) * normScale;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - cy) * normScale;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - cz) * normScale;
  }

  return { positions, colors, accepted };
}

function writePts(
  outPath: string,
  positions: Float32Array,
  colors: Float32Array | null,
  count: number,
) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i * 3 + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }

  const range = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const posBytes = count * 3 * 2;
  const colBytes = colors ? count * 3 : 0;
  const total = HEADER_BYTES + posBytes + colBytes;
  const buf = Buffer.alloc(total);

  buf.write("PTS1", 0, 4, "ascii");
  buf.writeUInt32LE(count, 4);
  buf.writeUInt32LE(colors ? 1 : 0, 8);
  buf.writeFloatLE(min[0], 12);
  buf.writeFloatLE(min[1], 16);
  buf.writeFloatLE(min[2], 20);
  buf.writeFloatLE(max[0], 24);
  buf.writeFloatLE(max[1], 28);
  buf.writeFloatLE(max[2], 32);

  let offset = HEADER_BYTES;
  for (let i = 0; i < count * 3; i++) {
    const c = i % 3;
    const norm = range[c] > 0 ? (positions[i] - min[c]) / range[c] : 0;
    const q = Math.round(norm * 65534 - 32767);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, q)), offset);
    offset += 2;
  }

  if (colors) {
    for (let i = 0; i < count * 3; i++) {
      buf.writeUInt8(Math.round(Math.min(1, Math.max(0, colors[i])) * 255), offset);
      offset++;
    }
  }

  fs.writeFileSync(outPath, buf);
  return { rawBytes: count * 3 * 4 + (colors ? count * 3 * 4 : 0), ptsBytes: total };
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory "${SOURCE_DIR}" not found`);
    process.exit(1);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".glb"));
  if (files.length === 0) {
    console.log("No .glb files found in", SOURCE_DIR);
    return;
  }

  console.log(`Baking ${files.length} model(s)...\n`);

  for (const file of files) {
    const srcPath = path.join(SOURCE_DIR, file);
    const outName = file.replace(/\.glb$/i, ".pts");
    const outPath = path.join(OUTPUT_DIR, outName);

    process.stdout.write(`  ${file} → ${outName} ... `);

    const scene = await loadGLB(srcPath);
    const config = MODEL_CONFIG[file];
    const { positions, colors, accepted } = sampleSurface(scene, MAX_POINTS, config);
    const pointCount = Math.min(accepted, MAX_POINTS);
    const { rawBytes, ptsBytes } = writePts(outPath, positions, colors, pointCount);
    const glbSize = fs.statSync(srcPath).size;

    console.log(
      `done  ${pointCount} pts (GLB ${fmt(glbSize)} → PTS ${fmt(ptsBytes)}, ` +
      `${((1 - ptsBytes / glbSize) * 100).toFixed(0)}% smaller)`
    );
  }

  console.log("\nAll models baked.");
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

main().catch((err) => {
  console.error("Bake failed:", err);
  process.exit(1);
});
