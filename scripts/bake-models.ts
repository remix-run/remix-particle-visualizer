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
/* ------------------------------------------------------- */

import * as fs from "node:fs";
import * as path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

const SOURCE_DIR = "source-models";
const OUTPUT_DIR = "public/models";
const MAX_POINTS = 100_000;
const HEADER_BYTES = 36;

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    totalVerts += geo.getAttribute("position").count;
    totalIndices += geo.index ? geo.index.count : geo.getAttribute("position").count;
  }

  const mergedPositions = new Float32Array(totalVerts * 3);
  const mergedIndices = new Uint32Array(totalIndices);
  let vertOffset = 0;
  let idxOffset = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count * 3; i++) {
      mergedPositions[vertOffset * 3 + i] = (pos.array as Float32Array)[i];
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        mergedIndices[idxOffset + i] = geo.index.array[i] + vertOffset;
      }
      idxOffset += geo.index.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        mergedIndices[idxOffset + i] = vertOffset + i;
      }
      idxOffset += pos.count;
    }
    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(mergedPositions, 3));
  merged.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
  return merged;
}

function loadGLB(filePath: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const data = fs.readFileSync(filePath);
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const loader = new GLTFLoader();
    loader.parse(buf, "", (gltf) => resolve(gltf.scene), reject);
  });
}

function sampleSurface(scene: THREE.Group, count: number) {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });
  if (meshes.length === 0) throw new Error("No meshes found in model");

  let targetMesh: THREE.Mesh;
  if (meshes.length === 1) {
    targetMesh = meshes[0];
  } else {
    const geos = meshes.map((m) => {
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      return geo;
    });
    targetMesh = new THREE.Mesh(mergeGeometries(geos));
    geos.forEach((g) => g.dispose());
  }

  const hasVertexColors = targetMesh.geometry.hasAttribute("color");
  const sampler = new MeshSurfaceSampler(targetMesh).build();

  const positions = new Float32Array(count * 3);
  const colors = hasVertexColors ? new Float32Array(count * 3) : null;
  const tempPos = new THREE.Vector3();
  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    if (hasVertexColors) {
      sampler.sample(tempPos, undefined, tempColor);
    } else {
      sampler.sample(tempPos);
    }
    const idx = i * 3;
    positions[idx] = tempPos.x;
    positions[idx + 1] = tempPos.y;
    positions[idx + 2] = tempPos.z;
    if (colors) {
      colors[idx] = tempColor.r;
      colors[idx + 1] = tempColor.g;
      colors[idx + 2] = tempColor.b;
    }
  }

  return { positions, colors };
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
    const { positions, colors } = sampleSurface(scene, MAX_POINTS);
    const { rawBytes, ptsBytes } = writePts(outPath, positions, colors, MAX_POINTS);
    const glbSize = fs.statSync(srcPath).size;

    console.log(
      `done  (GLB ${fmt(glbSize)} → PTS ${fmt(ptsBytes)}, ` +
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
