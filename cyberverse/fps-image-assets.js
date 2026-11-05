/* Real image-based environment materials for CyberVerse FPS.
 * CC0 Poly Haven Industrial Sunset HDRI; Three.js sample textures.
 * Remote failures retain the procedural scene and never block gameplay.
 */
import * as THREE from "three";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js";

export function createFpsImageAssets({scene,renderer,materials,onStatus=()=>{}}){
  const stats={sky:"loading",brick:"loading",floor:"loading"};
  const loader=new THREE.TextureLoader(),textureCache=[];
  let sky=null,active=false,theme="industrial";
  const hdrUrl="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_1k.hdr";
  const bricks="https://threejs.org/examples/textures/brick_diffuse.jpg";
  const brickBump="https://threejs.org/examples/textures/brick_bump.jpg";
  const floorUrl="https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_03/asphalt_03_diff_1k.jpg";
  function loadImage(url,repeat,apply,field){
    loader.load(url,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(...repeat);
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      textureCache.push(texture);
      apply(texture);stats[field]="ready";onStatus({...stats});
    },undefined,()=>{stats[field]="fallback";onStatus({...stats});});
  }
  loadImage(bricks,[2,2],texture=>{
    materials.wall.map=texture;materials.wall.color.set(0xffffff);materials.wall.needsUpdate=true;
  },"brick");
  loader.load(brickBump,texture=>{
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(2,2);
    textureCache.push(texture);
    materials.wall.bumpMap=texture;materials.wall.bumpScale=.035;materials.wall.needsUpdate=true;
  },undefined,()=>{});
  // Image-based fine surface detail layered into rough map. Fallback canvas remains.
  loadImage(floorUrl,[12,12],texture=>{
    // CC0 asphalt photo texture retains a realistic industrial surface.
    materials.ground.map=texture;materials.ground.color.set(0xffffff);materials.ground.needsUpdate=true;
  },"floor");
  new RGBELoader().load(hdrUrl,texture=>{
    texture.mapping=THREE.EquirectangularReflectionMapping;
    sky=texture;textureCache.push(texture);
    stats.sky="ready";
    if(active&&theme==="industrial"){scene.background=sky;scene.environment=sky;scene.environmentIntensity=.32;}
    onStatus({...stats});
  },undefined,()=>{stats.sky="fallback";onStatus({...stats});});
  function activate(value,nextTheme){
    active=value;theme=nextTheme;
    if(active&&sky&&theme==="industrial"){
      scene.background=sky;scene.environment=sky;scene.environmentIntensity=.32;
    }else if(!active){
      // Do not override the restored original city scene's environment.
    }
  }
  function applyTheme(nextTheme){
    theme=nextTheme;
    if(active&&sky&&theme==="industrial"){
      scene.background=sky;scene.environment=sky;scene.environmentIntensity=.32;
    }
  }
  return {activate,applyTheme,status:()=>({...stats})};
}
