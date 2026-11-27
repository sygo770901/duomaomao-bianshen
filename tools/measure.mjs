import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const dir = process.argv[2]; const names = process.argv.slice(3);
const L = new GLTFLoader();
for (const n of names) {
  const buf = fs.readFileSync(`${dir}/${n}.glb`);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  await new Promise(r => L.parse(ab, '', g => { const b = new THREE.Box3().setFromObject(g.scene); const s = b.getSize(new THREE.Vector3()).multiplyScalar(2.2); console.log(n.padEnd(26), s.x.toFixed(2), s.y.toFixed(2), s.z.toFixed(2)); r(); }, e => { console.log(n, 'ERR', e.message); r(); }));
}
