import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const dir='/workspace/prop-hunt/site/models'; const L=new GLTFLoader(); let tot=0, n=0;
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb'))) {
  const buf=fs.readFileSync(dir+'/'+f); const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  await new Promise(r=>L.parse(ab,'',g=>{let meshes=0,maps=0,mats=new Set();g.scene.traverse(o=>{if(o.isMesh){meshes++;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{mats.add(m.name);if(m.map)maps++;});}});tot+=meshes;n++; if(maps||meshes>4) console.log(f,meshes,maps,[...mats].join(','));r();},()=>r()));
}
console.log('avg meshes', (tot/n).toFixed(2));
