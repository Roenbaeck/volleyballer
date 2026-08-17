import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }

  async readAsDataURL(blob) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type};base64,${bytes.toString("base64")}`;
    this.onloadend?.();
  }
}

globalThis.FileReader = NodeFileReader;

const BASE_HEIGHT = 1.9;
const root = new THREE.Group();
root.name = "volleyballPlayerRig";

const materials = {
  Skin: new THREE.MeshPhysicalMaterial({ name: "Skin", color: 0xd9a07e, roughness: 0.72, sheen: 0.08 }),
  Jersey: new THREE.MeshPhysicalMaterial({ name: "Jersey", color: 0x1769aa, roughness: 0.68, sheen: 0.34, sheenColor: 0xffffff }),
  JerseyTrim: new THREE.MeshStandardMaterial({ name: "JerseyTrim", color: 0xcfeeff, roughness: 0.58 }),
  Shorts: new THREE.MeshPhysicalMaterial({ name: "Shorts", color: 0x122038, roughness: 0.66, sheen: 0.18 }),
  Socks: new THREE.MeshStandardMaterial({ name: "Socks", color: 0xf2f5f7, roughness: 0.72 }),
  Shoes: new THREE.MeshPhysicalMaterial({ name: "Shoes", color: 0x151b2a, roughness: 0.38, clearcoat: 0.22 }),
  Accent: new THREE.MeshStandardMaterial({ name: "Accent", color: 0x72d4ff, roughness: 0.52 }),
  Hair: new THREE.MeshStandardMaterial({ name: "Hair", color: 0x2b1b13, roughness: 0.92 }),
  Eyes: new THREE.MeshStandardMaterial({ name: "Eyes", color: 0x17202a, roughness: 0.45 })
};

function mesh(name, geometry, material, parent, position, scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.fromArray(position);
  object.scale.fromArray(scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function joint(name, parent, position) {
  const object = new THREE.Group();
  object.name = name;
  object.position.fromArray(position);
  parent.add(object);
  return object;
}

const footH = BASE_HEIGHT * 0.04;
const calfH = BASE_HEIGHT * 0.22;
const thighH = BASE_HEIGHT * 0.24;
const torsoH = BASE_HEIGHT * 0.30;
const upperArmH = BASE_HEIGHT * 0.16;
const forearmH = BASE_HEIGHT * 0.14;
const headH = BASE_HEIGHT / 7.5;
const kneeY = footH + calfH;

const hips = joint("hips", root, [0, kneeY + thighH, 0]);
mesh("shorts", new THREE.CylinderGeometry(0.17, 0.23, 0.22, 16), materials.Shorts, hips, [0, -0.06, 0], [1, 1, 0.72]);

const torso = joint("torso", hips, [0, 0, 0]);
mesh("torsoMesh", new THREE.CylinderGeometry(0.195, 0.13, torsoH, 20), materials.Jersey, torso, [0, torsoH / 2, 0], [1, 1, 0.66]);
const collar = mesh("collar", new THREE.TorusGeometry(0.072, 0.012, 8, 24), materials.JerseyTrim, torso, [0, torsoH * 0.92, 0], [1, 1, 0.72]);
collar.rotation.x = Math.PI / 2;
const chestBand = mesh("chestBand", new THREE.TorusGeometry(0.175, 0.011, 8, 32), materials.JerseyTrim, torso, [0, torsoH * 0.63, 0], [1, 1, 0.66]);
chestBand.rotation.x = Math.PI / 2;

function buildArm(side) {
  const sign = side === "left" ? -1 : 1;
  const shoulder = joint(`${side}Shoulder`, torso, [sign * 0.23, torsoH, 0]);
  mesh(`${side}ShoulderMesh`, new THREE.SphereGeometry(0.083, 14, 12), materials.Jersey, shoulder, [0, 0, 0], [1, 0.82, 0.82]);
  const upperArm = joint(`${side}UpperArm`, shoulder, [0, 0, 0]);
  mesh(`${side}UpperArmMesh`, new THREE.CapsuleGeometry(0.057, upperArmH - 0.114, 8, 14), materials.Skin, upperArm, [0, -upperArmH / 2, 0]);
  const elbow = joint(`${side}Elbow`, upperArm, [0, -upperArmH, 0]);
  mesh(`${side}ElbowMesh`, new THREE.SphereGeometry(0.045, 10, 8), materials.Skin, elbow, [0, 0, 0]);
  const forearm = joint(`${side}Forearm`, elbow, [0, 0, 0]);
  mesh(`${side}ForearmMesh`, new THREE.CapsuleGeometry(0.049, forearmH - 0.098, 8, 14), materials.Skin, forearm, [0, -forearmH / 2, 0]);
  mesh(`${side}Hand`, new THREE.SphereGeometry(0.067, 12, 10), materials.Skin, forearm, [0, -forearmH, 0], [0.9, 1.12, 0.58]);
}

buildArm("left");
buildArm("right");

const neck = joint("neck", torso, [0, torsoH, 0]);
mesh("neckMesh", new THREE.CylinderGeometry(0.053, 0.06, 0.075, 12), materials.Skin, neck, [0, 0.0375, 0]);
const head = joint("head", neck, [0, 0.075, 0]);
const headRadius = headH / 2;
mesh("headMesh", new THREE.SphereGeometry(headRadius, 24, 18), materials.Skin, head, [0, headRadius, 0], [0.9, 1, 0.85]);
mesh("hair", new THREE.SphereGeometry(headRadius * 1.055, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), materials.Hair, head, [0, headRadius * 1.1, 0], [0.9, 1, 0.85]);
for (const sign of [-1, 1]) {
  mesh(`eye${sign}`, new THREE.SphereGeometry(headRadius * 0.075, 8, 8), materials.Eyes, head, [sign * headRadius * 0.31, headRadius * 1.12, headRadius * 0.76], [1, 1.1, 1]);
  mesh(`ear${sign}`, new THREE.SphereGeometry(headRadius * 0.13, 8, 8), materials.Skin, head, [sign * headRadius * 0.87, headRadius, 0], [0.5, 1, 0.7]);
}
const nose = mesh("nose", new THREE.ConeGeometry(headRadius * 0.075, headRadius * 0.2, 8), materials.Skin, head, [0, headRadius * 0.92, headRadius * 0.84]);
nose.rotation.x = Math.PI / 2;

function buildLeg(side) {
  const sign = side === "left" ? -1 : 1;
  const thigh = joint(`${side}Thigh`, hips, [sign * 0.15, 0, 0]);
  mesh(`${side}ThighMesh`, new THREE.CylinderGeometry(0.073, 0.091, thighH, 14), materials.Skin, thigh, [0, -thighH / 2, 0]);
  const knee = joint(`${side}Knee`, thigh, [0, -thighH, 0]);
  mesh(`${side}KneeMesh`, new THREE.SphereGeometry(0.061, 12, 10), materials.Skin, knee, [0, 0, 0]);
  mesh(`${side}KneePad`, new THREE.SphereGeometry(0.068, 12, 10), materials.Shorts, knee, [0, 0, 0.034], [0.92, 0.82, 0.48]);
  const calf = joint(`${side}Calf`, knee, [0, 0, 0]);
  mesh(`${side}CalfMesh`, new THREE.CylinderGeometry(0.053, 0.08, calfH, 14), materials.Skin, calf, [0, -calfH / 2, 0]);
  mesh(`${side}Sock`, new THREE.CylinderGeometry(0.054, 0.056, calfH * 0.35, 14), materials.Socks, calf, [0, -calfH + calfH * 0.175, 0]);
  const shoe = mesh(`${side}Shoe`, new THREE.BoxGeometry(0.105, footH, 0.247), materials.Shoes, calf, [0, -calfH, 0.075]);
  mesh(`${side}ShoeAccent`, new THREE.BoxGeometry(0.11, 0.022, 0.09), materials.Accent, shoe, [0, 0.025, 0.035]);
}

buildLeg("left");
buildLeg("right");

const q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const quatTrack = (node, endQuaternion) => new THREE.QuaternionKeyframeTrack(
  `${node}.quaternion`,
  [0, 0.28],
  [0, 0, 0, 1, endQuaternion.x, endQuaternion.y, endQuaternion.z, endQuaternion.w]
);
const positionTrack = (node, start, end) => new THREE.VectorKeyframeTrack(`${node}.position`, [0, 0.28], [...start, ...end]);

const defendTracks = [
  positionTrack("hips", [0, kneeY + thighH, 0], [0, (kneeY + thighH) * 0.85, 0]),
  quatTrack("torso", q(0.34, 0, 0)),
  quatTrack("leftThigh", q(-0.35, 0, -0.52)),
  quatTrack("rightThigh", q(-0.35, 0, 0.52)),
  quatTrack("leftKnee", q(0.72, 0, 0)),
  quatTrack("rightKnee", q(0.72, 0, 0)),
  quatTrack("leftCalf", q(-0.3, 0, 0)),
  quatTrack("rightCalf", q(-0.3, 0, 0)),
  quatTrack("leftUpperArm", q(-0.72, 0, 0.2)),
  quatTrack("rightUpperArm", q(-0.72, 0, -0.2)),
  quatTrack("leftForearm", q(-1.38, 0, 0)),
  quatTrack("rightForearm", q(-1.38, 0, 0))
];

const blockTracks = [
  positionTrack("hips", [0, kneeY + thighH, 0], [0, kneeY + thighH, 0]),
  quatTrack("leftUpperArm", q(-Math.PI * 0.95, 0, 0)),
  quatTrack("rightUpperArm", q(-Math.PI * 0.95, 0, 0)),
  quatTrack("leftShoulder", q(0, 0, -0.15)),
  quatTrack("rightShoulder", q(0, 0, 0.15)),
  quatTrack("leftShoe", q(Math.PI / 4, 0, 0)),
  quatTrack("rightShoe", q(Math.PI / 4, 0, 0))
];

const animations = [
  new THREE.AnimationClip("Defend", 0.28, defendTracks),
  new THREE.AnimationClip("Block", 0.28, blockTracks)
];

root.updateMatrixWorld(true);
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(root, { binary: true, animations, onlyVisible: true });
await writeFile(new URL("../assets/volleyball-player.glb", import.meta.url), Buffer.from(glb));
console.log(`Wrote assets/volleyball-player.glb (${glb.byteLength} bytes)`);
