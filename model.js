/* C2 concept geometry, units: millimetres. No measured component or pressure rating
   is represented by these dimensions. Paddles and valve cores demonstrate states;
   the commercial latch/valve and the Venturi must be selected and bench-tested. */
export function createShowerModel(THREE) {
  const root = new THREE.Group();
  root.name = 'Shower_Adaptif_C2_Konsep_mm';
  const parts = [];
  const material = (name, color, metalness = 0, roughness = 0.45, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({color, metalness, roughness, ...extra});
    m.name = name; return m;
  };
  const mats = {
    shell: material('PETG_casing_konsep', 0xe7eceb, 0.03, .34),
    grip: material('Grip_lunak_lepas', 0x53616a, .02, .88),
    blue: material('Kontrol_AIR_biru', 0x1289cb, .12, .3),
    orange: material('Kontrol_SABUN_oranye', 0xf47721, .04, .35),
    steel: material('Pipa_asli_logam', 0xb7c6cf, .86, .24),
    steelDark: material('Fitting_logam', 0x6d7f89, .78, .32),
    brass: material('Rumah_katup_komersial_skema', 0xc6a966, .66, .28),
    core: material('Inti_katup_dengan_lubang', 0xd6e3e7, .88, .2),
    seal: material('Seal_skema', 0x27383c, .02, .75),
    water: material('Jalur_air', 0x2b9fce, .05, .23, {transparent:true, opacity:.73}),
    soapTube: material('Selang_hisap_sabun', 0xee7d29, .04, .38),
    clear: material('Kartrid_transparan', 0xb6e0dd, .05, .15, {transparent:true, opacity:.28, depthWrite:false}),
    liquid: material('Isi_sabun_ilustrasi', 0xe1aa3c, .01, .28, {transparent:true, opacity:.7}),
    sponge: material('Spons_lepas', 0xa5c989, .0, .98),
    hose: material('Selang_air_berperingkat_skema', 0x596f7a, .15, .76),
  };
  function mesh(geo, mat, parent, name) {
    const o = new THREE.Mesh(geo,mat); o.name = name || ''; o.castShadow=true; o.receiveShadow=true;
    if(parent) parent.add(o); return o;
  }
  function group(name, label, category, description) {
    const g=new THREE.Group(); g.name=name; root.add(g);
    parts.push({id:name,label,category,description,object:g}); return g;
  }
  function roundedBox(w,h,d,r=3) {
    const s = new THREE.Shape(), x=-w/2, y=-h/2;
    r=Math.min(r,w/2,h/2);
    s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
    const g=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:false,curveSegments:8});
    g.translate(0,0,-d/2); return g;
  }
  function cyl(r,h,mat,parent,x=0,y=0,z=0,name='') {
    const m=mesh(new THREE.CylinderGeometry(r,r,h,32,1),mat,parent,name); m.position.set(x,y,z); return m;
  }
  function box(w,h,d,mat,parent,x=0,y=0,z=0,r=3,name='') {
    const m=mesh(roundedBox(w,h,d,r),mat,parent,name); m.position.set(x,y,z); return m;
  }
  function pipe(points,r,mat,parent,name='',segments=64) {
    const p=points.map(p=>p.isVector3?p:new THREE.Vector3(...p));
    const curve=new THREE.CatmullRomCurve3(p,false,'centripetal');
    const radial=12,raw=new THREE.TubeGeometry(curve,segments,r,radial,false);
    const vs=Array.from(raw.attributes.position.array),ix=Array.from(raw.index.array);
    // TubeGeometry deliberately leaves the ends open. Close both with proper faces
    // so exported individual hoses are closed solids rather than rendering skins.
    for(const end of [0,1]) {
      const center=curve.getPoint(end),normal=curve.getTangent(end).multiplyScalar(end?1:-1);
      const ci=vs.length/3;vs.push(center.x,center.y,center.z);
      const row=end?segments*(radial+1):0;
      for(let j=0;j<radial;j++) {
        const a=row+j,b=row+j+1;
        const av=new THREE.Vector3(vs[a*3],vs[a*3+1],vs[a*3+2]).sub(center);
        const bv=new THREE.Vector3(vs[b*3],vs[b*3+1],vs[b*3+2]).sub(center);
        if(av.cross(bv).dot(normal)>0)ix.push(ci,a,b);else ix.push(ci,b,a);
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));
    geo.setIndex(ix);geo.computeVertexNormals();raw.dispose();
    return mesh(geo,mat,parent,name);
  }
  function along(a,b,r,mat,parent,name='') {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
    const m=cyl(r,v.length(),mat,parent,0,0,0,name);m.position.copy(av.add(bv).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;
  }
  // Revolve a closed radial profile around Y; cut faces close a sector when angle<2PI.
  function revolve(profile,steps=40,start=0,angle=Math.PI*2) {
    const vs=[],ix=[],n=profile.length;
    for(let j=0;j<=steps;j++) {
      const a=start+angle*j/steps;
      for(const [r,y] of profile)vs.push(r*Math.cos(a),y,r*Math.sin(a));
    }
    for(let j=0;j<steps;j++)for(let k=0;k<n;k++) {
      const kn=(k+1)%n,a=j*n+k,b=(j+1)*n+k,c=(j+1)*n+kn,d=j*n+kn;
      ix.push(a,b,d,b,c,d);
    }
    if(angle<Math.PI*2-.001) {
      const triang=THREE.ShapeUtils.triangulateShape(profile.map(([r,y])=>new THREE.Vector2(r,y)),[]);
      for(const f of triang){ix.push(f[2],f[1],f[0]);ix.push(steps*n+f[0],steps*n+f[1],steps*n+f[2]);}
    }
    // Radial profiles can be supplied in either direction. Normalize closed-solid
    // winding so the outer faces survive back-face culling and export consistently.
    let volume=0;
    for(let i=0;i<ix.length;i+=3){
      const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
      volume+=(vs[a]*(vs[b+1]*vs[c+2]-vs[b+2]*vs[c+1])+vs[a+1]*(vs[b+2]*vs[c]-vs[b]*vs[c+2])+vs[a+2]*(vs[b]*vs[c+1]-vs[b+1]*vs[c]))/6;
    }
    if(volume<0)for(let i=0;i<ix.length;i+=3){const a=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=a;}
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));
    g.setIndex(ix);g.computeVertexNormals();return g;
  }
  function tube(ro,ri,h,mat,parent,x,y,z,name='') {
    const m=mesh(revolve([[ro,-h/2],[ro,h/2],[ri,h/2],[ri,-h/2]],40),mat,parent,name);
    m.position.set(x,y,z);return m;
  }
  function ballWithBore(R,bore,mat,parent,name) {
    const h=Math.sqrt(R*R-bore*bore),profile=[];
    const max=Math.acos(h/R),min=Math.PI-max;
    for(let i=0;i<=22;i++){const a=max+(min-max)*i/22;profile.push([R*Math.sin(a),R*Math.cos(a)]);}
    const m=mesh(revolve(profile,40),mat,parent,name); return m;
  }
  // Smooth variable-section hollow PETG halves. Split at x=0, wall nominally 3 mm.
  function shellHalf(sign) {
    const rings=[[0,12.5,13],[8,17,18],[25,20,21.5],[58,21,22.5],
      [129,21,22.5],[168,17,19],[181,12.5,14],[190,9,10.5]];
    const steps=24,vs=[],ix=[],row=steps+1;
    for(let layer=0;layer<2;layer++)for(const [y,rx,rz] of rings)for(let j=0;j<=steps;j++){
      const a=-Math.PI/2+Math.PI*j/steps;
      vs.push(sign*(rx-layer*3)*Math.cos(a),y,(rz-layer*3)*Math.sin(a));
    }
    const surface=rings.length*row;
    for(let layer=0;layer<2;layer++)for(let k=0;k<rings.length-1;k++)for(let j=0;j<steps;j++){
      const a=layer*surface+k*row+j,b=a+row,c=b+1,d=a+1;
      const flip=(layer===1) !== (sign<0);
      if(flip)ix.push(a,d,b,d,c,b);else ix.push(a,b,d,b,c,d);
    }
    function quad(a,b,c,d,flip=false){if(flip)ix.push(a,d,b,b,d,c);else ix.push(a,b,d,b,c,d);}
    for(let k=0;k<rings.length-1;k++){
      for(const j of [0,steps]){const a=k*row+j,b=a+row;quad(a,b,b+surface,a+surface,(j===0)!==(sign<0));}
    }
    for(const k of [0,rings.length-1])for(let j=0;j<steps;j++){
      const a=k*row+j;quad(a,a+1,a+1+surface,a+surface,(k===0)!==(sign<0));
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));
    g.setIndex(ix);g.computeVertexNormals();return g;
  }

  const shellL=group('casing-kiri','Casing PETG kiri','casing','Selubung nominal dinding 3 mm. Bukan rumah saluran bertekanan.');
  const shellR=group('casing-kanan','Casing PETG kanan','casing','Belahan selubung dapat dibuka untuk servis dan melihat mekanisme.');
  mesh(shellHalf(-1),mats.shell,shellL,'Cangkang_kiri');
  mesh(shellHalf(1),mats.shell,shellR,'Cangkang_kanan');
  const grips=group('grip-lepas','Grip lunak lepas','casing','Lapisan genggam konseptual; bentuk dan ukurannya perlu uji tangan basah.');
  for(const side of [-1,1]) {
    const p=box(6,115,22,mats.grip,grips,side*19,101,-1,3,'Grip_'+(side>0?'kanan':'kiri'));
    p.rotation.y=side*.13;
    for(let k=0;k<8;k++){const rib=box(1.6,1.2,16,mats.grip,grips,side*22.2,61+k*11,-1,.5,'Tekstur_grip');}
  }
  const spine=group('rangka-internal','Rangka penahan modul','internal','Dudukan struktural ilustratif; jangan mengganti rumah katup komersial dengan cetakan.');
  box(9,147,5,mats.steelDark,spine,0,95,-13,2,'Tulang_dudukan');
  for(const y of [35,110,169])for(const x of [-11,11])cyl(2,4,mats.steelDark,spine,x,y,-10,'Boss_sekrup');
  const intake=group('jalur-air-gagang','Jalur air dalam gagang','air','Selang dan fitting air komersial terpisah dari casing PETG.');
  tube(5,3.4,93,mats.water,intake,-6,51.5,0,'Selang_air_bawah');
  tube(5,3.4,48,mats.water,intake,-6,165,0,'Selang_air_atas');
  const valveBody=group('rumah-katup-air','Rumah modul katup air','air','Representasi modul lengkap berperingkat yang belum dipilih. Geometri ini bukan desain katup produksi.');
  const waterHousing=tube(10.2,8.4,38,mats.brass,valveBody,-6,120,0,'Rumah_katup_air_skema');
  for(const y of [101,139])tube(7,3.8,5,mats.steelDark,valveBody,-6,y,0,'Port_air');
  const seats=group('seal-katup-air','Seal katup air (skema)','air','Seal terpisah di sekitar inti. Jenis seal dan tekanan operasi belum ditetapkan.');
  for(const y of [111.5,128.5])tube(8.3,4,2,mats.seal,seats,-6,y,0,'Dudukan_seal');
  const coreGroup=group('inti-katup-air','Inti katup air bergerak','mekanisme','Lubang inti sejajar jalur air saat buka; berputar menutup saat OFF. Ilustrasi keadaan katup.');
  coreGroup.position.set(-6,120,0);
  const waterCore=ballWithBore(8,3.9,mats.core,coreGroup,'Bola_berlubang_air');
  along([0,0,5],[0,0,18],2,mats.steelDark,coreGroup,'Poros_katup_air');
  const waterCam=mesh(new THREE.CylinderGeometry(6.8,6.8,2,32),mats.blue,coreGroup,'Cam_air_konseptual');
  waterCam.rotation.x=Math.PI/2;waterCam.position.z=16;
  box(2.8,10,2.8,mats.steelDark,coreGroup,0,4.5,18,1,'Lengan_cam_air');
  const waterButton=group('paddle-air','Paddle AIR','kontrol','Tekan sekali untuk buka/tutup. Bentuk latch dan gaya komponen nyata belum dipilih.');
  waterButton.position.set(-3,121,24);
  box(22,50,4.5,mats.blue,waterButton,0,25,0,6,'Bidang_tekan_AIR');
  along([-12,0,-1],[12,0,-1],1.7,mats.steelDark,waterButton,'Engsel_AIR');
  for(let i=0;i<5;i++)box(13,.8,.7,mats.blue,waterButton,0,35+i*2.3,2.55,.3,'Tekstur_AIR');
  const waterLink=group('penghubung-air','Penghubung paddle air (skema)','mekanisme','Penghubung gerak ilustratif. Kinematika latch produksi belum direkayasa.');
  along([-3,144,20],[-6,126,18],1.5,mats.steelDark,waterLink,'Batang_aktuator_AIR');
  box(8,10,5,mats.seal,waterLink,-6,146,13,1,'Modul_penahan_keadaan_skema');

  const soapValve=group('rumah-katup-sabun','Katup jalur isap sabun','sabun','Katup rapat udara untuk memilih SABUN/BILAS, bukan pompa takar.');
  const soapHousing=tube(6.5,4.7,25,mats.brass,soapValve,10,80,0,'Rumah_katup_isap');
  for(const y of [65.5,94.5])tube(4,2.2,5,mats.steelDark,soapValve,10,y,0,'Port_isap');
  const soapCoreGroup=group('inti-katup-sabun','Inti katup isap bergerak','mekanisme','Lubang sejajar saat mode SABUN; tertutup saat BILAS.');
  soapCoreGroup.position.set(10,80,0);
  const soapCore=ballWithBore(4.6,2.1,mats.core,soapCoreGroup,'Bola_berlubang_sabun');
  along([0,0,3],[0,0,18],1.3,mats.steelDark,soapCoreGroup,'Poros_pemilih_sabun');
  const soapCam=mesh(new THREE.CylinderGeometry(4.5,4.5,2,24),mats.orange,soapCoreGroup,'Cam_sabun_skema');
  soapCam.rotation.x=Math.PI/2;soapCam.position.z=17;
  const soapButton=group('paddle-sabun','Paddle SABUN/BILAS','kontrol','Pemilih dua keadaan menetap; tidak perlu ditahan. BILAS tidak langsung bebas sisa sabun.');
  soapButton.position.set(5,54,25);
  box(25,40,4.5,mats.orange,soapButton,0,20,0,6,'Bidang_tekan_SABUN');
  along([-13.5,0,-1],[13.5,0,-1],1.7,mats.steelDark,soapButton,'Engsel_SABUN');
  for(let i=0;i<4;i++)box(16,.8,.7,mats.orange,soapButton,0,27+i*2.2,2.55,.3,'Tekstur_SABUN');
  const soapLink=group('penghubung-sabun','Penghubung paddle sabun (skema)','mekanisme','Aktuator mengubah keadaan katup isap; tidak mendorong piston sabun.');
  along([5,80,20],[10,80,17],1.2,mats.steelDark,soapLink,'Batang_aktuator_SABUN');

  const podMount=group('dudukan-pod','Dudukan kartrid samping','casing','Kartrid lepas dari samping tanpa membuka sambungan air.');
  box(4,74,20,mats.steelDark,podMount,22,65,-4,2,'Rel_kartrid');
  box(20,6,25,mats.shell,podMount,33,23,-4,2,'Penopang_bawah_kartrid');
  for(const y of [35,94])box(5,8,26,mats.shell,podMount,23.5,y,-4,2,'Kait_pod');
  const soapCartridge=group('kartrid-sabun','Kartrid sabun lepas (~30 mL)','sabun','Volume luar hanya ilustrasi. Kartrid kaku memerlukan vent; pickup dan ketahanan saat dimiringkan belum dibuktikan.');
  soapCartridge.position.set(34,65,-4);
  box(22,74,24,mats.clear,soapCartridge,0,0,0,7,'Botol_kartrid');
  box(17,43,19,mats.liquid,soapCartridge,0,-11,0,5,'Isi_sabun');
  tube(3.6,2.3,64,mats.soapTube,soapCartridge,0,0,0,'Pipa_pickup');
  tube(9.8,7.2,6,mats.steelDark,soapCartridge,0,40,0,'Leher_kartrid');
  const cartridgeCap=group('tutup-kartrid','Tutup isi ulang + vent','sabun','Tutup dan vent terlindung merupakan konsep; prosedur pembersihan dan anti-tumpah perlu dirancang.');
  cartridgeCap.position.set(34,111,-4);
  cyl(10.7,7,mats.shell,cartridgeCap,0,0,0,'Tutup_kartrid');
  cyl(2.5,2,mats.steelDark,cartridgeCap,0,4.5,0,'Vent_terlindung_skema');
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;box(1.5,5,2,mats.grip,cartridgeCap,10.4*Math.cos(a),0,10.4*Math.sin(a),.5,'Gerigi_tutup');
  }
  const soapPickup=group('jalur-pod-ke-katup','Jalur kartrid ke pemilih','sabun','Sambungan konsep dengan jalur isap; tidak menghubungkan air bertekanan ke kartrid.');
  pipe([[34,103,-4],[28,103,-4],[10,103,0],[10,96,0]],2.6,mats.soapTube,soapPickup,'Selang_pickup_pemilih',28);
  const soapLine=group('selang-hisap-panjang','Selang hisap sabun eksternal','sabun','Panjang dan kekentalan meningkatkan hambatan. Uji seluruh rute, beda tinggi, priming, dan jeda bilas.');
  pipe([[10,64,0],[10,59,0],[22,59,0],[27,68,0],[27,183,0],[21,198,0],[17,475,0],[14,707,0],[18,722,0]],2.6,mats.soapTube,soapLine,'Selang_oranye_ke_Venturi',110);

  const baseFitting=group('fitting-masuk','Fitting masuk selang air','air','Fitting dan selang berperingkat perlu cocok dengan pasokan keran.');
  tube(8.5,3.6,16,mats.steelDark,baseFitting,-6,-2,0,'Fitting_pangkal');
  tube(10,4.2,7,mats.brass,baseFitting,-6,-12,0,'Mur_selang');
  for(let i=0;i<3;i++)tube(7,4.3,2,mats.steelDark,baseFitting,-6,-20-i*4,0,'Strain_relief');
  const hose=group('selang-air','Selang dari keran','air','Perlindungan aliran balik sesuai injeksi sabun wajib berada di sumber; tidak divisualisasikan sebagai check valve kecil di gagang.');
  const hosePoints=[[-6,-20,0],[-10,-57,-9],[4,-94,-33],[51,-106,-66],[99,-85,-80],[128,-50,-80]];
  pipe(hosePoints,6.2,mats.hose,hose,'Selang_air_fleksibel',66);
  const originalPipe=group('pipa-asli','Pipa atas asli - ukuran representatif','air','Pipa visual 520 mm; ukuran asli dan rating sambungan belum diukur. Panjang asli dipertahankan pada desain final.');
  const mainPipe1=tube(5.3,3.4,300,mats.steel,originalPipe,-6,340,0,'Batang_bawah_asli');
  const mainPipe2=tube(4.5,2.9,225,mats.steel,originalPipe,-6,597.5,0,'Batang_atas_asli');
  const collar=group('sambungan-pipa','Sambungan/teleskop pipa','air','Detail sambungan representatif; ulir dan ukuran perlu diukur.');
  for(const [y,r,h] of [[190,9,11],[204,6.8,10],[480,8,16],[491,6.8,7],[707,7,10]])tube(r,3.5,h,mats.steelDark,collar,-6,y,0,'Kolar_pipa');
  const clips=group('klip-selang','Klip selang sepanjang batang','casing','Klip menghindari loop longgar. Bentuk dan jepitan perlu diuji pada batang asli.');
  for(const y of [226,383,526,672]){
    const x=y<490?-6:-6;
    tube(6.9,5.5,5,mats.grip,clips,x,y,0,'Cincin_klip');
    box(20,5,6,mats.grip,clips,4,y,-3,1,'Jembatan_klip');
    tube(4.4,2.9,5,mats.grip,clips,y<490?18:15,y,0,'Mata_klip_sabun');
  }

  const mixerBack=group('venturi-belakang','Venturi - separuh belakang','campuran','Penampang fungsi konvergen/leher/difuser. Dimensi bukan desain fluida atau komponen terpilih.');
  const mixerFront=group('venturi-depan','Venturi - penutup depan','campuran','Dibuka pada mode potong untuk melihat prinsip pencampuran; gunakan injektor komersial untuk prototipe.');
  const profile=[[9.5,-19],[9.5,19],[5.1,19],[4.6,13],[2.0,0],[4.5,-13],[4.5,-19]];
  const venturiBack=mesh(revolve(profile,28,Math.PI,Math.PI),mats.steelDark,mixerBack,'Badan_Venturi_belakang');venturiBack.position.set(-6,729,0);
  const venturiFront=mesh(revolve(profile,28,0,Math.PI),mats.steelDark,mixerFront,'Badan_Venturi_depan');venturiFront.position.set(-6,729,0);
  const mixPort=group('port-isap-venturi','Port isap + check valve','campuran','Katup satu arah melindungi jalur kartrid. Ini bukan pengganti perlindungan sumber air.');
  along([2,729,0],[18,729,0],3.8,mats.brass,mixPort,'Port_isap_samping');
  const check=tube(5,2.3,11,mats.steelDark,mixPort,0,0,0,'Check_valve_isap_skema');
  check.rotation.z=-Math.PI/2;check.position.set(14,729,0);
  pipe([[18,722,0],[21,726,0],[20,729,0]],2.6,mats.soapTube,mixPort,'Selang_masuk_port_isap',18);
  const mixerNeck=group('leher-outlet','Leher outlet campuran','campuran','Jalur campuran sesudah Venturi dibuat pendek. Nozel asli bersyarat terhadap tekanan balik.');
  pipe([[-6,748,0],[-6,757,0],[-6,764,9],[-6,764,23]],6.1,mats.steel,mixerNeck,'Siku_pancuran',28);
  const head=group('kepala-pancuran','Outlet pancuran campuran','campuran','Outlet lembut representatif; luas lubang dan tekanan balik mengikuti komponen Venturi yang dipilih.');
  const headBody=cyl(17,11,mats.shell,head,-6,764,28,'Rumah_outlet');headBody.rotation.x=Math.PI/2;
  const face=cyl(15.1,2,mats.steelDark,head,-6,764,34,'Muka_pancuran');face.rotation.x=Math.PI/2;
  const holes=group('lubang-pancuran','Lubang muka pancuran (ilustrasi)','campuran','Titik lubang hanya petunjuk visual. Pola, debit, dan kenyamanan belum diuji.');
  const poreMat=material('Lubang_pancuran_visual',0x172e3b,.02,.7);
  for(let ring=0;ring<3;ring++){
    const n=ring===0?1:ring===1?8:14,r=ring*5;
    for(let k=0;k<n;k++){
      const a=2*Math.PI*k/n;const dot=cyl(.8,1,poreMat,holes,-6+r*Math.cos(a),764+r*Math.sin(a),35.2,'Lubang_semprot');
      dot.rotation.x=Math.PI/2;
    }
  }
  const sponge=group('spons-lepas','Spons lepas di sekitar kepala','casing','Tidak menutup muka semprot. Tambahan massa spons basah di ujung memengaruhi pergelangan.');
  const spongeRing=mesh(new THREE.TorusGeometry(22.5,5.5,10,44),mats.sponge,sponge,'Spons_cincin');
  spongeRing.position.set(-6,764,28); // torus defaults normal to +Z
  for(let i=0;i<22;i++){
    const a=i*Math.PI*2/22;const nub=mesh(new THREE.SphereGeometry(1.2,7,5),mats.sponge,sponge,'Tekstur_spons');
    nub.position.set(-6+26*Math.cos(a),764+26*Math.sin(a),29+(i%3));
  }

  const baseline = new Map();
  for(const p of parts) baseline.set(p.object,{position:p.object.position.clone(),rotation:p.object.rotation.clone()});
  function move(g,dx=0,dy=0,dz=0){const b=baseline.get(g);g.position.copy(b.position).add(new THREE.Vector3(dx,dy,dz));g.rotation.copy(b.rotation);}
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function setState(s={}) {
    const ex=clamp(Number(s.exploded)||0,0,1),cut=!!s.cutaway;
    const inspect=cut && ex<=.05;
    for(const [o,b] of baseline){o.position.copy(b.position);o.rotation.copy(b.rotation);o.visible=true;}
    move(shellL,-ex*68,0,0);move(shellR,ex*68,0,0);
    shellR.visible=!cut || ex>.05;
    // The remaining half stays opaque so the open face reads as a genuine cutaway.
    move(grips,0,0,ex*58);grips.visible=!cut || ex>.05;
    // Inspection-only removal: move the opaque paddles aside so they cannot hide
    // the valve cores from the front camera. This is not an operating movement.
    move(waterButton,inspect?-40:0,ex*8,ex*72+(inspect?22:0));
    move(soapButton,inspect?50:0,-ex*8,ex*72+(inspect?22:0));
    waterLink.visible=!cut;soapLink.visible=!cut;
    waterButton.rotation.x=-clamp(Number(s.waterPress)||0,0,1)*.11;
    soapButton.rotation.x=-clamp(Number(s.soapPress)||0,0,1)*.13;
    coreGroup.rotation.z=s.water?0:Math.PI/2;
    soapCoreGroup.rotation.z=s.soap?0:Math.PI/2;
    move(soapCartridge,ex*58+(s.cartridgeOut?42:0),0,0);
    move(cartridgeCap,ex*58+(s.cartridgeOut?42:0),ex*28+(s.capOpen?26:0),0);
    if(s.capOpen)cartridgeCap.rotation.z=-.34;
    move(podMount,ex*28,0,-ex*18);
    move(originalPipe,0,ex*45,0);move(collar,0,ex*45,0);move(clips,0,ex*45,0);
    move(mixerFront,0,ex*75,ex*44);move(mixerBack,0,ex*75,0);
    move(mixPort,ex*30,ex*75,0);move(mixerNeck,0,ex*94,0);
    move(head,0,ex*94,ex*38);move(holes,0,ex*94,ex*38);move(sponge,0,ex*94,ex*66);
    mixerFront.visible=!cut || ex>.05;
    for(const m of [waterHousing,soapHousing]) {m.material.transparent=cut;m.material.opacity=cut?.16:1;m.material.depthWrite=!cut;}
    // Each housing needs its own material; the original material was shared by ports.
    for(const p of [mainPipe1,mainPipe2]){p.material.transparent=cut;p.material.opacity=cut?.28:1;p.material.depthWrite=!cut;}
    return {water:!!s.water,soap:!!s.soap,exploded:ex,cutaway:cut};
  }
  // Do not mutate the shared metal/brass material when revealing internal valve cores.
  waterHousing.material=mats.brass.clone();soapHousing.material=mats.brass.clone();
  mainPipe1.material=mats.steel.clone();mainPipe2.material=mats.steel.clone();
  setState({water:false,soap:false,exploded:0,cutaway:false});
  const vec=points=>points.map(p=>new THREE.Vector3(...p));
  return {
    root,parts,
    actuators:{waterButton,soapButton,waterCore:coreGroup,soapCore:soapCoreGroup,soapCartridge,cartridgeCap,
      shellLeft:shellL,shellRight:shellR,venturiFront:mixerFront,venturiBack:mixerBack},
    dimensions:{units:'mm',handleLength:190,handleWidth:42,handleDepth:45,pipeVisualLength:520,
      estimatedPodVolumeMl:30,status:'Konsep; pipa 520 mm hanya representasi, bukan ukuran unit asli.'},
    paths:{
      waterPath:vec([[-6,-20,0],[-6,10,0],[-6,101,0],[-6,120,0],[-6,139,0],[-6,190,0],[-6,480,0],[-6,710,0],[-6,729,0]]),
      soapPath:vec([[34,53,-4],[34,103,-4],[10,103,0],[10,80,0],[10,59,0],[27,68,0],[27,183,0],[21,198,0],[17,475,0],[14,707,0],[20,729,0],[-6,729,0]]),
      mixedPath:vec([[-6,729,0],[-6,748,0],[-6,757,0],[-6,764,9],[-6,764,35],[-6,764,82]])
    },
    setState,
  };
}
