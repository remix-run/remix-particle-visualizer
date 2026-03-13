import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

export interface ModelData {
  positions: Float32Array;
  colors: Float32Array | null;
}

export async function loadModelPoints(
  url: string,
  maxCount: number = 100_000,
): Promise<ModelData> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);

  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });

  if (meshes.length === 0) {
    throw new Error(`No meshes found in model: ${url}`);
  }

  let targetMesh: THREE.Mesh;

  if (meshes.length === 1) {
    targetMesh = meshes[0];
  } else {
    const geometries = meshes.map((m) => {
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      return geo;
    });
    const merged = mergeGeometries(geometries);
    targetMesh = new THREE.Mesh(merged);
    geometries.forEach((g) => g.dispose());
  }

  const hasVertexColors = targetMesh.geometry.hasAttribute("color");
  const sampler = new MeshSurfaceSampler(targetMesh).build();

  const positions = new Float32Array(maxCount * 3);
  const colors = hasVertexColors ? new Float32Array(maxCount * 3) : null;
  const tempPos = new THREE.Vector3();
  const tempColor = new THREE.Color();

  for (let i = 0; i < maxCount; i++) {
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
