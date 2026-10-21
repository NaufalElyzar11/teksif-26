// Standalone mesh exporters. Input model units: millimetres.
// No network, DOM, FileReader, or optional dependencies are required.
function included(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData?.excludeFromExport) return false;
  }
  return true;
}

function meshesOf(root) {
  root.updateMatrixWorld(true);
  const result = [];
  root.traverse(object => {
    if (object.isMesh && object.geometry?.getAttribute('position') && included(object)) result.push(object);
  });
  return result;
}

function meshRanges(mesh) {
  const geometry = mesh.geometry;
  const total = geometry.index ? geometry.index.count : geometry.getAttribute('position').count;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const drawStart = Math.max(0, geometry.drawRange?.start || 0);
  const drawEnd = Math.min(total, drawStart + (geometry.drawRange?.count ?? Infinity));
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
  return groups.map(group => {
    const start = Math.max(drawStart, group.start);
    const end = Math.min(drawEnd, group.start + group.count);
    return { start, end: start + Math.max(0, Math.floor((end - start) / 3) * 3), material: materials[group.materialIndex] || materials[0] };
  }).filter(group => group.end > group.start);
}

function safeName(value, fallback = 'part') {
  return String(value || fallback).normalize('NFKD').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
}

function finite(number) {
  if (!Number.isFinite(number)) throw new Error('Geometry contains a non-finite number.');
  return Math.abs(number) < 1e-9 ? 0 : Number(number.toFixed(7));
}

/** OBJ coordinates are millimetres; returns matching OBJ and MTL text. */
export function exportOBJ(THREE, root) {
  const meshes = meshesOf(root);
  const obj = ['# Shower adaptif C2 - geometry concept, NOT fabrication CAD', '# Coordinates in millimetres', 'mtllib shower-C2.mtl'];
  const mtl = ['# Three.js PBR approximated as Wavefront materials'];
  const materials = new Map();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  let offset = 1;
  let meshId = 0;
  function materialName(material) {
    const key = material?.uuid || 'default';
    if (materials.has(key)) return materials.get(key);
    const name = `mat_${materials.size}_${safeName(material?.name, 'surface')}`;
    materials.set(key, name);
    const color = material?.color || new THREE.Color(0.7, 0.7, 0.7);
    mtl.push('', `newmtl ${name}`, `Kd ${finite(color.r)} ${finite(color.g)} ${finite(color.b)}`,
      `d ${finite(material?.opacity ?? 1)}`, 'Ka 0.08 0.08 0.08', 'Ks 0.3 0.3 0.3',
      `Ns ${finite((1 - (material?.roughness ?? 0.5)) * 200)}`, 'illum 2');
    return name;
  }
  for (const mesh of meshes) {
    let geometry = mesh.geometry;
    let cloned = false;
    if (!geometry.getAttribute('normal')) { geometry = geometry.clone(); geometry.computeVertexNormals(); cloned = true; }
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const indices = geometry.index;
    obj.push('', `o ${safeName(mesh.name, `mesh_${meshId++}`)}`);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      obj.push(`v ${finite(vertex.x)} ${finite(vertex.y)} ${finite(vertex.z)}`);
    }
    for (let i = 0; i < normals.count; i++) {
      normal.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix);
      obj.push(`vn ${finite(normal.x)} ${finite(normal.y)} ${finite(normal.z)}`);
    }
    const flip = mesh.matrixWorld.determinant() < 0;
    for (const range of meshRanges(mesh)) {
      obj.push(`usemtl ${materialName(range.material)}`);
      for (let i = range.start; i < range.end; i += 3) {
        const a = (indices ? indices.getX(i) : i) + offset;
        const b = (indices ? indices.getX(i + (flip ? 2 : 1)) : i + (flip ? 2 : 1)) + offset;
        const c = (indices ? indices.getX(i + (flip ? 1 : 2)) : i + (flip ? 1 : 2)) + offset;
        obj.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
      }
    }
    offset += positions.count;
    if (cloned) geometry.dispose();
  }
  if (!meshes.length) throw new Error('Cannot export an empty OBJ.');
  return { obj: obj.join('\n') + '\n', mtl: mtl.join('\n') + '\n' };
}

