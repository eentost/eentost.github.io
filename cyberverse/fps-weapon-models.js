/* CyberVerse FPS viewmodel v3: detailed original procedural PBR firearms.
 * Standalone visual module; ballistics, damage and gameplay remain unchanged.
 * Units are stylized game-space, no external asset fetch is required.
 */
import * as THREE from "three";
export function buildWeaponModel(kind){
  const root=new THREE.Group();
  const pistol=kind==="pistol",shotgun=kind==="shotgun",sniper=kind==="sniper",dmr=kind==="dmr",smg=kind==="smg",lmg=kind==="lmg";
  const compact=pistol||smg,precision=sniper||dmr;
  const length=pistol?.48:smg?.82:shotgun?1.28:sniper?1.75:dmr?1.47:lmg?1.53:1.18;
  const matte=new THREE.MeshStandardMaterial({color:0x20272a,roughness:.63,metalness:.53});
  const black=new THREE.MeshStandardMaterial({color:0x10191d,roughness:.38,metalness:.78});
  const graphite=new THREE.MeshStandardMaterial({color:0x384447,roughness:.48,metalness:.68});
  const accent=new THREE.MeshStandardMaterial({color:kind==="smg"?0x236c70:precision?0x9c8262:kind==="shotgun"?0x7a5942:0x4b6256,roughness:.66,metalness:.22});
  const rubber=new THREE.MeshStandardMaterial({color:0x171d1d,roughness:.93,metalness:.04});
  const brass=new THREE.MeshStandardMaterial({color:0xbca16a,roughness:.27,metalness:.84});
  const glass=new THREE.MeshPhysicalMaterial({color:0x0e4b59,roughness:.12,metalness:.3,transparent:true,opacity:.83,clearcoat:1});
  const skin=new THREE.MeshStandardMaterial({color:0x363f38,roughness:.95,metalness:0});
  const mats={matte,black,graphite,accent,rubber,brass,glass,skin};
  function block(x,y,z,w,h,d,material=matte,parent=root){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
  }
  function tube(x,y,z,r,h,material=black,axis="z",r2=r,parent=root){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,h,16),material);
    m.rotation.x=axis==="z"?Math.PI/2:0;m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
  }
  function rail(z1,z2,y=.185){
    const d=Math.abs(z2-z1);
    block(0,y,(z1+z2)/2,.19,.045,d,black);
    for(let z=z1;z>z2;z-=.067)block(0,y+.035,z,.21,.026,.035,graphite);
  }
  const receiver=block(0,0,-.28,pistol?.20:.25,pistol?.19:.25,compact?.40:.62,graphite);
  block(0,.075,-.28,.26,.075,compact?.38:.57,matte);
  block(0,-.16,-.16,.15,.35,.19,rubber).rotation.x=-.22;
  block(0,-.04,-.29,.27,.045,.25,black);
  if(!pistol){
    // Buttstock, cheek riser and rear recoil pad.
    const stock=block(0,-.025,.15,.17,.15,.46,matte);
    stock.rotation.x=-.06;
    block(0,-.02,.40,.23,.28,.085,rubber);
    block(0,.115,.24,.19,.08,.27,accent);
    for(const side of [-1,1])block(side*.092,-.07,.27,.018,.14,.20,graphite);
  }
  // Angular receiver panels and realistic controls.
  for(const side of [-1,1]){
    block(side*.135,.02,-.29,.015,.15,.40,matte);
    block(side*.146,.065,-.13,.012,.04,.08,brass);
    tube(side*.157,-.045,-.24,.031,.02,black,"x");
    block(side*.14,-.01,-.40,.018,.035,.12,accent);
  }
  const foreLength=length*(pistol?.34:.52);
  const frontZ=-.48-foreLength/2;
  block(0,.018,frontZ,shotgun?.30:.275,.21,foreLength,accent);
  for(const side of [-1,1]){
    block(side*.145,.025,frontZ,.02,.15,foreLength*.91,black);
    for(let i=0;i<7;i++)block(side*.161,.025,frontZ+(i-3)*foreLength/9,.012,.082,.018,graphite);
  }
  const muzzleZ=-.48-foreLength;
  tube(0,.025,muzzleZ-.13,shotgun?.066:.038,.44,black);
  tube(0,.025,muzzleZ-.35,shotgun?.082:.058,.13,graphite);
  tube(0,.025,muzzleZ-.423,shotgun?.051:.028,.014,black);
  if(!pistol)rail(-.12,muzzleZ+.16,.175);
  // Front and rear flip-up sights; precision weapons carry optic assembly.
  if(!precision){
    block(0,.25,muzzleZ+.14,.085,.13,.055,black);
    block(0,.28,-.16,.09,.12,.06,black);
    block(0,.315,-.16,.065,.025,.045,brass);
  }else{
    block(0,.25,-.40,.17,.055,.40,black);
    tube(0,.34,-.42,.115,.55,matte);
    tube(0,.34,-.14,.124,.055,black);
    tube(0,.34,-.70,.13,.055,black);
    tube(0,.34,-.73,.098,.018,glass);
    tube(0,.34,-.10,.088,.018,glass);
    for(const side of [-1,1])block(side*.095,.22,-.4,.036,.1,.045,graphite);
  }
  if(smg||kind==="rifle"||kind==="carbine"){
    // Holographic sight with tinted glass and protective housing.
    block(0,.255,-.38,.18,.055,.23,black);
    for(const side of [-1,1])block(side*.078,.35,-.38,.022,.17,.06,black);
    block(0,.435,-.38,.17,.024,.075,black);
    block(0,.35,-.39,.125,.11,.012,glass);
  }
  if(lmg){
    block(0,-.18,-.4,.34,.27,.36,accent);
    for(let i=0;i<6;i++)tube(-.13+i*.052,-.32,-.44,.018,.16,brass,"y");
    for(const side of [-1,1]){
      const bipod=block(side*.14,-.15,muzzleZ+.16,.025,.32,.03,black);
      bipod.rotation.z=side*.21;
    }
  }
  if(shotgun){
    block(0,-.085,muzzleZ+.25,.25,.14,.38,graphite);
    for(let i=0;i<4;i++)block(0,-.085,muzzleZ+.12+i*.072,.26,.015,.025,rubber);
  }
  const magazine=new THREE.Group();magazine.position.set(0,-.18,-.36);root.add(magazine);
  if(shotgun){
    tube(0,-.04,-.60,.044,.42,accent);
  }else{
    block(0,-.16,0,pistol?.12:lmg?.29:.18,pistol?.28:lmg?.33:.39,.19,accent,magazine).rotation.x=-.11;
    block(0,-.36,.03,pistol?.13:lmg?.30:.19,.06,.21,black,magazine);
    for(const side of [-1,1])for(let i=0;i<7;i++)
      block(side*(pistol?.066:lmg?.15:.093),-.10-i*.042,0,.007,.018,.13,graphite,magazine);
  }
  // Visible gloved hands with rounded knuckles, cuff and individual fingers.
  const hands=new THREE.Group();root.add(hands);
  function glove(x,y,z,side){
    const hand=new THREE.Group();hand.position.set(x,y,z);hands.add(hand);
    const palm=new THREE.Mesh(new THREE.SphereGeometry(.12,12,9),skin);palm.scale.set(1.15,.8,1.3);hand.add(palm);
    block(0,-.12,.055,.22,.14,.21,accent,hand);
    for(let i=0;i<4;i++){
      const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.026,.115,3,6),skin);
      finger.rotation.x=.75;finger.position.set((i-1.5)*.055,-.02,-.13);hand.add(finger);
    }
    const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.034,.085,3,6),skin);
    thumb.rotation.z=side*.72;thumb.position.set(side*.12,-.02,-.02);hand.add(thumb);
  }
  glove(.14,-.22,-.15,1);
  glove(-.15,-.14,frontZ,-1);
  root.userData.magazine=magazine;
  root.userData.hands=hands;
  root.userData.muzzleZ=muzzleZ-.42;
  root.userData.materials=mats;
  root.position.set(.38,-.36,-.58);
  return root;
}
