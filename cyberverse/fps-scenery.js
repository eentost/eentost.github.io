/* FPS scene themes with visually distinct landmark geometry beyond collidable arena.
 * Decorations do not change network or bot collision meshes. */
import * as THREE from "three";
export function createFpsScenery({world}){
  const groups=new Map(),g=(name)=>{const o=new THREE.Group();o.name="Scenery "+name;world.add(o);groups.set(name,o);return o;};
  const matte=(c,metal=.1)=>new THREE.MeshStandardMaterial({color:c,roughness:.84,metalness:metal});
  const container=matte(0x4c6971,.4),gray=matte(0x7d8582),sand=matte(0xb9a37c),dark=matte(0x233b4e,.35);
  const neon=new THREE.MeshBasicMaterial({color:0x6bc9e0});
  function block(group,x,y,z,w,h,d,material){
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    o.position.set(x,y,z);group.add(o);return o;
  }
  function tube(group,x,y,z,rt,rb,height,m){
    const a=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,height,10),m);
    a.position.set(x,y,z);group.add(a);return a;
  }
  const industrial=g("industrial");
  for(const x of [-48,48]){
    for(let i=0;i<9;i++){
      const z=-40+i*10,h=8+i%4*3;
      block(industrial,x,h/2,z,5,h,5,gray);
      block(industrial,x,h+.5,z,6,.35,6,container);
    }
    tube(industrial,x,16,-45,1.2,1.6,32,gray);
    tube(industrial,x,21,-45,1.35,1.35,2.4,container);
  }
  const night=g("night");
  for(const x of [-58,-49,-40,40,49,58])for(const z of [-50,-33,-16,16,33,50]){
    const h=9+((Math.abs(x)+Math.abs(z))%5)*7;
    block(night,x,h/2,z,6,h,7,dark);
    for(let row=2;row<h;row+=3){
      block(night,x,row,z<0?z+3.54:z-3.54,4,.17,.08,neon);
    }
  }
  for(const x of [-44,44]){
    const crane=new THREE.Group();crane.position.set(x,0,-18);night.add(crane);
    block(crane,0,17,0,.8,34,.8,gray);
    block(crane,0,34,0,20,.65,.7,container);
    block(crane,10,28,0,.07,12,.07,gray);
  }
  const rain=g("rain");
  for(const x of [-45,45]){
    for(let i=-4;i<=4;i++){
      const z=i*12;
      block(rain,x,3.5,z,7,7,9,container);
      block(rain,x,7.2,z,7.5,.36,9.5,gray);
      for(let j=0;j<4;j++)block(rain,x-2.7+j*1.8,4,z<0?z+4.52:z-4.52,.06,4.4,.08,dark);
    }
    tube(rain,x,18,38,1.4,1.9,36,gray);
  }
  const desert=g("desert");
  const duneMat=matte(0xcab78c),rock=matte(0x8d7b62);
  for(let i=0;i<42;i++){
    const a=i*2.4,r=55+(i%7)*3.3,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const h=3+(i%6)*1.4;
    const hill=new THREE.Mesh(new THREE.ConeGeometry(4+(i%4)*2,h,8),i%4===0?rock:duneMat);
    hill.position.set(x,h/2-1,z);hill.rotation.y=i*.5;desert.add(hill);
  }
  for(const x of [-45,45]){
    block(desert,x,4,0,6,8,10,rock);
    block(desert,x,8.25,0,8,.5,12,sand);
    tube(desert,x,14,0,.55,.55,12,gray);
  }
  let selected="industrial";
  function setTheme(name){selected=groups.has(name)?name:"industrial";for(const [id,o]of groups)o.visible=id===selected;}
  setTheme("industrial");
  return {setTheme,getTheme:()=>selected,themes:Array.from(groups.keys())};
}
