# CyberVerse Browser-Native 3D Room Architecture

This implementation adapts the production-art and interaction principles in
Scenario Agent Skills without installing or copying its runtime, connecting a hosted MCP,
or requiring generated assets.

## Runtime architecture

- Three.js builds five themed interiors directly in the browser.
- Each room has a coherent palette, PBR material families, wall and floor geometry,
  architectural light rails, display walls, desks, chairs, racks and themed equipment.
- Independent object groups are created for laptops, monitors, routers, storage devices,
  evidence cases, USB media, tablets, keyboards, books and alert beacons.
- Objects can be selected, dragged, thrown, settled on desk surfaces and collide with one another.
- Player movement is blocked by room equipment and large furniture.
- Web Audio synthesizes positional impact cues locally.
- All geometry and interaction logic are shipped as first-party JavaScript; no paid API,
  Scenario account, remote 3D asset URL, or extra runtime library is required.

## Room-specific design

- Academy: study workstations, learning devices and security references.
- SOC: command displays, monitoring consoles and network equipment.
- Incident: alert beacons, containment equipment and evidence containers.
- Forensics: evidence storage and analysis workstations.
- Community: collaborative workstations and shared security devices.

## Interaction model

- WASD moves the avatar and existing controls remain unchanged.
- Pointer drag on a prop picks it up; moving the pointer moves the prop in a camera-facing plane.
- Releasing after a drag throws the prop with a bounded velocity.
- Gravity, floor and desk support, wall bounds, prop-to-prop collision, damping and bounce are
  calculated locally.
- Clicking without dragging selects and inspects the prop.
- Existing learning stations and VibeHacking progression remain separate and intact.

## Verification boundaries

Static checks cover module syntax, runtime contracts, the five room configurations and absence of
Scenario-hosted runtime imports. A browser E2E run is still required to certify actual frame rate,
touch interaction, collision feel and device-specific memory use.

## Inspiration and attribution

The art-direction and walkable-room workflow was informed by the MIT-licensed
Scenario Agent Skills repository (Scenario Inc., 2026). This implementation is an independent
first-party browser runtime, not a copy or installation of those skills.
