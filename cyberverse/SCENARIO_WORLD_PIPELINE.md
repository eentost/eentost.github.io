# CyberVerse Scenario 3D World Pipeline

This integration adapts the MIT-licensed Scenario Agent Skills workflows from
https://github.com/scenario-labs/skills to the existing CyberVerse Three.js experience.

## Runtime integration

- Spark 2.4.0 is loaded for paged Gaussian-splat .rad room worlds.
- Rapier 3D compat 0.21.0 provides rigid-body props, gravity, collisions and throw impulses.
- GLTFLoader supports generated PBR GLB props.
- Existing procedural rooms remain the fallback until generated and calibrated room assets are supplied.
- Web Audio synthesizes local impact sounds; generated audio can replace it later.
- The existing city, avatar, SOC, incident scenarios and learning flow remain in place.

## Asset contract

Populate scenario-world-assets.js only after each room is generated and calibrated.
Expected deployment assets:

    cyberverse/assets/scenario/worlds/<room>.rad
    cyberverse/assets/scenario/models/<room>-<prop>.glb
    cyberverse/assets/scenario/calibration/<room>.json

A room manifest world.url points to a paged LoD .rad, not the original .spz.
Transforms contain position, quaternion and metric scale. Props contain modelUrl,
transform and colliderHalfExtents.

## Scenario generation pipeline

1. Use a room reference image and record a few independent movable props.
2. Produce a clean plate by removing only the selected props.
3. Produce isolated prop cut-outs from the original reference.
4. Generate a draft Gaussian-splat world with a fixed seed.
5. Generate PBR GLB props and keep web geometry and textures within a practical budget.
6. Calibrate floor plane, scale, lens, collision heightfield and prop placement.
7. Convert .spz to a paged LoD .rad using the same Spark release as the deployed renderer.
8. Populate the manifest and verify streaming, walking, grabbing, throwing, collisions and mobile performance.

## Current implementation boundary

The runtime, manifest, Spark loading path, Rapier interaction path and procedural fallback are integrated.
The manifest intentionally contains no generated .rad or GLB assets yet. No paid Scenario generation
jobs were started: this session has no authenticated Scenario MCP team/project scope, model selection,
or cost approval. Until assets are generated and calibrated, rooms continue to use procedural geometry.

## Attribution

Scenario Agent Skills: MIT License, Copyright (c) 2026 Scenario Inc.
Spark: MIT License, Copyright (c) Spark contributors.
Rapier: Apache-2.0 License, Copyright (c) Dimforge.
