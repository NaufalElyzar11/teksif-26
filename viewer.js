/* Interactive assembly study. State changes illustrate function, not a solved linkage or CFD. */
function mountShowerViewer(THREE, createShowerModel) {
  const rootEl = document.getElementById('shower-c2-viewer');
  if (!rootEl) return;
  const el = (id) => rootEl.querySelector('#sc-' + id);
  const canvas = el('canvas'), wrap = el('canvas-wrap');
  const defaults = {water:false,soap:false,cutaway:false,exploded:0,cartridgeOut:false,capOpen:false,flow:true};
  const saved = window.openai?.widgetState;
  const state = {...defaults,...(saved?.modelContent?.controls || {})};
  state.exploded = Math.min(1,Math.max(0,Number(state.exploded)||0));
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  } catch (error) {
    el('loading').textContent = 'WebGL tidak tersedia. Buka viewer dengan Chrome atau Edge, atau gunakan berkas GLB.';
    window.showerViewer = {error:String(error)};
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34,1,0.5,10000);
  const hemi = new THREE.HemisphereLight(0xffffff,0x8d9ba7,2.0); scene.add(hemi);
  function light(color,intensity,x,y,z) {
    const l = new THREE.DirectionalLight(color,intensity); l.position.set(x,y,z); scene.add(l);
  }
  light(0xffffff,3,350,800,600);
  light(0xc5e6ff,1.6,-500,250,-300);
  light(0xffffff,2,400,-200,200);
  const model = createShowerModel(THREE);
  const display = new THREE.Group(); display.rotation.z = -0.70; display.add(model.root); scene.add(display);
  const toWorld = (p) => p.clone().applyMatrix4(display.matrixWorld);
  display.updateMatrixWorld(true);
  const orbit = {yaw:0.44,pitch:0.20,radius:1300,target:toWorld(new THREE.Vector3(0,340,5))};
  let focusMode='full', chosenPart=null, press={water:0,soap:0}, animationFrame=0, lastTime=0;
  let tween=null, pulseStart={water:-10000,soap:-10000}, lastStateNote='';
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const theme = () => getComputedStyle(rootEl);
  function themeColor(name,fallback) {
    const color=theme().getPropertyValue(name).trim();
    const probe=document.createElement('span'); probe.style.color=color||fallback; rootEl.appendChild(probe);
    const resolved=getComputedStyle(probe).color; probe.remove(); return new THREE.Color(resolved);
  }
  const blue=new THREE.Color('#187fac'), orange=new THREE.Color('#ec7727');
  const fluidGroup = new THREE.Group(); fluidGroup.name='Aliran_skematis_bukan_CFD'; display.add(fluidGroup);
  const sourcePaths = model.paths || model;
  const curves = {};
  const flowMeshes = {};
  const flowDots = {};
  for (const [name,key,color] of [['water','waterPath',blue],['soap','soapPath',orange],['mixed','mixedPath',blue]]) {
    let pts=sourcePaths[key];
    if (!pts || pts.length<2) {
      pts=name==='water'?[new THREE.Vector3(0,-35,0),new THREE.Vector3(0,710,0)]:
          name==='soap'?[new THREE.Vector3(35,60,-4),new THREE.Vector3(15,710,0)]:
          [new THREE.Vector3(0,750,0),new THREE.Vector3(0,750,110)];
    }
    const curve=new THREE.CatmullRomCurve3(pts.map(p=>p.clone ? p.clone() : new THREE.Vector3(...p)),false,'centripetal');
    curves[name]=curve;
    const pathMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.min(160,pts.length*16),name==='mixed'?1.35:1.0,7,false),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.42,depthTest:false,depthWrite:false}));
    pathMesh.renderOrder=10; fluidGroup.add(pathMesh); flowMeshes[name]=pathMesh;
    flowDots[name]=[];
    for(let i=0;i<(name==='water'?16:9);i++) {
      const dot=new THREE.Mesh(new THREE.SphereGeometry(name==='mixed'?2.3:2.1,8,6),new THREE.MeshBasicMaterial({color,depthTest:false}));
      dot.renderOrder=11; fluidGroup.add(dot); flowDots[name].push(dot);
    }
  }
  // Shared spray from the same outlet. It is a schematic fan, not a predicted spray field.
  const spray = new THREE.Group(); fluidGroup.add(spray);
  const sprayEnd=new THREE.Vector3(-6,764,36);
  for(let i=0;i<7;i++) {
    const a=(i-3)*0.14;
    const p1=sprayEnd.clone(), p2=p1.clone().add(new THREE.Vector3(Math.sin(a)*70,-18+Math.abs(i-3)*3,100));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1,p2]),
      new THREE.LineBasicMaterial({color:blue,transparent:true,opacity:.28,depthTest:false}));
    line.renderOrder=9; spray.add(line);
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const parts=model.parts || [];
  for(const part of parts) {
    const opt=document.createElement('option'); opt.value=part.id; opt.textContent=part.label; el('part').appendChild(opt);
  }
  function partFor(object) {
    let o=object;
    while(o && o!==model.root.parent) {
      const found=parts.find(p=>p.object===o || p.id===o.userData?.partId);
      if(found)return found;
      o=o.parent;
    }
    return null;
  }
  function isWithin(o,parent) { while(o){if(o===parent)return true;o=o.parent;}return false; }
  function isVisible(o) { while(o){if(o.visible===false)return false;o=o.parent;}return true; }
  function renderCamera() {
    const cp=Math.cos(orbit.pitch),sp=Math.sin(orbit.pitch);
    camera.position.copy(orbit.target).add(new THREE.Vector3(Math.sin(orbit.yaw)*cp,sp,Math.cos(orbit.yaw)*cp).multiplyScalar(orbit.radius));
    camera.lookAt(orbit.target); camera.updateMatrixWorld();
  }
  function updateStatus() {
    let mode;
    if(!state.water)mode=state.soap?'MATI · sabun tetap dipilih':'MATI';
    else if(state.soap && state.cartridgeOut)mode='AIR · kartrid dilepas';
    else mode=state.soap?'AIR + SABUN':'BILAS';
    el('mode').textContent=mode;
    el('water').textContent=state.water?'AIR: nyala':'AIR: mati';
    el('soap').textContent=state.soap?'SABUN: buka':'SABUN: tutup';
    el('water').setAttribute('aria-pressed',String(state.water));
    el('soap').setAttribute('aria-pressed',String(state.soap));
    el('cutaway').checked=state.cutaway; el('flow').checked=state.flow;
    el('explode').value=Math.round(state.exploded*100);el('explode-value').textContent=Math.round(state.exploded*100)+'%';
    el('cartridge').textContent=state.cartridgeOut?'Pasang kartrid':'Lepas kartrid';
    el('cartridge').setAttribute('aria-pressed',String(state.cartridgeOut));
    el('cap').textContent=state.capOpen?'Tutup isi ulang':'Buka tutup isi ulang';
    el('cap').setAttribute('aria-pressed',String(state.capOpen));
    if(chosenPart) el('detail').textContent=chosenPart.label+' — '+chosenPart.description;
    else if(!state.water && state.soap)el('detail').textContent='Katup sabun tetap terbuka, tetapi tidak ada hisapan Venturi ketika air mati. Tidak ada interlock otomatis.';
    else if(state.cartridgeOut || state.capOpen)el('detail').textContent='Isi ulang ditunjukkan secara visual. Ulir, seal, konektor, dan ventilasi kartrid belum dirancang untuk fabrikasi.';
    else if(focusMode==='venturi'&&state.cutaway)el('detail').textContent='Kepala dan spons disisihkan pada tampilan ini agar leher Venturi terlihat. Bentuk saluran hanya menjelaskan prinsip.';
    else if(state.water && state.soap)el('detail').textContent='Air menarik sabun ke Venturi lalu keluar melalui outlet yang sama. Hisapan, konsentrasi, dan orientasi belum terbukti.';
    else if(lastStateNote)el('detail').textContent=lastStateNote;
    else el('detail').textContent='Putar: geser. Perbesar: gulir atau cubit. Klik paddle untuk mencoba kontrol.';
    for(const [name,id] of [['full','full'],['handle','handle'],['venturi','venturi']])el(id).setAttribute('aria-pressed',String(focusMode===name));
  }
  function persist() {
    const modelContent={concept:'C2',controls:{...state},focus:focusMode,selectedPart:chosenPart?.id||null};
    if(window.openai?.setWidgetState)window.openai.setWidgetState({modelContent,privateContent:null}).catch(()=>{});
  }
  function apply() {
    model.setState({...state,waterPress:press.water,soapPress:press.soap});
    display.updateMatrixWorld(true);
    updateStatus();requestRender();
  }
  function toggle(which) {
    chosenPart=null; el('part').value=''; state[which]=!state[which]; pulseStart[which]=performance.now();
    lastStateNote=which==='soap'&&!state.soap&&state.water?'BILAS dipilih. Pada alat nyata, sisa campuran perlu dibilas; jedanya belum diukur.':
      which==='water'&&!state.water?'AIR berhenti. Posisi katup sabun tidak berubah.':'';
    apply();persist();
  }
  function cameraFocus(mode,part=null,instant=false) {
    focusMode=mode;
    display.updateMatrixWorld(true);
    let target,radius,yaw,pitch;
    if(part) {
      const b=new THREE.Box3().setFromObject(part.object);target=b.getCenter(new THREE.Vector3());
      radius=Math.max(155,b.getSize(new THREE.Vector3()).length()*2.3);yaw=.52;pitch=.12;
    } else if(mode==='handle') {target=toWorld(new THREE.Vector3(8,101,5));radius=330*(1+state.exploded*.5);yaw=.35;pitch=.08;}
    else if(mode==='venturi') {target=toWorld(new THREE.Vector3(-6,729,1));radius=160;yaw=.40;pitch=.04;}
    else {target=toWorld(new THREE.Vector3(0,345,5));radius=innerWidth<500?1550:1300;yaw=.44;pitch=.20;}
    if(instant||reducedMotion) {Object.assign(orbit,{target,radius,yaw,pitch});tween=null;}
    else tween={start:performance.now(),from:{target:orbit.target.clone(),radius:orbit.radius,yaw:orbit.yaw,pitch:orbit.pitch},to:{target,radius,yaw,pitch}};
    updateStatus();requestRender();
  }
  for(const id of ['full','handle','venturi'])el(id).addEventListener('click',()=>{chosenPart=null;cameraFocus(id);persist();});
  el('water').addEventListener('click',()=>toggle('water'));
  el('soap').addEventListener('click',()=>toggle('soap'));
  el('cutaway').addEventListener('change',()=>{state.cutaway=el('cutaway').checked;apply();persist();});
  el('flow').addEventListener('change',()=>{state.flow=el('flow').checked;apply();persist();});
  el('explode').addEventListener('input',()=>{state.exploded=Number(el('explode').value)/100;apply();if(focusMode==='handle')cameraFocus('handle',null,true);});
  el('explode').addEventListener('change',persist);
  el('cartridge').addEventListener('click',()=>{state.cartridgeOut=!state.cartridgeOut;chosenPart=null;apply();persist();});
  el('cap').addEventListener('click',()=>{state.capOpen=!state.capOpen;chosenPart=null;apply();persist();});
  el('part').addEventListener('change',()=>{chosenPart=parts.find(p=>p.id===el('part').value)||null;if(chosenPart)cameraFocus('part',chosenPart);else updateStatus();persist();});
  el('reset').addEventListener('click',()=>{
    Object.assign(state,defaults);press={water:0,soap:0};chosenPart=null;lastStateNote='';el('part').value='';
    apply();cameraFocus('full');persist();
  });
  const fingers=new Map();let down=null,lastPinch=0;
  canvas.addEventListener('pointerdown',(e)=>{
    canvas.setPointerCapture(e.pointerId);fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(fingers.size===1)down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,drag:false,button:e.button};
    if(fingers.size===2){const[a,b]=[...fingers.values()];lastPinch=Math.hypot(a.x-b.x,a.y-b.y);if(down)down.drag=true;}
    tween=null;
  });
  canvas.addEventListener('pointermove',(e)=>{
    if(!fingers.has(e.pointerId))return;
    fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(fingers.size===2){const[a,b]=[...fingers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)orbit.radius=Math.max(85,Math.min(2400,orbit.radius*lastPinch/d));lastPinch=d;}
    else if(down){
      const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;
      if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)down.drag=true;
      if(e.shiftKey||down.button===2){
        const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
        orbit.target.addScaledVector(right,-dx*orbit.radius*.001).addScaledVector(up,dy*orbit.radius*.001);
      }else {orbit.yaw-=dx*.008;orbit.pitch=Math.min(1.4,Math.max(-1.4,orbit.pitch+dy*.006));}
      down.lastX=e.clientX;down.lastY=e.clientY;
    }
    requestRender();
  });
  canvas.addEventListener('pointerup',(e)=>{
    fingers.delete(e.pointerId);
    if(down&&!down.drag&&fingers.size===0){
      const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
      raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(model.root,true).find(h=>isVisible(h.object));
      if(hit){
        const a=model.actuators||{};
        if(isWithin(hit.object,a.waterButton))toggle('water');
        else if(isWithin(hit.object,a.soapButton))toggle('soap');
        else {chosenPart=partFor(hit.object);el('part').value=chosenPart?.id||'';updateStatus();persist();}
      }
    }
    if(!fingers.size)down=null;requestRender();
  });
  canvas.addEventListener('pointercancel',()=>{fingers.clear();down=null;});
  canvas.addEventListener('contextmenu',(e)=>e.preventDefault());
  canvas.addEventListener('wheel',(e)=>{e.preventDefault();tween=null;orbit.radius=Math.max(85,Math.min(2400,orbit.radius*Math.exp(e.deltaY*.001)));requestRender();},{passive:false});
  function selectedLabel() {
    if(!chosenPart){el('label').hidden=true;return;}
    const b=new THREE.Box3().setFromObject(chosenPart.object),v=b.getCenter(new THREE.Vector3()).project(camera);
    const label=el('label');label.textContent=chosenPart.label;label.hidden=v.z>1;
    label.style.left=Math.max(8,Math.min(wrap.clientWidth-230,(v.x*.5+.5)*wrap.clientWidth+12))+'px';
    label.style.top=Math.max(8,Math.min(wrap.clientHeight-45,(-v.y*.5+.5)*wrap.clientHeight-20))+'px';
  }
  function frame(time) {
    animationFrame=0;let moving=false;
    for(const key of ['water','soap']) {
      const age=time-pulseStart[key];press[key]=age<260?Math.sin(age/260*Math.PI):0;
      if(age<260)moving=true;
    }
    if(tween) {
      const t=Math.min(1,(time-tween.start)/340),f=1-Math.pow(1-t,3),a=tween.from,b=tween.to;
      orbit.target.copy(a.target).lerp(b.target,f);
      for(const k of ['radius','yaw','pitch'])orbit[k]=a[k]+(b[k]-a[k])*f;
      if(t===1)tween=null;else moving=true;
    }
    model.setState({...state,waterPress:press.water,soapPress:press.soap});
    const inspectMixer=focusMode==='venturi'&&state.cutaway;
    if(inspectMixer)for(const id of ['kepala-pancuran','lubang-pancuran','spons-lepas']){
      const p=parts.find(p=>p.id===id);if(p)p.object.visible=false;
    }
    renderCamera();
    const active=state.flow&&state.water;
    const soapActive=active&&state.soap&&!state.cartridgeOut;
    fluidGroup.visible=active;
    flowMeshes.soap.visible=soapActive;
    for(const [key,dots] of Object.entries(flowDots)) {
      const visible=key==='soap'?soapActive:active;
      const c=key==='mixed'&&soapActive?orange:blue;
      flowMeshes[key].material.color.copy(key==='soap'?orange:c);
      dots.forEach((dot,i)=>{
        dot.visible=visible;
        const t=(i/dots.length+(reducedMotion?0:time*.00016))%1;
        dot.position.copy(curves[key].getPointAt(t));dot.material.color.copy(key==='soap'?orange:c);
      });
    }
    spray.children.forEach(l=>l.material.color.copy(soapActive?orange:blue));
    spray.visible=!inspectMixer;
    if(inspectMixer){flowMeshes.mixed.visible=false;flowDots.mixed.forEach(d=>d.visible=false);}
    // Exploded inspection separates reference parts; flow remains a reference-route overlay.
    if(state.exploded>.02)fluidGroup.visible=false;
    renderer.render(scene,camera);selectedLabel();lastTime=time;
    if(moving||(active&&!reducedMotion&&state.exploded<=.02))requestRender();
  }
  function requestRender(){if(!animationFrame)animationFrame=requestAnimationFrame(frame);}
  const observer=new ResizeObserver(()=>{
    if(!wrap.clientWidth||!wrap.clientHeight)return;
    renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);camera.aspect=wrap.clientWidth/wrap.clientHeight;camera.updateProjectionMatrix();requestRender();
  });observer.observe(wrap);
  new MutationObserver(requestRender).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
  window.addEventListener('openai:set_globals',(e)=>{
    const s=e.detail?.globals?.widgetState?.modelContent?.controls;
    if(s){Object.assign(state,defaults,s);apply();}
  });
  el('loading').hidden=true;
  apply();cameraFocus('full',null,true);
  window.showerViewer={
    getState:()=>({...state}), getModel:()=>model,
    getSceneInfo:()=>({meshCount:parts.length,renderer:renderer.info.render,focus:focusMode,cameraRadius:orbit.radius}),
    projectControl:(which)=>{
      display.updateMatrixWorld(true);renderCamera();
      const obj=which==='water'?model.actuators.waterButton:model.actuators.soapButton;
      const v=new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).project(camera),r=canvas.getBoundingClientRect();
      return {x:r.left+(v.x*.5+.5)*r.width,y:r.top+(-v.y*.5+.5)*r.height};
    },
    focus:(s)=>cameraFocus(s,null,true),
    setState:(s)=>{Object.assign(state,s);apply();},
    dispose:()=>{cancelAnimationFrame(animationFrame);observer.disconnect();renderer.dispose();}
  };
}
