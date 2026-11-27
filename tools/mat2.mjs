import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const dir='/workspace/prop-hunt/site/models'; const L=new GLTFLoader(); const seen=new Map();
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb'))) {
  const buf=fs.readFileSync(dir+'/'+f); const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  await new Promise(r=>L.parse(ab,'',g=>{g.scene.traverse(o=>{if(o.isMesh){const m=o.material; seen.set(`${m.name} met=${m.metalness} rough=${m.roughness} tr=${m.transparent} op=${m.opacity} em=${m.emissive?.getHexString()}`, f);}});r();},()=>r()));
}
for (const [k,v] of seen) console.log(k, v);
