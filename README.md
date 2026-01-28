# Volleyball Tactics Board 🏐

A high-performance, 3D interactive tactics board for volleyball coaches and players. Developed with Three.js, it features realistic player models, dynamic block shadows, and arced attack trajectories.

**[View Live Demo](https://roenbaeck.github.io/volleyballer/)**

![Volleyballer Screenshot](volleyballer.jpg)

## Features

- **3D Interactive Board**: Smooth navigation with orbit controls (Zoom, Rotate, Pan).
- **Realistic Player Models**: 3D characters with anatomically correct proportions (1.90m height).
- **Standard Rotation Numbering**: Counter-clockwise 1-6 layout (Pos 1 at back-right).
- **Adaptive Player Stances**: 
  - **Blockers (Blue)**: Automatically switch to a blocking stance (arms up, jumping) when near the net.
  - **Defenders (Green)**: Switch to a crouched defensive stance when moving to the back court.
- **Dynamic Block Shadows**: Physically accurate shadow "wedges" that adapt to the ball's position. Multiple blockers close together automatically form a unified tactical wedge.
- **Arced Attack Trajectories**: Realistic parabolic ball flight paths that dynamically clear the net.
- **Tactical Painting**: Draw custom zones on the court with adjustable colors.
- **Editable Labels**: Mark player roles (S, OH, MB, etc.) with dynamic sprite labels.

## How to Use

- **Rotate Camera**: Right-click/Shift + Drag.
- **Zoom**: Scroll wheel / Trackpad pinch.
- **Move Players/Ball**: Simply drag them across the court.
- **Select Player**: Click a player to open the role editor.
- **Paint Mode**: Toggle the switch to "Paint Zones" and drag on the floor to visualize field coverage.

## Technologies

- [Three.js](https://threejs.org/) (WebGL)
- [EffectComposer](https://threejs.org/docs/#examples/en/postprocessing/EffectComposer) (Bloom, SMAA, Vignette)
- HTML5 / CSS3 / JavaScript (ES6)

