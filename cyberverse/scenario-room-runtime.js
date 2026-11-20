import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SCENARIO_WORLD_ASSETS } from "./scenario-world-assets.js";

const RAPIER_URL = "https://esm.sh/@dimforge/rapier3d-compat@0.21.0";
export function createScenarioRoomRuntime({THREE,scene,renderer,camera,canvas,announce=()=>{}}) {
  return {
    mount: async () => false,
    clearRoom: () => {},
    pointerDown: () => false,
    pointerMove: () => false,
    pointerUp: () => false,
    update: () => {},
  };
}