/** Binary STL coordinates are millimetres. Parts may overlap in this concept assembly. */
export function exportSTL(THREE, root) {
  const meshes = meshesOf(root);
  const triangleCount = meshes.reduce((sum, mesh) => sum + meshRanges(mesh).reduce((n, r) => n + (r.end - r.start) / 3, 0), 0);
  if (!triangleCount) throw new Error('Cannot export an empty STL.');
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode('C2 adaptive shower | mm | CONCEPT, NOT FOR FABRICATION').subarray(0, 80));
  const data = new DataView(buffer);
  data.setUint32(80, triangleCount, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), normal = new THREE.Vector3();
  let cursor = 84;
  function writeVector(vector) {
    for (const value of [vector.x, vector.y, vector.z]) { data.setFloat32(cursor, finite(value), true); cursor += 4; }
  }
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    const indices = geometry.index;
    const flip = mesh.matrixWorld.determinant() < 0;
    for (const range of meshRanges(mesh)) for (let i = range.start; i < range.end; i += 3) {
      a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(positions, indices ? indices.getX(i + (flip ? 2 : 1)) : i + (flip ? 2 : 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(positions, indices ? indices.getX(i + (flip ? 1 : 2)) : i + (flip ? 1 : 2)).applyMatrix4(mesh.matrixWorld);
      ab.subVectors(b, a); ac.subVectors(c, a); normal.crossVectors(ab, ac).normalize();
      writeVector(normal); writeVector(a); writeVector(b); writeVector(c);
      data.setUint16(cursor, 0, true); cursor += 2;
    }
  }
  return buffer;
}

/**
 * Self-contained glTF 2.0 binary. Positions and translations are converted mm -> m.
 * options.animations: [{name, tracks:[{object:Object3D,path:'translation'|'rotation'|'scale',times:number[],values:number[]}]}]
 * Animation translation values are input in millimetres. Timing is illustrative.
 */
