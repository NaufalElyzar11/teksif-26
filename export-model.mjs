import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from './vendor/three.module.min.js';
import { createShowerModel } from './model.js';
import { exportOBJ, exportSTL, exportGLB, inspectGeometry } from './exports.js';

const directory = dirname(fileURLToPath(import.meta.url));
const model = createShowerModel(THREE);
const reference = { water: false, soap: false, cutaway: false, exploded: 0, cartridgeOut: false, capOpen: false, waterPress: 0, soapPress: 0 };
const motionClips = [];

// Actual object transforms are sampled; the timing is an illustration, not a design requirement.
for (const [kind, name, objectKeys] of [
  ['water', 'Air_buka_tutup', ['waterCore', 'waterButton']],
  ['soap', 'Sabun_buka_tutup', ['soapCore', 'soapButton']],
]) {
  const targets = objectKeys.map(key => model.actuators?.[key]).filter(object => object?.isObject3D);
  const samples = targets.map(object => ({ object, positions: [], rotations: [] }));
  for (const state of [reference, { ...reference, [kind]: true, [`${kind}Press`]: 1 }, { ...reference, [kind]: true }, reference]) {
    model.setState(state);
    for (const sample of samples) {
      sample.positions.push(...sample.object.position.toArray());
      sample.rotations.push(...sample.object.quaternion.toArray());
    }
  }
  const tracks = [];
  for (const sample of samples) for (const [path, values, size] of [['translation', sample.positions, 3], ['rotation', sample.rotations, 4]]) {
    if (values.some((value, index) => Math.abs(value - values[index % size]) > 1e-7)) {
      tracks.push({ object: sample.object, path, times: [0, 0.2, 0.5, 1.2], values });
    }
  }
  if (tracks.length) motionClips.push({ name, tracks });
}
model.setState(reference);
model.root.updateMatrixWorld(true);

const obj = exportOBJ(THREE, model.root);
const stl = exportSTL(THREE, model.root);
const glb = exportGLB(THREE, model.root, { animations: motionClips });
await writeFile(join(directory, 'shower-C2.obj'), obj.obj);
await writeFile(join(directory, 'shower-C2.mtl'), obj.mtl);
await writeFile(join(directory, 'shower-C2.stl'), new Uint8Array(stl));
await writeFile(join(directory, 'shower-C2.glb'), new Uint8Array(glb));

const view = new DataView(glb);
if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== glb.byteLength) throw new Error('Invalid GLB container header.');
const jsonLength = view.getUint32(12, true);
const document = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).trim());
if (document.asset.version !== '2.0') throw new Error('Missing glTF 2.0 metadata.');
for (const accessor of document.accessors) {
  const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const bufferView = document.bufferViews[accessor.bufferView];
  if (!bytes || !components || !bufferView || accessor.count * bytes * components > bufferView.byteLength) throw new Error('GLB accessor exceeds its buffer view.');
}
const geometry = inspectGeometry(THREE, model.root);
if (!geometry.meshCount || !geometry.triangleCount || geometry.nonFiniteValues) throw new Error('Invalid or empty exported geometry.');
if (84 + 50 * new DataView(stl).getUint32(80, true) !== stl.byteLength) throw new Error('Invalid binary STL length.');
// Import the serialized hierarchy and accessors again, independently of the source meshes.
const binBase = 20 + jsonLength + 8;
const importBounds = new THREE.Box3();
let importedTriangles = 0;
function readPositions(accessorIndex) {
  const accessor = document.accessors[accessorIndex];
  const bufferView = document.bufferViews[accessor.bufferView];
  if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') throw new Error('Unexpected imported position format.');
  return new Float32Array(glb, binBase + (bufferView.byteOffset || 0) + (accessor.byteOffset || 0), accessor.count * 3);
}
function importNode(nodeIndex, parentMatrix) {
  const node = document.nodes[nodeIndex];
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale || [1, 1, 1]),
  );
  matrix.premultiply(parentMatrix);
  if (node.mesh !== undefined) for (const primitive of document.meshes[node.mesh].primitives) {
    const positions = readPositions(primitive.attributes.POSITION);
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.length; i += 3) importBounds.expandByPoint(point.fromArray(positions, i).applyMatrix4(matrix));
    importedTriangles += document.accessors[primitive.indices].count / 3;
  }
  for (const child of node.children || []) importNode(child, matrix);
}
for (const node of document.scenes[document.scene].nodes) importNode(node, new THREE.Matrix4());
const boundsToleranceMillimetres = 0.001;
for (const bound of ['min', 'max']) for (let axis = 0; axis < 3; axis++) {
  if (Math.abs(importBounds[bound].getComponent(axis) * 1000 - geometry.boundsMillimetres[bound][axis]) > boundsToleranceMillimetres) throw new Error('Reimported GLB bounds differ from source geometry.');
}
if (importedTriangles !== geometry.triangleCount) throw new Error('Reimported GLB triangle count differs.');
const objFaceCount = (obj.obj.match(/^f /gm) || []).length;
if (objFaceCount !== geometry.triangleCount) throw new Error('OBJ face count differs from source geometry.');
geometry.glb = { validContainer: true, reimportedBoundsMatch: true, boundsToleranceMillimetres, reimportedTriangleCount: importedTriangles, meshCount: document.meshes.length, materialCount: document.materials.length, nodeCount: document.nodes.length, animations: document.animations?.map(clip => clip.name) || [] };
geometry.objFaceCount = objFaceCount;
geometry.files = { 'shower-C2.obj': new TextEncoder().encode(obj.obj).byteLength, 'shower-C2.mtl': new TextEncoder().encode(obj.mtl).byteLength, 'shower-C2.stl': stl.byteLength, 'shower-C2.glb': glb.byteLength };
geometry.limits = 'Geometry inspection checks file structure and finite bounds only. No pressure, dose, fit, manifold, fatigue, or user suitability validation.';
await writeFile(join(directory, 'geometry-check.json'), JSON.stringify(geometry, null, 2) + '\n');
await writeFile(join(directory, 'parts-C2.json'), JSON.stringify({
  sourceUnits: 'millimetres', dimensions: model.dimensions,
  parts: (model.parts || []).map(({ id, label, category, description, object }) => ({ id, label, category, description, objectName: object?.name })),
}, null, 2) + '\n');
console.log(JSON.stringify({ exported: Object.keys(geometry.files), meshes: geometry.meshCount, triangles: geometry.triangleCount, boundsMillimetres: geometry.boundsMillimetres, animations: geometry.glb.animations }, null, 2));
