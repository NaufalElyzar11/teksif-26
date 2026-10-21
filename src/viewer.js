/* Interactive assembly study. State changes illustrate function, not a solved linkage or CFD. */
function mountShowerViewer(THREE, createShowerModel) {
  const rootEl = document.getElementById('shower-c2-viewer');
  if (!rootEl) return;
  const el = (id) => rootEl.querySelector('#sc-' + id);
  const canvas = el('canvas'), wrap = el('canvas-wrap');
  const defaults = {water:false,soap:false,cutaway:false,exploded:0,cartridgeOut:false,capOpen:false,flow:true};
  const state = {...defaults};
  state.exploded = Math.min(1,Math.max(0,Number(state.exploded)||0));
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  } catch (error) {
    rootEl.dataset.viewerState='unavailable';
    el('loading').textContent = 'Tampilan 3D tidak tersedia pada perangkat ini. Anda tetap dapat melihat ilustrasi dan mengunduh model GLB di bawah.';
    el('loading').setAttribute('role','status');
    const poster=el('poster');if(poster){poster.src=poster.dataset.src;poster.hidden=false;}
    rootEl.querySelectorAll('button,input,select').forEach(control=>{control.disabled=true;});
    el('detail').textContent='Coba gunakan Chrome atau Edge terbaru dengan dukungan WebGL untuk menjalankan demonstrasi interaktif.';
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
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion=motionPreference.matches;
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
    if(!state.water)mode=state.soap?'Air mati · sabun dipilih':'Air berhenti';
    else if(state.soap && state.cartridgeOut)mode='Air mengalir · kartrid dilepas';
    else mode=state.soap?'Air + sabun':'Air untuk bilas';
    el('mode').textContent=mode;
    rootEl.dataset.mode=state.water?(state.soap&&!state.cartridgeOut?'soap':'rinse'):'off';
    rootEl.dataset.service=String(state.cartridgeOut||state.capOpen);
    el('water').textContent=state.water?'Matikan air':'Nyalakan air';
    el('soap').textContent=state.soap?'Kembali ke bilas':'Gunakan sabun';
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
    else if(state.cartridgeOut || state.capOpen)el('detail').textContent='Tampilan isi ulang: pasokan air harus dihentikan pada alat nyata. Tutup, vent, dan sambungan kartrid masih berupa konsep.';
    else if(focusMode==='venturi'&&state.cutaway)el('detail').textContent='Kepala dan spons disisihkan pada tampilan ini agar leher Venturi terlihat. Bentuk saluran hanya menjelaskan prinsip.';
    else if(state.water && state.soap)el('detail').textContent='Air menarik sabun ke Venturi lalu keluar melalui outlet yang sama. Hisapan, konsentrasi, dan orientasi belum terbukti.';
    else if(lastStateNote)el('detail').textContent=lastStateNote;
    else el('detail').textContent='Nyalakan air untuk melihat aliran. Tambahkan sabun, lalu kembali ke bilas untuk mencoba urutan pemakaian.';
    for(const [name,id] of [['full','full'],['handle','handle'],['venturi','venturi']])el(id).setAttribute('aria-pressed',String(focusMode===name));
  }
  function persist() {
    // A new client visit starts at the reference pose. No accounts or saved data are needed.
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
  function fitAssembly(yaw,pitch) {
    const width=Math.max(120,wrap.clientWidth),height=Math.max(120,wrap.clientHeight);
    const temp=new THREE.PerspectiveCamera(34,width/height,.5,10000),points=[],bounds=new THREE.Box3();
    model.root.traverse(obj=>{
      if(!obj.isMesh||!isVisible(obj))return;
      if(!obj.geometry.boundingBox)obj.geometry.computeBoundingBox();
      const b=obj.geometry.boundingBox;
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(obj.matrixWorld);points.push(p);bounds.expandByPoint(p);
      }
    });
    const target=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    // Reserve space for corner controls and fit against the actual canvas, including phone widths.
    const left=20,right=20,top=width<480?70:40,bottom=32;
    const usableX=2*(width-left-right)/width,usableY=2*(height-top-bottom)/height;
    const desiredX=(left-right)/width,desiredY=(bottom-top)/height;
    let radius=1200;
    for(let pass=0;pass<4;pass++){
      temp.position.copy(target).addScaledVector(direction,radius);temp.lookAt(target);temp.updateMatrixWorld();
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const p of points){const v=p.clone().project(temp);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
      const scale=Math.max((maxX-minX)/usableX,(maxY-minY)/usableY);
      const hTan=Math.tan(34*Math.PI/360),xShift=((minX+maxX)/2-desiredX)*radius*hTan*width/height,yShift=((minY+maxY)/2-desiredY)*radius*hTan;
      target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(temp.matrixWorld,0),xShift)
            .addScaledVector(new THREE.Vector3().setFromMatrixColumn(temp.matrixWorld,1),yShift);
      radius=Math.max(300,Math.min(2400,radius*scale*1.03));
    }
    return {target,radius};
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
    else {yaw=.44;pitch=.20;({target,radius}=fitAssembly(yaw,pitch));}
    if(instant||reducedMotion) {Object.assign(orbit,{target,radius,yaw,pitch});tween=null;}
    else tween={start:performance.now(),from:{target:orbit.target.clone(),radius:orbit.radius,yaw:orbit.yaw,pitch:orbit.pitch},to:{target,radius,yaw,pitch}};
    updateStatus();requestRender();
  }
  for(const id of ['full','handle','venturi'])el(id).addEventListener('click',()=>{chosenPart=null;el('part').value='';cameraFocus(id);persist();});
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
  function zoom(factor){tween=null;orbit.radius=Math.max(85,Math.min(2400,orbit.radius*factor));requestRender();}
  el('zoom-in')?.addEventListener('click',()=>zoom(.82));
  el('zoom-out')?.addEventListener('click',()=>zoom(1.22));
  el('fit')?.addEventListener('click',()=>{chosenPart=null;el('part').value='';cameraFocus('full');});
  el('fullscreen')?.addEventListener('click',async()=>{
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else await wrap.requestFullscreen();
    }catch{el('detail').textContent='Layar penuh tidak tersedia pada browser ini. Tampilan model tetap dapat diputar dan diperbesar.';}
  });
  document.addEventListener('fullscreenchange',()=>{
    const control=el('fullscreen');if(control){control.setAttribute('aria-pressed',String(!!document.fullscreenElement));control.setAttribute('aria-label',document.fullscreenElement?'Keluar layar penuh':'Layar penuh');}
    requestRender();
  });
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','Model 3D shower adaptif. Geser untuk memutar, gulir atau cubit untuk memperbesar. Keyboard: tombol panah memutar, plus/minus memperbesar, angka 0 mengembalikan tampilan.');
  canvas.addEventListener('keydown',(e)=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;
    e.preventDefault();tween=null;
    if(e.key==='ArrowLeft')orbit.yaw-=.12;
    else if(e.key==='ArrowRight')orbit.yaw+=.12;
    else if(e.key==='ArrowUp')orbit.pitch=Math.min(1.4,orbit.pitch+.10);
    else if(e.key==='ArrowDown')orbit.pitch=Math.max(-1.4,orbit.pitch-.10);
    else if(e.key==='+'||e.key==='=')zoom(.85);
    else if(e.key==='-')zoom(1.18);
    else cameraFocus('full');
    requestRender();
  });
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
    flowMeshes.water.visible=active;
    flowMeshes.mixed.visible=active&&!inspectMixer;
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
    if(!document.hidden&&(moving||(active&&!reducedMotion&&state.exploded<=.02)))requestRender();
  }
  function requestRender(){if(!animationFrame)animationFrame=requestAnimationFrame(frame);}
  const observer=new ResizeObserver(()=>{
    if(!wrap.clientWidth||!wrap.clientHeight)return;
    renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);camera.aspect=wrap.clientWidth/wrap.clientHeight;camera.updateProjectionMatrix();
    if(focusMode==='full'&&!down)cameraFocus('full',null,true);
    requestRender();
  });observer.observe(wrap);
  new MutationObserver(requestRender).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRender();});
  motionPreference.addEventListener('change',()=>{reducedMotion=motionPreference.matches;requestRender();});
  canvas.addEventListener('webglcontextlost',(e)=>{e.preventDefault();cancelAnimationFrame(animationFrame);animationFrame=0;el('loading').hidden=false;el('loading').textContent='Tampilan 3D terhenti. Tunggu sebentar atau muat ulang halaman untuk melanjutkan.';});
  canvas.addEventListener('webglcontextrestored',()=>{el('loading').hidden=true;requestRender();});
  el('loading').hidden=true;
  rootEl.dataset.viewerState='ready';
  apply();cameraFocus('full',null,true);
  window.showerViewer={
    getState:()=>({...state}), getModel:()=>model,
    getSceneInfo:()=>({meshCount:parts.length,renderer:renderer.info.render,focus:focusMode,cameraRadius:orbit.radius,yaw:orbit.yaw,pitch:orbit.pitch,
      flow:{group:fluidGroup.visible,water:flowMeshes.water.visible,soap:flowMeshes.soap.visible,mixed:flowMeshes.mixed.visible}}),
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