export function exportGLB(THREE, root, options = {}) {
  root.updateMatrixWorld(true);
  const gltf = {
    asset: { version: '2.0', generator: 'C2 concept mesh exporter', extras: { purpose: 'Concept only; not fabrication CAD or hydraulic validation', units: 'metres', sourceUnits: 'millimetres' } },
    scene: 0, scenes: [{ name: 'Shower_C2_assembled_reference', nodes: [] }],
    nodes: [], meshes: [], materials: [], buffers: [], bufferViews: [], accessors: [],
  };
  const bins = [];
  let byteLength = 0;
  const nodeMap = new Map(), materialMap = new Map(), geometryMap = new Map();
  function addData(array, type, componentType, itemSize, target, calculateBounds = false) {
    const pad = (4 - byteLength % 4) % 4;
    if (pad) { bins.push(new Uint8Array(pad)); byteLength += pad; }
    const viewIndex = gltf.bufferViews.length;
    const view = { buffer: 0, byteOffset: byteLength, byteLength: array.byteLength };
    if (target) view.target = target;
    gltf.bufferViews.push(view);
    bins.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    byteLength += array.byteLength;
    const accessor = { bufferView: viewIndex, componentType, count: array.length / itemSize, type };
    if (calculateBounds) {
      const min = Array(itemSize).fill(Infinity), max = Array(itemSize).fill(-Infinity);
      for (let i = 0; i < array.length; i++) {
        if (!Number.isFinite(array[i])) throw new Error('GLB attribute contains a non-finite value.');
        const j = i % itemSize; min[j] = Math.min(min[j], array[i]); max[j] = Math.max(max[j], array[i]);
      }
      accessor.min = min; accessor.max = max;
    }
    gltf.accessors.push(accessor);
    return gltf.accessors.length - 1;
  }
  function materialIndex(material) {
    const key = material?.uuid || 'default';
    if (materialMap.has(key)) return materialMap.get(key);
    const color = material?.color || new THREE.Color(0.7, 0.7, 0.7);
    const result = {
      name: material?.name || `surface_${gltf.materials.length}`,
      pbrMetallicRoughness: {
        baseColorFactor: [color.r, color.g, color.b, material?.opacity ?? 1],
        metallicFactor: material?.metalness ?? 0,
        roughnessFactor: material?.roughness ?? 0.5,
      },
      doubleSided: material?.side === THREE.DoubleSide,
    };
    if (material?.transparent || material?.opacity < 1) result.alphaMode = 'BLEND';
    if (material?.alphaTest > 0) { result.alphaMode = 'MASK'; result.alphaCutoff = material.alphaTest; }
    if (material?.emissive && material.emissiveIntensity > 0) {
      result.emissiveFactor = [material.emissive.r, material.emissive.g, material.emissive.b].map(v => Math.min(1, v * material.emissiveIntensity));
    }
    const index = gltf.materials.push(result) - 1;
    materialMap.set(key, index);
    return index;
  }
  function geometryAttributes(original) {
    if (geometryMap.has(original.uuid)) return geometryMap.get(original.uuid);
    let geometry = original;
    let cloned = false;
    if (!geometry.getAttribute('normal')) { geometry = geometry.clone(); geometry.computeVertexNormals(); cloned = true; }
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const pos = new Float32Array(positions.count * 3), norm = new Float32Array(normals.count * 3);
    for (let i = 0; i < positions.count; i++) {
      pos[i * 3] = positions.getX(i) / 1000; pos[i * 3 + 1] = positions.getY(i) / 1000; pos[i * 3 + 2] = positions.getZ(i) / 1000;
      norm[i * 3] = normals.getX(i); norm[i * 3 + 1] = normals.getY(i); norm[i * 3 + 2] = normals.getZ(i);
    }
    const attrs = { POSITION: addData(pos, 'VEC3', 5126, 3, 34962, true), NORMAL: addData(norm, 'VEC3', 5126, 3, 34962) };
    geometryMap.set(original.uuid, attrs);
    if (cloned) geometry.dispose();
    return attrs;
  }
  function addNode(object) {
    if (!included(object)) return null;
    const index = gltf.nodes.length;
    nodeMap.set(object, index);
    const node = {
      name: object.name || object.type,
      translation: object.position.toArray().map(v => finite(v / 1000)),
      rotation: object.quaternion.toArray().map(finite),
      scale: object.scale.toArray().map(finite),
    };
    if (object.userData?.description) node.extras = { description: String(object.userData.description) };
    gltf.nodes.push(node);
    if (object.isMesh && object.geometry?.getAttribute('position')) {
      const attributes = geometryAttributes(object.geometry);
      const indexAttribute = object.geometry.index;
      const primitives = meshRanges(object).map(range => {
        const values = new Uint32Array(range.end - range.start);
        for (let i = range.start; i < range.end; i++) values[i - range.start] = indexAttribute ? indexAttribute.getX(i) : i;
        const indices = addData(values, 'SCALAR', 5125, 1, 34963);
        return { attributes, indices, material: materialIndex(range.material), mode: 4 };
      });
      if (primitives.length) node.mesh = gltf.meshes.push({ name: node.name, primitives }) - 1;
    }
    const children = object.children.map(addNode).filter(v => v !== null);
    if (children.length) node.children = children;
    return index;
  }
  const rootIndex = addNode(root);
  if (rootIndex === null || !gltf.meshes.length) throw new Error('Cannot export an empty GLB.');
  gltf.scenes[0].nodes.push(rootIndex);
  if (options.animations?.length) {
    gltf.animations = [];
    for (const clip of options.animations) {
      const samplers = [], channels = [];
      for (const track of clip.tracks || []) {
        const node = nodeMap.get(track.object);
        const size = track.path === 'rotation' ? 4 : 3;
        if (node === undefined || !['translation', 'rotation', 'scale'].includes(track.path)) continue;
        if (track.values.length !== track.times.length * size) throw new Error('Invalid GLB animation sample count.');
        const times = new Float32Array(track.times);
        const values = new Float32Array(track.values.map(v => track.path === 'translation' ? v / 1000 : v));
        const input = addData(times, 'SCALAR', 5126, 1, undefined, true);
        const output = addData(values, size === 4 ? 'VEC4' : 'VEC3', 5126, size);
        const sampler = samplers.push({ input, output, interpolation: 'LINEAR' }) - 1;
        channels.push({ sampler, target: { node, path: track.path } });
      }
      if (channels.length) gltf.animations.push({ name: clip.name || 'illustrative_motion', samplers, channels, extras: { purpose: 'Illustrative state motion, not validated kinematics' } });
    }
    if (!gltf.animations.length) delete gltf.animations;
  }
  gltf.buffers.push({ byteLength });
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const binLength = Math.ceil(byteLength / 4) * 4;
  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const result = new ArrayBuffer(totalLength);
  const data = new DataView(result);
  data.setUint32(0, 0x46546c67, true); data.setUint32(4, 2, true); data.setUint32(8, totalLength, true);
  data.setUint32(12, jsonLength, true); data.setUint32(16, 0x4e4f534a, true);
  const bytes = new Uint8Array(result);
  bytes.fill(0x20, 20, 20 + jsonLength); bytes.set(jsonBytes, 20);
  const binHeader = 20 + jsonLength;
  data.setUint32(binHeader, binLength, true); data.setUint32(binHeader + 4, 0x004e4942, true);
  let cursor = binHeader + 8;
  for (const chunk of bins) { bytes.set(chunk, cursor); cursor += chunk.byteLength; }
  return result;
}

export function inspectGeometry(THREE, root) {
  const meshes = meshesOf(root);
  const bounds = new THREE.Box3();
  const vector = new THREE.Vector3();
  let vertices = 0, triangles = 0, nonFiniteValues = 0;
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute('position');
    vertices += positions.count;
    triangles += meshRanges(mesh).reduce((sum, range) => sum + (range.end - range.start) / 3, 0);
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      if ([vector.x, vector.y, vector.z].every(Number.isFinite)) bounds.expandByPoint(vector);
      else nonFiniteValues++;
    }
  }
  return {
    meshCount: meshes.length, vertexCount: vertices, triangleCount: triangles, nonFiniteValues,
    sourceUnits: 'millimetres', glbUnits: 'metres',
    boundsMillimetres: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new THREE.Vector3()).toArray() },
  };
}
