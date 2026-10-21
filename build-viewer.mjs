import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=(p)=>fs.readFileSync(path.join(here,p),'utf8');
const library=read('vendor/three.module.min.js');
const match=library.match(/export\{([^}]+)\};?\s*$/);
if(!match)throw new Error('Three.js export list not found');
const pairs=match[1].split(',').map(s=>{
  const [local,exposed]=s.trim().split(/\s+as\s+/);return `${exposed||local}:${local}`;
});
const three=`const THREE=(()=>{${library.slice(0,match.index)}\nreturn {${pairs.join(',')}};})();`;
const model=read('model.js').replace(/export\s+function\s+/g,'function ');
const viewer=read('viewer.js');
const bundle=`(()=>{\n${three}\n${model}\n${viewer}\nmountShowerViewer(THREE,createShowerModel);\n})();`;
new Function(bundle);
const fragment=read('viewer-fragment.html').replace('/*__SHOWER_BUNDLE__*/',()=>bundle.replace(/<\/script/gi,'<\\/script'));
if(Buffer.byteLength(fragment)>1000000)throw new Error('Inline fragment exceeds 1MB');
if(/(?:src|href)=["']https?:/.test(fragment))throw new Error('Unexpected external resource');
const inlineIndex=process.argv.indexOf('--inline');
if(inlineIndex>=0) {
 const visualPath=process.argv[inlineIndex+1];
 if(!visualPath)throw new Error('Missing --inline path');
 fs.mkdirSync(path.dirname(visualPath),{recursive:true});fs.writeFileSync(visualPath,fragment);
}
const css=read('vendor/viewer-ui.css');
const standalone='<!doctype html>\n<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Model 3D Shower Adaptif C2</title><style>'+css+'\nbody{margin:0;padding:22px;max-width:1120px;margin-inline:auto;font-family:system-ui,sans-serif;}'+
 '@media(max-width:480px){body{padding:12px;}}</style></head><body><main style="max-width:1120px;margin:22px auto;padding:0 18px">'+fragment+'</main></body></html>';
fs.writeFileSync(path.join(here,'viewer-shower-C2.html'),standalone);
console.log(JSON.stringify({fragmentBytes:Buffer.byteLength(fragment),viewerBytes:Buffer.byteLength(standalone),offline:true},null,2));
