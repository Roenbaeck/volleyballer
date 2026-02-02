import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js";

const app = document.getElementById("app");
const ui = {
  menu: document.getElementById("ui"),
  menuToggle: document.getElementById("menuToggle"),
  modeSwitch: document.getElementById("modeSwitch"),
  zoneColor: document.getElementById("zoneColor"),
  clearZones: document.getElementById("clearZones"),
  resetPlayers: document.getElementById("resetPlayers"),
  rotateTeam: document.getElementById("rotateTeam"),
  playerUI: document.getElementById("playerUI"),
  playerLabel: document.getElementById("playerLabel"),
  pHeight: document.getElementById("pHeight"),
  pHeightVal: document.getElementById("pHeightVal"),
  pJump: document.getElementById("pJump"),
  pJumpVal: document.getElementById("pJumpVal"),
  contactHeight: document.getElementById("contactHeight"),
  heightValue: document.getElementById("heightValue"),
  attackPower: document.getElementById("attackPower"),
  powerValue: document.getElementById("powerValue"),
  mergeShadows: document.getElementById("mergeShadows"),
  netShadowToggle: document.getElementById("netShadowToggle"),

  saveLineup: document.getElementById("saveLineup"),
  loadLineup: document.getElementById("loadLineup"),
  deleteLineup: document.getElementById("deleteLineup"),
  lineupName: document.getElementById("lineupName"),
  lineupList: document.getElementById("lineupList"),

  savePos: document.getElementById("savePos"),
  loadPos: document.getElementById("loadPos"),
  deletePos: document.getElementById("deletePos"),
  posName: document.getElementById("posName"),
  posList: document.getElementById("posList"),
  shareLayout: document.getElementById("shareLayout"),
  netHeight: document.getElementById("netHeight")
};

const DEFAULT_TACTICS = {
  "Diagonal Block": {
    players: [
      { x: -2.65, z: -3.18 },
      { x: -2.91, z: -0.3 },
      { x: -2.15, z: -0.3 },
      { x: 1.35, z: -1.58 },
      { x: 2.25, z: -6.9 },
      { x: -3.44, z: -5.91 }
    ],
    ball: { x: -3.17, z: 0.69 },
    target: { x: -3.87, z: -7.71 },
    physics: { height: "3.2", power: "75" }
  },
  "Parallel Block": {
    players: [
      { x: -3.4, z: -3.27 },
      { x: -3.71, z: -0.3 },
      { x: -2.89, z: -0.3 },
      { x: 1.64, z: -1.75 },
      { x: 2.73, z: -6.78 },
      { x: -0.61, z: -7.73 }
    ],
    ball: { x: -3.22, z: 0.61 },
    target: { x: 3.59, z: -7.63 },
    physics: { height: "3", power: "60" }
  }
};

let selectedPlayer = null;

const COURT = {
  width: 9,
  length: 18,
  halfWidth: 4.5,
  halfLength: 9
};

const BLOCK_THRESHOLD = 0.9; // Max distance between blockers to be considered a "tight" unified block
const BLOCKER_RADIUS_FACTOR = 0.16; // Multiplier for player height to determine blocking width

// Scene
const scene = new THREE.Scene();

// Gradient background (arena feel)
const bgCanvas = document.createElement("canvas");
bgCanvas.width = 2;
bgCanvas.height = 512;
const bgCtx = bgCanvas.getContext("2d");
const bgGrad = bgCtx.createLinearGradient(0, 0, 0, 512);
bgGrad.addColorStop(0, "#1a2a3a");
bgGrad.addColorStop(0.5, "#0d1520");
bgGrad.addColorStop(1, "#050a0f");
bgCtx.fillStyle = bgGrad;
bgCtx.fillRect(0, 0, 2, 512);
const bgTexture = new THREE.CanvasTexture(bgCanvas);
bgTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTexture;

// Fog for depth
scene.fog = new THREE.FogExp2(0x0a1520, 0.012);

// Camera
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 16, -22);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// Post-processing
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { stencilBuffer: true }));
const renderPass = new RenderPass(scene, camera);
renderPass.clearStencil = true;
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.15, // strength
  0.3, // radius
  0.92 // threshold
);
composer.addPass(bloomPass);

const smaaPass = new SMAAPass(innerWidth, innerHeight);
composer.addPass(smaaPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Vignette shader
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.5 },
    offset: { value: 0.9 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      color.rgb *= smoothstep(0.8, offset * 0.5, dist * (darkness + offset));
      gl_FragColor = color;
    }
  `
};
const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 45;
controls.minPolarAngle = Math.PI / 6;
controls.maxPolarAngle = Math.PI / 2.1;
controls.target.set(0, 0, 0);
controls.update();

// Lights - Stadium lighting
const ambientLight = new THREE.AmbientLight(0x4488cc, 0.3);
scene.add(ambientLight);

// Main key light
const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.2);
keyLight.position.set(8, 20, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 5;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.left = -15;
keyLight.shadow.camera.right = 15;
keyLight.shadow.camera.top = 15;
keyLight.shadow.camera.bottom = -15;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

// Fill light
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
fillLight.position.set(-10, 12, -8);
scene.add(fillLight);

// Rim light
const rimLight = new THREE.DirectionalLight(0xffeedd, 0.6);
rimLight.position.set(0, 8, -15);
scene.add(rimLight);

// Stadium spot lights
function createSpotLight(x, z, intensity, color, casting = false) {
  const spot = new THREE.SpotLight(color, intensity, 40, Math.PI / 6, 0.5, 1);
  spot.position.set(x, 18, z);
  spot.target.position.set(0, 0, 0);
  if (casting) {
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.shadow.camera.near = 10;
    spot.shadow.camera.far = 40;
    spot.shadow.bias = -0.0001;
  }
  scene.add(spot);
  scene.add(spot.target);
  return spot;
}

createSpotLight(-12, 12, 120, 0xffffff, true);
createSpotLight(12, 12, 60, 0xffffff, false);
createSpotLight(-12, -12, 80, 0xffeedd, true);
createSpotLight(12, -12, 40, 0xffeedd, false);

// Hemisphere light for realistic ambient
const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362a1a, 0.25);
scene.add(hemi);

// Arena floor (outside court)
const arenaFloorGeo = new THREE.PlaneGeometry(60, 60);
const arenaFloorMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.9,
  metalness: 0.1
});
const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
arenaFloor.rotation.x = -Math.PI / 2;
arenaFloor.position.y = -0.02;
arenaFloor.receiveShadow = true;
scene.add(arenaFloor);

// Court group
const courtGroup = new THREE.Group();
scene.add(courtGroup);

// Hardwood court texture
const courtTexture = (() => {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Base wood color
  const baseGrad = ctx.createLinearGradient(0, 0, size, size);
  baseGrad.addColorStop(0, "#c4956a");
  baseGrad.addColorStop(0.25, "#b8895e");
  baseGrad.addColorStop(0.5, "#c9a070");
  baseGrad.addColorStop(0.75, "#b38454");
  baseGrad.addColorStop(1, "#c4956a");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Wood grain
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < size; i += 3) {
    const variation = Math.sin(i * 0.1) * 20 + Math.random() * 10;
    ctx.strokeStyle = Math.random() > 0.5 ? "#8b6b4a" : "#d4a574";
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(0, i + variation);
    ctx.bezierCurveTo(size * 0.25, i + variation + Math.random() * 5,
      size * 0.75, i + variation - Math.random() * 5,
      size, i + variation);
    ctx.stroke();
  }

  // Plank lines
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#5a4030";
  ctx.lineWidth = 2;
  const plankWidth = size / 16;
  for (let x = 0; x <= size; x += plankWidth) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  // Subtle noise
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
})();

// Court normal map
const courtNormalMap = (() => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  // Subtle wood grain normals
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < size; i += 2) {
    ctx.strokeStyle = `rgb(${128 + Math.random() * 20}, ${128 + Math.random() * 10}, 255)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  return texture;
})();

const court = new THREE.Mesh(
  new THREE.PlaneGeometry(COURT.width, COURT.length),
  new THREE.MeshStandardMaterial({
    map: courtTexture,
    normalMap: courtNormalMap,
    normalScale: new THREE.Vector2(0.1, 0.1),
    roughness: 0.35,
    metalness: 0.0,
    envMapIntensity: 0.3
  })
);
court.rotation.x = -Math.PI / 2;
court.receiveShadow = true;
courtGroup.add(court);

// Court lines (thick painted lines)
const linesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const lineWidth = 0.05;

function createLine(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const geo = new THREE.PlaneGeometry(lineWidth, length);
  const mesh = new THREE.Mesh(geo, linesMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -angle;
  mesh.position.set((x1 + x2) / 2, 0.005, (z1 + z2) / 2);
  return mesh;
}

const halfW = COURT.halfWidth;
const halfL = COURT.halfLength;

// Boundary
courtGroup.add(createLine(-halfW, -halfL, halfW, -halfL));
courtGroup.add(createLine(halfW, -halfL, halfW, halfL));
courtGroup.add(createLine(halfW, halfL, -halfW, halfL));
courtGroup.add(createLine(-halfW, halfL, -halfW, -halfL));

// Attack lines
courtGroup.add(createLine(-halfW, -3, halfW, -3));
courtGroup.add(createLine(-halfW, 3, halfW, 3));

// Center line
courtGroup.add(createLine(-halfW, 0, halfW, 0));

// Net posts
function createNetPost(x) {
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 16);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.3,
    metalness: 0.8
  });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(x, 1.4, 0);
  post.castShadow = true;
  return post;
}
scene.add(createNetPost(-halfW - 0.65));
scene.add(createNetPost(halfW + 0.65));

// Net texture (finer grid)
const netTexture = (() => {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  // Net grid
  ctx.strokeStyle = "rgba(40,40,40,0.9)";
  ctx.lineWidth = 2;
  const step = 16;
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  return texture;
})();

const netMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  map: netTexture,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
  roughness: 0.8,
  metalness: 0.0
});
const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT.width + 1.0, 1.0), netMaterial);
net.position.y = 2.43 - 0.5;
net.position.z = 0;
net.castShadow = true;
net.receiveShadow = true;
scene.add(net);

// Net tape (top)
const netTape = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width + 1.0, 0.07, 0.03),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
);
netTape.position.y = 2.43 + 0.015;
netTape.position.z = 0;
netTape.castShadow = true;
scene.add(netTape);

// Net tape (bottom)
const netBottomTape = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width + 1.0, 0.05, 0.03),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
);
netBottomTape.position.y = 2.43 - 1.0 + 0.025;
netBottomTape.position.z = 0;
netBottomTape.castShadow = true;
scene.add(netBottomTape);

// Antennas
const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8);
const antennaMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 }); // Red but we'll add white stripes later if needed
const leftAntenna = new THREE.Mesh(antennaGeo, antennaMat);
leftAntenna.position.set(-COURT.halfWidth, 2.43 - 1.0 + 0.9, 0); // Bottom of net is ~1.43, top is 2.43. Antenna is 1.8m tall.
scene.add(leftAntenna);

const rightAntenna = new THREE.Mesh(antennaGeo, antennaMat);
rightAntenna.position.set(COURT.halfWidth, 2.43 - 1.0 + 0.9, 0);
scene.add(rightAntenna);

function updateNetHeightVisuals() {
  const h = parseFloat(ui.netHeight.value);
  net.position.y = h - 0.5;
  netTape.position.y = h + 0.015;
  netBottomTape.position.y = h - 1.0 + 0.025;
  leftAntenna.position.y = h - 1.0 + 0.9;
  rightAntenna.position.y = h - 1.0 + 0.9;

  updateNetShadow();
  updateBlockShadow();
}

ui.netHeight.addEventListener("change", updateNetHeightVisuals);

// Dynamic 3D character models with anatomically correct proportions
function createPlayer({ color = 0x1565c0, height = 1.9, jump = 3.10, label, side = "home", isBlocker = false }) {
  const group = new THREE.Group();
  const H = height;

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8beac, roughness: 0.7, metalness: 0.0 });
  const jerseyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.05 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.6 });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.4, metalness: 0.1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2518, roughness: 0.9 });

  // === PROPORTIONS (based on 8-head athletic figure) ===
  const headH = H / 7.5;  // Head is ~1/7.5 of total height for athletic build
  const torsoH = H * 0.30;  // Torso (chest to waist)
  const hipsH = H * 0.08;   // Hip/pelvis area
  const thighH = H * 0.24;  // Upper leg
  const calfH = H * 0.22;   // Lower leg
  const footH = H * 0.04;   // Foot height
  const upperArmH = H * 0.16;  // Upper arm
  const forearmH = H * 0.14;   // Forearm
  const neckH = H * 0.04;   // Neck

  // Widths
  const shoulderW = H * 0.24;
  const hipsW = H * 0.16;
  const legSpacing = H * 0.08;

  const kneeRad = H * 0.032;
  const kneeGeo = new THREE.SphereGeometry(kneeRad, 10, 10);
  const footGeo = new THREE.BoxGeometry(H * 0.055, footH, H * 0.13);
  footGeo.translate(0, footH / 2, H * 0.02);

  // === HIERARCHY SETUP ===
  const kneeY = footH + calfH;
  const hips = new THREE.Group();
  hips.name = "hips";
  hips.position.set(0, kneeY + thighH, 0);
  group.add(hips);

  // === SHORTS (Child of hips) ===
  const shortsH = thighH * 0.35 + hipsH;
  const shortsTopRad = hipsW / 2 + H * 0.01;
  const shortsBotRad = hipsW / 2 + H * 0.08;
  const shortsGeo = new THREE.CylinderGeometry(shortsTopRad, shortsBotRad, shortsH, 12);
  const shorts = new THREE.Mesh(shortsGeo, shortsMat);
  shorts.name = "shorts";
  shorts.position.set(0, -shortsH / 2 + hipsH, 0);
  shorts.scale.z = 0.7;
  shorts.castShadow = true;
  hips.add(shorts);

  // === TORSO (Child of hips, pivot at waist) ===
  const torso = new THREE.Group();
  torso.name = "torso";
  torso.position.set(0, 0, 0); // Origin at hips center/waist
  hips.add(torso);

  const waistW = hipsW * 0.85;
  const chestW = shoulderW * 0.85;
  const tw = waistW / 2;
  const cw = chestW / 2;
  const torsoGeo = new THREE.CylinderGeometry(cw, tw, torsoH, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
  torsoMesh.position.set(0, torsoH / 2, 0);
  torsoMesh.scale.z = 0.65;
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  // === SHOULDERS (Children of torso) ===
  const shoulderRad = H * 0.045;
  const shoulderGeo = new THREE.SphereGeometry(shoulderRad, 12, 12);

  const leftShoulder = new THREE.Group();
  leftShoulder.name = "leftShoulder";
  leftShoulder.position.set(-shoulderW / 2, torsoH, 0);
  torso.add(leftShoulder);
  const lsMesh = new THREE.Mesh(shoulderGeo, jerseyMat);
  lsMesh.scale.set(1, 0.8, 0.8);
  leftShoulder.add(lsMesh);

  const rightShoulder = new THREE.Group();
  rightShoulder.name = "rightShoulder";
  rightShoulder.position.set(shoulderW / 2, torsoH, 0);
  torso.add(rightShoulder);
  const rsMesh = new THREE.Mesh(shoulderGeo, jerseyMat);
  rsMesh.scale.set(1, 0.8, 0.8);
  rightShoulder.add(rsMesh);

  // === ARMS (Hierarchical) ===
  const upperArmRad = H * 0.032;
  const upperArmGeo = new THREE.CapsuleGeometry(upperArmRad, upperArmH - upperArmRad * 2, 8, 12);

  const leftUpperArm = new THREE.Group();
  leftUpperArm.name = "leftUpperArm";
  leftShoulder.add(leftUpperArm);
  const luaMesh = new THREE.Mesh(upperArmGeo, skinMat);
  luaMesh.position.set(0, -upperArmH / 2, 0);
  luaMesh.castShadow = true;
  leftUpperArm.add(luaMesh);

  const rightUpperArm = new THREE.Group();
  rightUpperArm.name = "rightUpperArm";
  rightShoulder.add(rightUpperArm);
  const ruaMesh = new THREE.Mesh(upperArmGeo, skinMat);
  ruaMesh.position.set(0, -upperArmH / 2, 0);
  ruaMesh.castShadow = true;
  rightUpperArm.add(ruaMesh);

  const elbowRad = H * 0.025;
  const elbowGeo = new THREE.SphereGeometry(elbowRad, 8, 8);

  const leftElbow = new THREE.Group();
  leftElbow.name = "leftElbow";
  leftElbow.position.set(0, -upperArmH, 0);
  leftUpperArm.add(leftElbow);
  leftElbow.add(new THREE.Mesh(elbowGeo, skinMat));

  const rightElbow = new THREE.Group();
  rightElbow.name = "rightElbow";
  rightElbow.position.set(0, -upperArmH, 0);
  rightUpperArm.add(rightElbow);
  rightElbow.add(new THREE.Mesh(elbowGeo, skinMat));

  const forearmTopRad = H * 0.028;
  const forearmGeo = new THREE.CapsuleGeometry(forearmTopRad, forearmH - forearmTopRad * 2, 8, 12);

  const leftForearm = new THREE.Group();
  leftForearm.name = "leftForearm";
  leftElbow.add(leftForearm);
  const lfMesh = new THREE.Mesh(forearmGeo, skinMat);
  lfMesh.position.set(0, -forearmH / 2, 0);
  lfMesh.castShadow = true;
  leftForearm.add(lfMesh);

  const rightForearm = new THREE.Group();
  rightForearm.name = "rightForearm";
  rightElbow.add(rightForearm);
  const rfMesh = new THREE.Mesh(forearmGeo, skinMat);
  rfMesh.position.set(0, -forearmH / 2, 0);
  rfMesh.castShadow = true;
  rightForearm.add(rfMesh);

  const handGeo = new THREE.SphereGeometry(H * 0.038, 10, 10);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.name = "leftHand";
  leftHand.position.set(0, -forearmH, 0);
  leftHand.scale.set(0.9, 1.1, 0.6);
  leftForearm.add(leftHand);

  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.name = "rightHand";
  rightHand.position.set(0, -forearmH, 0);
  rightHand.scale.set(0.9, 1.1, 0.6);
  rightForearm.add(rightHand);

  // === HEAD & NECK (Children of torso) ===
  const neck = new THREE.Group();
  neck.name = "neck";
  neck.position.set(0, torsoH, 0);
  torso.add(neck);
  const neckRad = H * 0.028;
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(neckRad, neckRad * 1.1, neckH, 12), skinMat);
  neckMesh.position.set(0, neckH / 2, 0);
  neck.add(neckMesh);

  const headJoint = new THREE.Group();
  headJoint.name = "head";
  headJoint.position.set(0, neckH, 0);
  neck.add(headJoint);
  const headRad = headH / 2;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headRad, 20, 20), skinMat);
  headMesh.position.set(0, headRad, 0);
  headMesh.scale.set(0.9, 1, 0.85);
  headMesh.castShadow = true;
  headJoint.add(headMesh);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(headRad * 1.05, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.name = "hair";
  hair.position.set(0, headRad + headRad * 0.1, 0);
  hair.scale.copy(headMesh.scale);
  hair.rotation.x = 0.25; // Tilted forward to look more like eyes are facing ahead
  headJoint.add(hair);

  // === LEGS (Hierarchical) ===
  const thighTopRad = H * 0.048;
  const thighBotRad = H * 0.038;
  const thighGeo = new THREE.CylinderGeometry(thighBotRad, thighTopRad, thighH, 12);

  const leftThigh = new THREE.Group();
  leftThigh.name = "leftThigh";
  leftThigh.position.set(-legSpacing, 0, 0);
  hips.add(leftThigh);
  const ltMesh = new THREE.Mesh(thighGeo, skinMat);
  ltMesh.position.set(0, -thighH / 2, 0);
  ltMesh.castShadow = true;
  leftThigh.add(ltMesh);

  const rightThigh = new THREE.Group();
  rightThigh.name = "rightThigh";
  rightThigh.position.set(legSpacing, 0, 0);
  hips.add(rightThigh);
  const rtMesh = new THREE.Mesh(thighGeo, skinMat);
  rtMesh.position.set(0, -thighH / 2, 0);
  rtMesh.castShadow = true;
  rightThigh.add(rtMesh);

  const leftKnee = new THREE.Group();
  leftKnee.name = "leftKnee";
  leftKnee.position.set(0, -thighH, 0);
  leftThigh.add(leftKnee);
  leftKnee.add(new THREE.Mesh(kneeGeo, skinMat));

  const rightKnee = new THREE.Group();
  rightKnee.name = "rightKnee";
  rightKnee.position.set(0, -thighH, 0);
  rightThigh.add(rightKnee);
  rightKnee.add(new THREE.Mesh(kneeGeo, skinMat));

  const calfTopRad = H * 0.042;
  const calfBotRad = H * 0.028;
  const calfGeo = new THREE.CylinderGeometry(calfBotRad, calfTopRad, calfH, 12);

  const leftCalf = new THREE.Group();
  leftCalf.name = "leftCalf";
  leftKnee.add(leftCalf);
  const lcMesh = new THREE.Mesh(calfGeo, skinMat);
  lcMesh.position.set(0, -calfH / 2, 0);
  lcMesh.castShadow = true;
  leftCalf.add(lcMesh);

  const rightCalf = new THREE.Group();
  rightCalf.name = "rightCalf";
  rightKnee.add(rightCalf);
  const rcMesh = new THREE.Mesh(calfGeo, skinMat);
  rcMesh.position.set(0, -calfH / 2, 0);
  rcMesh.castShadow = true;
  rightCalf.add(rcMesh);

  const sockH = calfH * 0.35;
  const sockGeo = new THREE.CylinderGeometry(calfBotRad * 1.02, calfBotRad * 1.05, sockH, 12);
  const leftSock = new THREE.Mesh(sockGeo, sockMat);
  leftSock.name = "leftSock";
  leftSock.position.set(0, -calfH + sockH / 2, 0);
  leftCalf.add(leftSock);
  const rightSock = new THREE.Mesh(sockGeo, sockMat);
  rightSock.name = "rightSock";
  rightSock.position.set(0, -calfH + sockH / 2, 0);
  rightCalf.add(rightSock);

  const leftShoe = new THREE.Mesh(footGeo, shoeMat);
  leftShoe.name = "leftShoe";
  leftShoe.position.set(0, -calfH - footH / 2, H * 0.03);
  leftCalf.add(leftShoe);
  const rightShoe = new THREE.Mesh(footGeo, shoeMat);
  rightShoe.name = "rightShoe";
  rightShoe.position.set(0, -calfH - footH / 2, H * 0.03);
  rightCalf.add(rightShoe);

  // === LABEL SPRITE ===
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 120;
  labelCanvas.height = 60;
  const lctx = labelCanvas.getContext("2d");
  lctx.fillStyle = "rgba(0,0,0,0.6)";
  if (lctx.roundRect) lctx.roundRect(0, 0, 120, 60, 12); else lctx.rect(0, 0, 120, 60);
  lctx.fill();
  lctx.fillStyle = "white";
  lctx.font = "bold 34px sans-serif";
  lctx.textAlign = "center";
  lctx.textBaseline = "middle";
  lctx.fillText(label, 60, 30);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.name = "labelSprite";
  labelSprite.scale.set(0.8, 0.4, 1);
  group.add(labelSprite);

  // Metadata
  group.userData = { label, side, kind: "player", height, jump };

  setPlayerStance(group, isBlocker);
  return group;
}

function setPlayerStance(player, isBlocker) {
  player.userData.isBlocker = isBlocker;
  const H = player.userData.height || 1.9;
  const J = player.userData.jump || 3.10;

  // Get hierarchical parts
  const hips = player.getObjectByName("hips");
  const torso = player.getObjectByName("torso");
  const neck = player.getObjectByName("neck");
  const head = player.getObjectByName("head");
  const hair = player.getObjectByName("hair");
  const leftShoulder = player.getObjectByName("leftShoulder");
  const rightShoulder = player.getObjectByName("rightShoulder");
  const leftUpperArm = player.getObjectByName("leftUpperArm");
  const rightUpperArm = player.getObjectByName("rightUpperArm");
  const leftElbow = player.getObjectByName("leftElbow");
  const rightElbow = player.getObjectByName("rightElbow");
  const leftForearm = player.getObjectByName("leftForearm");
  const rightForearm = player.getObjectByName("rightForearm");
  const leftHand = player.getObjectByName("leftHand");
  const rightHand = player.getObjectByName("rightHand");
  const leftThigh = player.getObjectByName("leftThigh");
  const rightThigh = player.getObjectByName("rightThigh");
  const leftKnee = player.getObjectByName("leftKnee");
  const rightKnee = player.getObjectByName("rightKnee");
  const leftCalf = player.getObjectByName("leftCalf");
  const rightCalf = player.getObjectByName("rightCalf");
  const leftShoe = player.getObjectByName("leftShoe");
  const rightShoe = player.getObjectByName("rightShoe");
  const shorts = player.getObjectByName("shorts");
  const labelSprite = player.getObjectByName("labelSprite");

  // Constants
  const thighH = H * 0.24;
  const upperArmH = H * 0.16;
  const forearmH = H * 0.14;

  // Update jersey color
  if (torso) {
    const mesh = torso.children.find(c => c.isMesh);
    if (mesh) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: isBlocker ? 0x1565c0 : 0x2e7d32,
        roughness: 0.5,
        metalness: 0.05
      });
    }
  }

  // 1. Reset all hierarchical rotations
  [hips, torso, neck, head, hair, leftShoulder, rightShoulder, leftUpperArm, rightUpperArm,
    leftElbow, rightElbow, leftForearm, rightForearm, leftThigh, rightThigh, leftKnee, rightKnee,
    leftCalf, rightCalf, leftShoe, rightShoe, shorts].forEach(p => {
      if (p) {
        p.rotation.set(0, 0, 0);
        if (p.scale && p.name !== "labelSprite") p.scale.set(1, 1, 1);
      }
    });

  if (isBlocker) {
    // === BLOCKER STANCE ===
    if (leftUpperArm) leftUpperArm.rotation.x = -Math.PI * 0.95;
    if (rightUpperArm) rightUpperArm.rotation.x = -Math.PI * 0.95;
    if (leftShoulder) leftShoulder.rotation.z = -0.15;
    if (rightShoulder) rightShoulder.rotation.z = 0.15;
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    if (rightHand) rightHand.rotation.set(0, 0, 0);
    if (shorts) shorts.scale.z = 0.7;

    // Point feet down for jump
    if (leftShoe) leftShoe.rotation.x = Math.PI / 4;
    if (rightShoe) rightShoe.rotation.x = Math.PI / 4;

    // Reach calculation:
    // Shoulder is at ~82% height. Arms are ~30% height (16+14).
    // Total reach is approx 112% height, but with hierarchy and slight angles, let's say 125% to be safe?
    // Actually, J is the TOP of the reach.
    // If J = 3.10 and Player H = 1.90.
    // Standing Reach = H * 1.25 (approx).
    const standingReach = H * 1.25;
    player.userData.dragHeight = Math.max(0, J - standingReach);
    if (hips) hips.position.y = thighH + H * 0.26;
  } else {
    // === DEFENDER STANCE ===
    const shoulderTilt = 0.7; // Upper arms forward
    const torsoTilt = 0.35;
    const legAngleOut = 0.55; // Wider stance

    if (hips) hips.position.y = (thighH + H * 0.26) * 0.85;
    if (torso) torso.rotation.x = torsoTilt;
    if (shorts) {
      shorts.rotation.x = torsoTilt * 0.4;
      shorts.scale.z = 0.7;
    }

    if (leftThigh) leftThigh.rotation.set(-0.35, 0, -legAngleOut);
    if (rightThigh) rightThigh.rotation.set(-0.35, 0, legAngleOut);
    if (leftKnee) leftKnee.rotation.x = 0.75;
    if (rightKnee) rightKnee.rotation.x = 0.75;
    if (leftCalf) leftCalf.rotation.x = -0.3;
    if (rightCalf) rightCalf.rotation.x = -0.3;

    if (head) head.rotation.x = torsoTilt * 0.5;

    // Arms in ready position (Elbows forward, forearms up/ready)
    // NOTE: negative X rotation brings arms FORWARD/UP from the downward rest position.
    if (leftUpperArm) leftUpperArm.rotation.set(-shoulderTilt, 0, 0.2);
    if (rightUpperArm) rightUpperArm.rotation.set(-shoulderTilt, 0, -0.2);

    // Flex elbows (negative X rotation to bend forward!)
    if (leftForearm) leftForearm.rotation.set(-1.4, 0, 0);
    if (rightForearm) rightForearm.rotation.set(-1.4, 0, 0);

    // Hands follow forearm magnitude (natural extension)
    // Maybe slight adjustment to cup the ball?
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    if (rightHand) rightHand.rotation.set(0, 0, 0);

    player.userData.dragHeight = 0;
  }

  if (labelSprite) labelSprite.position.y = H + 0.25;
  player.position.y = player.userData.dragHeight;
}

function updatePlayerLabel(player, text, silent = false) {
  player.userData.label = text;
  const labelSprite = player.getObjectByName("labelSprite");
  if (!labelSprite) return;

  const canvas = labelSprite.material.map.image;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  if (ctx.roundRect) ctx.roundRect(0, 0, 120, 60, 12); else ctx.rect(0, 0, 120, 60);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 60, 30);

  labelSprite.material.map.needsUpdate = true;
  if (!silent) saveLastKnown();
}

function updatePlayerHeight(player, newHeight, silent = false) {
  const oldPos = player.position.clone();
  const oldLabel = player.userData.label;
  const oldIsBlocker = player.userData.isBlocker;
  const oldSide = player.userData.side;
  const oldJump = player.userData.jump;

  scene.remove(player);
  const idx = players.indexOf(player);

  const newPlayer = createPlayer({
    label: oldLabel,
    height: newHeight,
    jump: oldJump,
    isBlocker: oldIsBlocker,
    side: oldSide
  });
  newPlayer.position.copy(oldPos);

  if (idx !== -1) {
    players[idx] = newPlayer;
    const dragIdx = draggable.indexOf(player);
    if (dragIdx !== -1) draggable[dragIdx] = newPlayer;
    const allIdx = allPlayers.indexOf(player);
    if (allIdx !== -1) allPlayers[allIdx] = newPlayer;
  }

  scene.add(newPlayer);
  if (selectedPlayer === player) selectedPlayer = newPlayer;

  updateBlockShadow();
  updatePlayerRotations();
  if (!silent) saveLastKnown();
}

function updatePlayerJump(player, newJump, silent = false) {
  const oldPos = player.position.clone();
  const oldLabel = player.userData.label;
  const oldIsBlocker = player.userData.isBlocker;
  const oldSide = player.userData.side;
  const oldHeight = player.userData.height;

  scene.remove(player);
  const idx = players.indexOf(player);

  const newPlayer = createPlayer({
    label: oldLabel,
    height: oldHeight,
    jump: newJump,
    isBlocker: oldIsBlocker,
    side: oldSide
  });
  newPlayer.position.copy(oldPos);

  if (idx !== -1) {
    players[idx] = newPlayer;
    const dragIdx = draggable.indexOf(player);
    if (dragIdx !== -1) draggable[dragIdx] = newPlayer;
    const allIdx = allPlayers.indexOf(player);
    if (allIdx !== -1) allPlayers[allIdx] = newPlayer;
  }

  scene.add(newPlayer);
  if (selectedPlayer === player) selectedPlayer = newPlayer;

  updateBlockShadow();
  updatePlayerRotations();
  if (!silent) saveLastKnown();
}

function refreshDropdowns() {
  const rosters = JSON.parse(localStorage.getItem("volleyballer_rosters") || "{}");
  ui.lineupList.innerHTML = '<option value="">Select Lineup...</option>';
  Object.keys(rosters).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    ui.lineupList.appendChild(opt);
  });

  const savedTactics = JSON.parse(localStorage.getItem("volleyballer_tactics") || "{}");
  const allTactics = { ...DEFAULT_TACTICS, ...savedTactics };
  ui.posList.innerHTML = '<option value="">Select Position...</option>';
  Object.keys(allTactics).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    ui.posList.appendChild(opt);
  });
}

function saveLineup(key = "volleyballer_lineup", silent = false) {
  const data = players.map(p => ({
    label: p.userData.label,
    height: p.userData.height,
    jump: p.userData.jump || 3.10
  }));

  if (key === "NAMED") {
    const name = ui.lineupName.value.trim();
    if (!name) return alert("Please enter a name for the lineup.");
    const rosters = JSON.parse(localStorage.getItem("volleyballer_rosters") || "{}");
    rosters[name] = data;
    localStorage.setItem("volleyballer_rosters", JSON.stringify(rosters));
    ui.lineupName.value = "";
    refreshDropdowns();
    alert(`Lineup "${name}" saved!`);
  } else {
    localStorage.setItem(key, JSON.stringify(data));
    if (!silent) alert("Lineup saved!");
  }
}

function loadLineup(key = "volleyballer_lineup", silent = false) {
  let data = null;
  if (key === "NAMED") {
    const name = ui.lineupList.value;
    if (!name) return alert("Please select a lineup from the list.");
    const rosters = JSON.parse(localStorage.getItem("volleyballer_rosters") || "{}");
    data = rosters[name];
  } else {
    const raw = localStorage.getItem(key);
    if (raw) data = JSON.parse(raw);
  }

  if (!data) {
    if (!silent) alert("No saved lineup found.");
    return;
  }

  data.forEach((d, i) => {
    if (players[i]) {
      updatePlayerLabel(players[i], d.label, true);
      updatePlayerHeight(players[i], d.height, true);
      if (d.jump) updatePlayerJump(players[i], d.jump, true);
    }
  });

  if (selectedPlayer) {
    ui.playerLabel.value = selectedPlayer.userData.label;
    ui.pHeight.value = selectedPlayer.userData.height;
    ui.pHeightVal.textContent = selectedPlayer.userData.height.toFixed(2) + "m";
    ui.pJump.value = selectedPlayer.userData.jump || 3.10;
    ui.pJumpVal.textContent = (selectedPlayer.userData.jump || 3.10).toFixed(2) + "m";
  }
  updateBlockShadow();
  updatePlayerRotations();
}

function deleteLineup() {
  const name = ui.lineupList.value;
  if (!name) return;
  if (confirm(`Delete lineup "${name}"?`)) {
    const rosters = JSON.parse(localStorage.getItem("volleyballer_rosters") || "{}");
    delete rosters[name];
    localStorage.setItem("volleyballer_rosters", JSON.stringify(rosters));
    refreshDropdowns();
  }
}

function savePositions(key = "volleyballer_positions", silent = false) {
  const data = JSON.parse(getFullStateJSON());

  if (key === "NAMED") {
    const name = ui.posName.value.trim();
    if (!name) return alert("Please enter a name for the tactical position.");
    const tactics = JSON.parse(localStorage.getItem("volleyballer_tactics") || "{}");
    tactics[name] = data;
    localStorage.setItem("volleyballer_tactics", JSON.stringify(tactics));
    ui.posName.value = "";
    refreshDropdowns();
    alert(`Position "${name}" saved!`);
  } else {
    localStorage.setItem(key, JSON.stringify(data));
    if (!silent && key === "volleyballer_positions") alert("Position and settings saved!");
  }
}

function loadPositions(key = "volleyballer_positions") {
  let data = null;
  if (key === "NAMED") {
    const name = ui.posList.value;
    if (!name) return alert("Please select a position from the list.");

    // Check defaults first, then localStorage
    if (DEFAULT_TACTICS[name]) {
      data = DEFAULT_TACTICS[name];
    } else {
      const tactics = JSON.parse(localStorage.getItem("volleyballer_tactics") || "{}");
      data = tactics[name];
    }
  } else {
    const raw = localStorage.getItem(key);
    if (raw) data = JSON.parse(raw);
  }

  if (data) applyTacticalState(data);
}

function deletePosition() {
  const name = ui.posList.value;
  if (!name) return;
  if (DEFAULT_TACTICS[name]) {
    return alert("Default tactical presets cannot be deleted.");
  }
  if (confirm(`Delete position "${name}"?`)) {
    const tactics = JSON.parse(localStorage.getItem("volleyballer_tactics") || "{}");
    delete tactics[name];
    localStorage.setItem("volleyballer_tactics", JSON.stringify(tactics));
    refreshDropdowns();
  }
}

function saveLastKnown() {
  saveLineup("volleyballer_lastLineup", true);
  savePositions("volleyballer_lastPositions", true);
}

const players = [
  createPlayer({ label: "1", side: "home", height: 1.90 }),
  createPlayer({ label: "2", side: "home", height: 1.90 }),
  createPlayer({ label: "3", side: "home", height: 1.90 }),
  createPlayer({ label: "4", side: "home", height: 1.90 }),
  createPlayer({ label: "5", side: "home", height: 1.90 }),
  createPlayer({ label: "6", side: "home", height: 1.90 })
];

function resetPlayerPositions() {
  hideZoneNodes();
  zones.forEach(z => {
    z.geometry.dispose();
    z.material.dispose();
    scene.remove(z);
  });
  zones.length = 0;

  players[0].position.set(-3.0, players[0].userData.dragHeight, -6.0); // Pos 1
  players[1].position.set(-3.0, players[1].userData.dragHeight, -0.6); // Pos 2
  players[2].position.set(0.0, players[2].userData.dragHeight, -0.6);  // Pos 3
  players[3].position.set(3.0, players[3].userData.dragHeight, -0.6);  // Pos 4
  players[4].position.set(3.0, players[4].userData.dragHeight, -6.0);  // Pos 5
  players[5].position.set(0.0, players[5].userData.dragHeight, -7.0);  // Pos 6

  players.forEach(p => {
    const isAtNet = p.position.z > -1.5;
    setPlayerStance(p, isAtNet);
  });

  ball.position.set(0, 3, 4);

  if (selectedPlayer) {
    selectionRing.position.x = selectedPlayer.position.x;
    selectionRing.position.z = selectedPlayer.position.z;
  }

  updatePlayerRotations();
  updateAttackIndicator();
  updateBlockShadow();
  saveLastKnown();
}

// Ball with realistic volleyball look
const ballTexture = (() => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Base white
  ctx.fillStyle = "#fff8f0";
  ctx.fillRect(0, 0, size, size);

  // Panel lines
  ctx.strokeStyle = "#1565c0";
  ctx.lineWidth = 8;

  // Curved panel lines
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.quadraticCurveTo(size / 2, size * 0.3, size, size / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.quadraticCurveTo(size * 0.3, size / 2, size / 2, size);
  ctx.stroke();

  // Yellow/gold accents
  ctx.fillStyle = "#ffc107";
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(size * 0.25, size * 0.25, 30, 50, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.75, size * 0.75, 30, 50, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
})();

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.21, 32, 32),
  new THREE.MeshStandardMaterial({
    map: ballTexture,
    roughness: 0.6,
    metalness: 0.0,
    envMapIntensity: 0.4
  })
);
ball.position.set(0, 3, 4);
ball.castShadow = true;
ball.userData = { side: "away", dragHeight: 3, kind: "ball" };

// Invisible hit area for easier grabbing on mobile
const ballHitArea = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 16, 16),
  new THREE.MeshBasicMaterial({ visible: false })
);
ball.add(ballHitArea);

const allPlayers = [...players, ball];
scene.add(...players, ball);

// Block shadow (wedge from blocker occlusion)
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.45,
  side: THREE.DoubleSide,
  depthWrite: false,
  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilRef: 0,
  stencilZPass: THREE.IncrementStencilOp
});
const blockShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
blockShadow.rotation.set(0, 0, 0);
blockShadow.position.set(0, 0, 0);
blockShadow.renderOrder = -1;
scene.add(blockShadow);

// Net shadow (dead zone where hard hits can't reach)
const netShadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.45,
  side: THREE.DoubleSide,
  depthWrite: false,
  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilRef: 0,
  stencilZPass: THREE.IncrementStencilOp
});
const netShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), netShadowMat);
netShadow.renderOrder = -1;
scene.add(netShadow);

// Attack indicator (arced tube)
const attackLineMat = new THREE.MeshBasicMaterial({ color: 0x8b00ff });
let attackLine = new THREE.Mesh(new THREE.BufferGeometry(), attackLineMat);
scene.add(attackLine);

const attackTarget = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.45, 48),
  new THREE.MeshBasicMaterial({
    color: 0x8b00ff,
    transparent: false,
    opacity: 1.0,
    side: THREE.DoubleSide
  })
);
attackTarget.rotation.x = -Math.PI / 2;
attackTarget.position.set(0, 0.06, -4.5);
attackTarget.userData = { side: "home", dragHeight: 0.06, kind: "target" };

// Invisible hit area for easier grabbing on mobile
const targetHitArea = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 16, 16),
  new THREE.MeshBasicMaterial({ visible: false })
);
attackTarget.add(targetHitArea);

scene.add(attackTarget);

// Inner ring
const attackTargetInner = new THREE.Mesh(
  new THREE.RingGeometry(0.05, 0.12, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  })
);
attackTargetInner.rotation.x = -Math.PI / 2;
attackTarget.add(attackTargetInner);

// Selection Ring
const selectionRing = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.45, 32),
  new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
);
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.position.y = 0.02;
selectionRing.visible = false;
scene.add(selectionRing);

// Zones
const zones = [];
let paintMode = false;
let painting = false;
let zoneStart = null;
let currentZone = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function setPaintMode(active) {
  paintMode = active;
  controls.enabled = !active;
  renderer.domElement.style.cursor = active ? "crosshair" : "default";
  if (!active) hideZoneNodes();
}

function worldPointFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, point);
  return point;
}

function createZoneMesh({ color }) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const geometry = new THREE.BufferGeometry();
  // 4 vertices for a quad
  const vertices = new Float32Array(12); // 4 points * 3 components
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  // 2 triangles (counter-clockwise)
  const indices = [0, 1, 2, 0, 2, 3];
  geometry.setIndex(indices);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.kind = "zone";
  mesh.userData.corners = [
    new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3()
  ];
  mesh.position.y = 0.012; // Base height
  return mesh;
}

function updateZoneGeometry(zone, p1, p2, p3, p4) {
  const pos = zone.geometry.attributes.position;
  // We keep the geometry vertices relative to the zone mesh position (which we can leave at 0, or stick to absolute)
  // Let's use world coordinates for corners in userData, but local in geometry.
  // Actually, easier to keep mesh at y=0.012 and use local coords.
  const corners = [p1, p2, p3, p4];
  zone.userData.corners = corners.map(p => p.clone());

  for (let i = 0; i < 4; i++) {
    pos.setXYZ(i, corners[i].x, 0, corners[i].z);
  }
  pos.needsUpdate = true;
  zone.geometry.computeBoundingSphere();
}

let selectedZone = null;
const zoneNodeHandles = [];

function createZoneNode(zone, index) {
  const geo = new THREE.SphereGeometry(0.12, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.8 });
  const node = new THREE.Mesh(geo, mat);
  node.userData.kind = "zoneNode";
  node.userData.zone = zone;
  node.userData.index = index;
  node.position.copy(zone.userData.corners[index]);
  node.position.y = 0.05; // Slightly above floor
  node.renderOrder = 999;
  return node;
}

function selectZone(zone) {
  hideZoneNodes();
  selectedZone = zone;
  if (!zone) return;

  for (let i = 0; i < 4; i++) {
    const node = createZoneNode(zone, i);
    scene.add(node);
    zoneNodeHandles.push(node);
  }
}

function hideZoneNodes() {
  zoneNodeHandles.forEach(h => scene.remove(h));
  zoneNodeHandles.length = 0;
  selectedZone = null;
}

function clampToCourt(object) {
  const margin = 1.5; // Increased margin to allow players slightly off-court
  const minX = -COURT.halfWidth - margin;
  const maxX = COURT.halfWidth + margin;
  const minZ = -COURT.halfLength - margin;
  const maxZ = COURT.halfLength + margin;

  object.position.x = THREE.MathUtils.clamp(object.position.x, minX, maxX);
  object.position.z = THREE.MathUtils.clamp(object.position.z, minZ, maxZ);
  object.position.y = object.userData.dragHeight ?? 0;

  if (object.userData.side === "home") {
    const netBuffer = object.userData.kind === "target" ? 0.6 : 0.3;
    object.position.z = Math.min(object.position.z, -netBuffer);
  }
  if (object.userData.side === "away") {
    object.position.z = Math.max(object.position.z, 0.4);
  }
}

function updateAttackIndicator() {
  const start = ball.position.clone();
  const end = attackTarget.position.clone();

  const dist = start.distanceTo(end);
  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;

  // Power scales arc height (Higher power = flatter arc, Lower power = loopy dink)
  const powerFactor = parseInt(ui.attackPower.value) / 100;
  const arcBoost = (1.0 - powerFactor) * dist * 0.4; // Low power adds significant height

  const crossesNet = (start.z * end.z) <= 0;
  const basePeak = Math.max(start.y, end.y);
  const hNet = parseFloat(ui.netHeight.value);
  const arcHeight = (crossesNet ? Math.max(basePeak, hNet + 0.1) : basePeak) + arcBoost;

  // Control point for quadratic curve
  const control = new THREE.Vector3(midX, arcHeight + 0.2, midZ);
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);

  // --- Collision Detection ---
  let collisionT = 1.0;
  let collisionType = "none";
  const samples = 80;
  const activeBlockers = players.filter(p => p.userData.isBlocker);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPoint(t);

    // 1. Net Collision (plane at z=0, from y=0 to y=hNet, within court width)
    const prevP = curve.getPoint((i - 1) / samples);
    if ((prevP.z >= 0 && p.z <= 0) || (prevP.z <= 0 && p.z >= 0)) {
      // Find exact t where z=0
      const tNet = (prevP.z) / (prevP.z - p.z);
      const lerpT = ((i - 1) / samples) + (tNet / samples);
      const pNet = curve.getPoint(lerpT);
      
      if (pNet.y <= hNet && Math.abs(pNet.x) <= COURT.halfWidth + 0.5) {
        collisionT = lerpT;
        collisionType = "net";
        break;
      }
    }

    // 2. Blocker Collision (Individual and Tight Blocks)
    for (let j = 0; j < activeBlockers.length; j++) {
      const bA = activeBlockers[j];
      const bAPos = bA.position;
      const bAH = bA.userData.height || 1.9;
      const bAJump = bA.userData.jump || 3.10;
      const radA = bAH * BLOCKER_RADIUS_FACTOR;

      // Individual check
      const dx = p.x - bAPos.x;
      const dz = p.z - bAPos.z;
      if ((dx * dx + dz * dz) < radA * radA && p.y <= bAJump) {
        collisionT = t;
        collisionType = "block";
        break;
      }

      // "Tight Block" check with other blockers
      for (let k = j + 1; k < activeBlockers.length; k++) {
        const bB = activeBlockers[k];
        const bBPos = bB.position;
        const bBJump = bB.userData.jump || 3.10;
        
        const distAB = bAPos.distanceTo(bBPos);
        if (distAB < BLOCK_THRESHOLD) { // Threshold for "tight" block
          // Check distance of point p to segment AB
          const v = new THREE.Vector3().subVectors(bBPos, bAPos);
          const w = new THREE.Vector3().subVectors(p, bAPos);
          v.y = 0; w.y = 0; // Project to floor for proximity check
          
          const c1 = w.dot(v);
          if (c1 <= 0) continue;
          const c2 = v.dot(v);
          if (c2 <= c1) continue;
          
          const b = c1 / c2;
          const pb = bAPos.clone().add(v.clone().multiplyScalar(b));
          const distToSegmentSq = (p.x - pb.x) * (p.x - pb.x) + (p.z - pb.z) * (p.z - pb.z);
          
          if (distToSegmentSq < (radA * radA) && p.y <= Math.max(bAJump, bBJump)) {
            collisionT = t;
            collisionType = "block";
            break;
          }
        }
      }
      if (collisionType !== "none") break;
    }
    if (collisionType !== "none") break;
  }

  // Update visual appearance
  if (collisionType !== "none") {
    attackLineMat.color.set(0xff4444); // Red for blocked
    attackTarget.material.color.set(0xff4444);
    attackTargetInner.material.color.set(0xffffff);
  } else {
    attackLineMat.color.set(0x8b00ff); // Normal purple
    attackTarget.material.color.set(0x8b00ff);
    attackTargetInner.material.color.set(0xffffff);
  }
  attackTarget.visible = true; // Always visible now

  // Re-generate tube geometry (trimmed to collision point)
  const segments = 32;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    points.push(curve.getPoint((i / segments) * collisionT));
  }
  const trimmedCurve = new THREE.CatmullRomCurve3(points);

  attackLine.geometry.dispose();
  attackLine.geometry = new THREE.TubeGeometry(trimmedCurve, segments, 0.04, 8, false);
}

function updatePlayerRotations() {
  const ballPos = ball.position.clone();

  players.forEach(player => {
    // Determine target point: projected ball position at player's height
    // This ensures they rotate only on the Y-axis
    const target = new THREE.Vector3(ballPos.x, player.position.y, ballPos.z);

    // Smoothly or instantly face the ball
    if (player.position.distanceTo(target) > 0.1) {
      player.lookAt(target);
    }

    // Dynamic head pitching: make the head look up/down at the ball
    const head = player.getObjectByName("head");
    const torso = player.getObjectByName("torso");
    if (head && torso) {
      // Get ball position in torso's local space to find the correct pitch relative to the body
      const localBall = torso.worldToLocal(ballPos.clone());
      // The head joint is at torsoH, so we should consider that offset
      const headHeight = player.userData.height * 0.3; // Approx torso height
      const dy = localBall.y - headHeight;
      const dz = localBall.z;
      
      const pitch = Math.atan2(dy, dz);
      // Clamp the neck/head tilt to realistic ranges (-30 to +60 degrees approx)
      head.rotation.x = -THREE.MathUtils.clamp(pitch, -Math.PI / 4, Math.PI / 2.5);
    }
  });
}

function updateBlockShadow() {
  const ballPos = ball.position.clone();
  ballPos.y = 0;
  const depth = 14;

  const activeBlockers = players.filter(p => p.userData.isBlocker);
  if (activeBlockers.length === 0) {
    blockShadow.geometry.dispose();
    blockShadow.geometry = new THREE.BufferGeometry();
    return;
  }

  const clusters = [];
  const shouldMerge = ui.mergeShadows.checked;

  if (!shouldMerge) {
    // Each blocker is its own cluster
    activeBlockers.forEach(p => clusters.push([p]));
  } else {
    // Cluster adjacent blockers (distance < BLOCK_THRESHOLD) to form single unified wedges
    const connections = activeBlockers.map(() => []);
    for (let i = 0; i < activeBlockers.length; i++) {
      for (let j = i + 1; j < activeBlockers.length; j++) {
        if (activeBlockers[i].position.distanceTo(activeBlockers[j].position) < BLOCK_THRESHOLD) {
          connections[i].push(j);
          connections[j].push(i);
        }
      }
    }

    const visited = new Set();
    for (let i = 0; i < activeBlockers.length; i++) {
      if (visited.has(i)) continue;
      const cluster = [];
      const stack = [i];
      visited.add(i);
      while (stack.length > 0) {
        const curr = stack.pop();
        cluster.push(activeBlockers[curr]);
        connections[curr].forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        });
      }
      clusters.push(cluster);
    }
  }

  const allPositions = [];
  const indices = [];

  clusters.forEach((cluster) => {
    let minAngle = Infinity;
    let maxAngle = -Infinity;
    let edgeL = null;
    let edgeR = null;
    let playerL = null;
    let playerR = null;

    cluster.forEach(player => {
      const H = player.userData.height || 1.9;
      const blockerRadius = H * BLOCKER_RADIUS_FACTOR;
      const bPos = player.position.clone(); bPos.y = 0;
      const toBlocker = bPos.clone().sub(ballPos);
      if (toBlocker.lengthSq() < 0.001) return;

      const dir = toBlocker.normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      const eA = bPos.clone().addScaledVector(perp, blockerRadius);
      const eB = bPos.clone().addScaledVector(perp, -blockerRadius);

      [{ edge: eA, player }, { edge: eB, player }].forEach(({ edge, player: p }) => {
        const angle = Math.atan2(edge.z - ballPos.z, edge.x - ballPos.x);
        if (angle < minAngle) { minAngle = angle; edgeL = edge; playerL = p; }
        if (angle > maxAngle) { maxAngle = angle; edgeR = edge; playerR = p; }
      });
    });

    if (!edgeL || !edgeR) return;

    const H_ball = ball.position.y;
    const H_blockL = playerL.userData.jump || 3.10;
    const H_blockR = playerR.userData.jump || 3.10;

    let depth_L = depth;
    let depth_R = depth;

    // Only calculate limited depth if ball is ABOVE the block reach
    if (H_ball > H_blockL + 0.01) {
      const distL = edgeL.distanceTo(ballPos);
      depth_L = Math.min(depth, distL * (H_blockL / (H_ball - H_blockL)));
    }

    if (H_ball > H_blockR + 0.01) {
      const distR = edgeR.distanceTo(ballPos);
      depth_R = Math.min(depth, distR * (H_blockR / (H_ball - H_blockR)));
    }

    const clusterVerts = [];
    const clusterIndices = [];

    // Sort players by angle to find gaps and build bridges
    const sorted = [...cluster].sort((a, b) => {
      const angA = Math.atan2(a.position.z - ballPos.z, a.position.x - ballPos.x);
      const angB = Math.atan2(b.position.z - ballPos.z, b.position.x - ballPos.x);
      return angA - angB;
    });

    const playerWedges = sorted.map(p => {
      const h = p.userData.jump || 3.10;
      const blockerRadius = (p.userData.height || 1.9) * BLOCKER_RADIUS_FACTOR;
      const bPos = p.position.clone(); bPos.y = 0;
      const toBlocker = bPos.clone().sub(ballPos);
      const dir = toBlocker.normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      const eL = bPos.clone().addScaledVector(perp, blockerRadius);
      const eR = bPos.clone().addScaledVector(perp, -blockerRadius);
      const angL = Math.atan2(eL.z - ballPos.z, eL.x - ballPos.x);
      const angR = Math.atan2(eR.z - ballPos.z, eR.x - ballPos.x);

      const leftE = angL < angR ? eL : eR;
      const rightE = angL < angR ? eR : eL;
      const dL = (H_ball > h + 0.01) ? Math.min(depth, leftE.distanceTo(ballPos) * (h / (H_ball - h))) : depth;
      const dR = (H_ball > h + 0.01) ? Math.min(depth, rightE.distanceTo(ballPos) * (h / (H_ball - h))) : depth;

      return {
        nearL: leftE,
        farL: leftE.clone().addScaledVector(leftE.clone().sub(ballPos).normalize(), dL),
        nearR: rightE,
        farR: rightE.clone().addScaledVector(rightE.clone().sub(ballPos).normalize(), dR)
      };
    });

    playerWedges.forEach((wedge, i) => {
      // Add player's own shadow wedge
      const base = clusterVerts.length;
      clusterVerts.push(wedge.nearL, wedge.farL, wedge.farR, wedge.nearR);
      clusterIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);

      // Bridge to next player
      if (i < playerWedges.length - 1) {
        const next = playerWedges[i + 1];
        const bridgeBase = clusterVerts.length;
        clusterVerts.push(wedge.nearR, wedge.farR, next.farL, next.nearL);
        clusterIndices.push(bridgeBase, bridgeBase + 1, bridgeBase + 2, bridgeBase, bridgeBase + 2, bridgeBase + 3);
      }
    });

    const vertexOffset = allPositions.length / 3;
    clusterVerts.forEach(v => allPositions.push(v.x, 0.01, v.z));
    clusterIndices.forEach(idx => indices.push(vertexOffset + idx));
  });

  const positions = new Float32Array(allPositions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  blockShadow.geometry.dispose();
  blockShadow.geometry = geometry;
}

function updateNetShadow() {
  if (!ui.netShadowToggle || !ui.netShadowToggle.checked) {
    netShadow.geometry.dispose();
    netShadow.geometry = new THREE.BufferGeometry();
    return;
  }

  const b = ball.position.clone();
  const H_net = parseFloat(ui.netHeight.value);

  // Only show shadow if ball is in the attacking half (z > 0)
  if (b.z < 0) {
    netShadow.geometry.dispose();
    netShadow.geometry = new THREE.BufferGeometry();
    return;
  }

  // Account for "Power" - lower power means more arc, which reduces the dead zone
  const distToNet = b.z;
  const powerFactor = parseInt(ui.attackPower.value) / 100;
  const arcBoost = (1.0 - powerFactor) * distToNet * 0.4;
  const effectiveHeight = b.y + arcBoost;

  let z_s, x_s1, x_s2;

  if (effectiveHeight > H_net + 0.01) {
    z_s = (H_net * b.z) / (H_net - effectiveHeight);
    const t = effectiveHeight / (effectiveHeight - H_net);
    x_s1 = b.x + t * (-4.5 - b.x);
    x_s2 = b.x + t * (4.5 - b.x);

    z_s = Math.max(z_s, -20);
  } else {
    // Ball (even with arc) cannot clear the net
    z_s = -20;
    x_s1 = -40;
    x_s2 = 40;
  }

  const allPositions = [
    -4.5, 0.005, 0,
    4.5, 0.005, 0,
    x_s2, 0.005, z_s,
    x_s1, 0.005, z_s
  ];

  const positions = new Float32Array(allPositions);
  const indices = [0, 1, 2, 2, 3, 0];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  netShadow.geometry.dispose();
  netShadow.geometry = geometry;
}

// Dragging (custom ground-plane drag)
const draggable = [...allPlayers, attackTarget];
let activeDrag = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPoint = new THREE.Vector3();
const dragOffset = new THREE.Vector3();

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (paintMode) return;
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(draggable, true);

  if (!hits.length) {
    selectedPlayer = null;
    ui.playerUI.style.display = "none";
    selectionRing.visible = false;
    return;
  }

  // Prevent OrbitControls (and other listeners) from initiating
  event.stopImmediatePropagation();
  controls.enabled = false;

  activeDrag = hits[0].object;
  while (activeDrag.parent && !draggable.includes(activeDrag)) {
    activeDrag = activeDrag.parent;
  }
  renderer.domElement.style.cursor = "grabbing";

  // Selection logic
  if (activeDrag.userData.kind === "player") {
    selectedPlayer = activeDrag;
    ui.playerUI.style.display = "block";
    ui.playerLabel.value = selectedPlayer.userData.label;
    ui.pHeight.value = selectedPlayer.userData.height;
    ui.pHeightVal.textContent = selectedPlayer.userData.height.toFixed(2) + "m";
    ui.pJump.value = selectedPlayer.userData.jump || 3.10;
    ui.pJumpVal.textContent = (selectedPlayer.userData.jump || 3.10).toFixed(2) + "m";
    selectionRing.visible = true;
    selectionRing.position.x = selectedPlayer.position.x;
    selectionRing.position.z = selectedPlayer.position.z;
  } else {
    selectedPlayer = null;
    ui.playerUI.style.display = "none";
    selectionRing.visible = false;
  }

  const dragHeight = activeDrag.userData.dragHeight ?? 0;
  dragPlane.set(new THREE.Vector3(0, 1, 0), -dragHeight);
  raycaster.ray.intersectPlane(dragPlane, dragPoint);
  dragOffset.copy(activeDrag.position).sub(dragPoint);
}, { capture: true });

renderer.domElement.addEventListener("pointermove", (event) => {
  if (activeDrag && !paintMode) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
    const dragHeight = activeDrag.userData.dragHeight ?? 0;
    activeDrag.position.set(dragPoint.x + dragOffset.x, dragHeight, dragPoint.z + dragOffset.z);
    clampToCourt(activeDrag);

    // Proximity-based stance switching
    if (activeDrag.userData.kind === "player") {
      const isAtNet = activeDrag.position.z > -1.5;
      if (activeDrag.userData.isBlocker !== isAtNet) {
        setPlayerStance(activeDrag, isAtNet);
      }
    }

    if (selectedPlayer === activeDrag) {
      selectionRing.position.x = activeDrag.position.x;
      selectionRing.position.z = activeDrag.position.z;
    }

    updatePlayerRotations();
    updateAttackIndicator();
    updateBlockShadow();
    updateNetShadow();
    return;
  }

  // Hover effect - change cursor when over draggable objects
  if (!paintMode && !activeDrag) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(draggable, true);
    renderer.domElement.style.cursor = intersects.length > 0 ? "grab" : "default";
  } else if (paintMode) {
    renderer.domElement.style.cursor = "crosshair";
  }
});

function getFullStateJSON() {
  const data = {
    players: players.map((p, i) => ({
      pos: i + 1,
      x: parseFloat(p.position.x.toFixed(2)),
      z: parseFloat(p.position.z.toFixed(2))
    })),
    ball: {
      x: parseFloat(ball.position.x.toFixed(2)),
      z: parseFloat(ball.position.z.toFixed(2))
    },
    target: {
      x: parseFloat(attackTarget.position.x.toFixed(2)),
      z: parseFloat(attackTarget.position.z.toFixed(2))
    },
    physics: {
      height: ui.contactHeight.value,
      power: ui.attackPower.value
    },
    zones: zones.map(z => ({
      color: '#' + z.material.color.getHexString(),
      corners: z.userData.corners.map(c => ({ x: parseFloat(c.x.toFixed(2)), z: parseFloat(c.z.toFixed(2)) }))
    }))
  };
  return JSON.stringify(data, null, 2);
}

renderer.domElement.addEventListener("pointerup", () => {
  if (!activeDrag && !painting) return;

  activeDrag = null;
  painting = false;
  zoneStart = null;
  currentZone = null;

  renderer.domElement.style.cursor = paintMode ? "crosshair" : "default";
  controls.enabled = !paintMode;
  saveLastKnown();
});

// Paint zones
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!paintMode) return;

  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);

  // 1. Check handles
  const nodeHits = raycaster.intersectObjects(zoneNodeHandles);
  if (nodeHits.length) {
    event.stopImmediatePropagation();
    activeDrag = nodeHits[0].object;
    controls.enabled = false;
    dragPlane.set(new THREE.Vector3(0, 1, 0), -0.05);
    raycaster.ray.intersectPlane(dragPlane, dragPoint);
    dragOffset.copy(activeDrag.position).sub(dragPoint);
    return;
  }

  // 2. Check existing zones for selection
  const zoneHits = raycaster.intersectObjects(zones);
  if (zoneHits.length) {
    event.stopImmediatePropagation();
    selectZone(zoneHits[0].object);
    return;
  }

  // 3. New zone creation
  hideZoneNodes();
  controls.enabled = false;
  painting = true;
  zoneStart = worldPointFromEvent(event);
  currentZone = createZoneMesh({
    color: ui.zoneColor.value
  });
  scene.add(currentZone);
  zones.push(currentZone);

  // Initialize corners (needed for node visibility)
  const p = zoneStart.clone();
  updateZoneGeometry(currentZone, p, p.clone(), p.clone(), p.clone());
  selectZone(currentZone);
}, { capture: true });

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!paintMode) return;

  if (activeDrag && activeDrag.userData.kind === "zoneNode") {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      activeDrag.position.set(dragPoint.x + dragOffset.x, 0.05, dragPoint.z + dragOffset.z);
      const zone = activeDrag.userData.zone;
      const idx = activeDrag.userData.index;
      zone.userData.corners[idx].copy(activeDrag.position);
      updateZoneGeometry(zone, ...zone.userData.corners);
    }
    return;
  }

  if (painting && currentZone && zoneStart) {
    const point = worldPointFromEvent(event);
    const p1 = zoneStart.clone();
    const p2 = new THREE.Vector3(point.x, 0, zoneStart.z);
    const p3 = point.clone();
    const p4 = new THREE.Vector3(zoneStart.x, 0, point.z);
    updateZoneGeometry(currentZone, p1, p2, p3, p4);

    // Update handles to match
    zoneNodeHandles.forEach((h, i) => {
      h.position.copy(currentZone.userData.corners[i]);
      h.position.y = 0.05;
    });
  }
});

ui.modeSwitch.addEventListener("click", (event) => {
  const option = event.target.closest(".switch-option");
  if (!option) return;

  const mode = option.dataset.mode;
  setPaintMode(mode === "paint");

  // UI Visuals
  ui.modeSwitch.classList.toggle("dragging", mode === "paint");
  ui.modeSwitch.querySelectorAll(".switch-option").forEach(opt => {
    opt.classList.toggle("active", opt === option);
  });
});

ui.clearZones.addEventListener("click", () => {
  hideZoneNodes();
  zones.forEach((zone) => {
    zone.geometry.dispose();
    zone.material.dispose();
    scene.remove(zone);
  });
  zones.length = 0;
});

ui.resetPlayers.addEventListener("click", () => {
  resetPlayerPositions();
});

ui.rotateTeam.addEventListener("click", () => {
  // Rotate team clockwise (Standard VB rotation)
  // i=0(P1), i=1(P2), i=2(P3), i=3(P4), i=4(P5), i=5(P6)
  const oldPositions = players.map(p => p.position.clone());

  // Rotation: P1 moves to P6's old spot, P6 to P5, P5 to P4, P4 to P3, P3 to P2, P2 to P1
  // This means P6 gets P1's old position, etc.
  players[5].position.copy(oldPositions[0]); // P6 -> Pos 1's old
  players[4].position.copy(oldPositions[5]); // P5 -> Pos 6's old
  players[3].position.copy(oldPositions[4]); // P4 -> Pos 5's old
  players[2].position.copy(oldPositions[3]); // P3 -> Pos 4's old
  players[1].position.copy(oldPositions[2]); // P2 -> Pos 3's old
  players[0].position.copy(oldPositions[1]); // P1 -> Pos 2's old

  players.forEach(p => {
    const isAtNet = p.position.z > -1.5;
    setPlayerStance(p, isAtNet);
  });

  updatePlayerRotations();
  updateBlockShadow();
  saveLastKnown();
});

ui.contactHeight.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  ball.position.y = val;
  ball.userData.dragHeight = ball.position.y;

  ui.heightValue.textContent = val.toFixed(2) + "m";

  updateAttackIndicator();
  updatePlayerRotations();
  updateBlockShadow();
  updateNetShadow();
  saveLastKnown();
});

ui.attackPower.addEventListener("input", (e) => {
  const val = parseInt(e.target.value);

  let label = "Normal";
  if (val < 25) label = "Free";
  else if (val < 50) label = "Weak";
  else if (val > 85) label = "Strong";
  ui.powerValue.textContent = label;

  updateAttackIndicator();
  updateNetShadow();
  saveLastKnown();
});

ui.mergeShadows.addEventListener("change", () => {
  updateBlockShadow();
  saveLastKnown();
});

ui.netShadowToggle.addEventListener("change", () => {
  updateNetShadow();
  saveLastKnown();
});

ui.playerLabel.addEventListener("input", (event) => {
  if (selectedPlayer) {
    updatePlayerLabel(selectedPlayer, event.target.value.toUpperCase());
  }
});

ui.pHeight.addEventListener("input", (e) => {
  if (selectedPlayer) {
    const val = parseFloat(e.target.value);
    ui.pHeightVal.textContent = val.toFixed(2) + "m";
    updatePlayerHeight(selectedPlayer, val);
  }
});

ui.pJump.addEventListener("input", (e) => {
  if (selectedPlayer) {
    const val = parseFloat(e.target.value);
    ui.pJumpVal.textContent = val.toFixed(2) + "m";
    updatePlayerJump(selectedPlayer, val);
  }
});

ui.saveLineup.addEventListener("click", () => saveLineup("NAMED"));
ui.loadLineup.addEventListener("click", () => loadLineup("NAMED"));
ui.deleteLineup.addEventListener("click", deleteLineup);

ui.savePos.addEventListener("click", () => savePositions("NAMED"));
ui.loadPos.addEventListener("click", () => loadPositions("NAMED"));
ui.deletePos.addEventListener("click", deletePosition);
ui.shareLayout.addEventListener("click", generateShareUrl);

refreshDropdowns();

ui.rotateTeam.addEventListener("click", () => {
  // Standard Rotation: 1 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1
  // We'll perform a clockwise shift of positions among the 6 players.
  if (players.length < 6) return;

  // Store current positions
  const pos = players.map(p => p.position.clone());

  // Shift: 
  // Player 1 (idx 0) moves to Player 6's spot (idx 5)
  // Player 6 (idx 5) moves to Player 5's spot (idx 4)
  // Player 5 (idx 4) moves to Player 4's spot (idx 3)
  // Player 4 (idx 3) moves to Player 3's spot (idx 2)
  // Player 3 (idx 2) moves to Player 2's spot (idx 1)
  // Player 2 (idx 1) moves to Player 1's spot (idx 0)

  const oldPos = [...pos];
  players[0].position.copy(oldPos[5]);
  players[5].position.copy(oldPos[4]);
  players[4].position.copy(oldPos[3]);
  players[3].position.copy(oldPos[2]);
  players[2].position.copy(oldPos[1]);
  players[1].position.copy(oldPos[0]);

  // Update heights/stances/shadows
  players.forEach(p => {
    const isAtNet = p.position.z > -1.5;
    setPlayerStance(p, isAtNet);
    p.position.y = p.userData.dragHeight;
  });

  if (selectedPlayer) {
    selectionRing.position.x = selectedPlayer.position.x;
    selectionRing.position.z = selectedPlayer.position.z;
  }

  updatePlayerRotations();
  updateBlockShadow();
  updateNetShadow();
  saveLastKnown();
});

function applyTacticalState(data) {
  // Always clear existing zones when applying new tactical state
  hideZoneNodes();
  zones.forEach(z => {
    z.geometry.dispose();
    z.material.dispose();
    scene.remove(z);
  });
  zones.length = 0;

  if (data.players) {
    data.players.forEach((d, i) => {
      if (players[i]) {
        players[i].position.set(d.x, players[i].userData.dragHeight, d.z);
        setPlayerStance(players[i], d.z > -1.5);
      }
    });
  }
  if (data.ball) {
    ball.position.x = data.ball.x;
    ball.position.z = data.ball.z;
  }
  if (data.target) {
    attackTarget.position.x = data.target.x;
    attackTarget.position.z = data.target.z;
  }
  if (data.physics) {
    ui.contactHeight.value = data.physics.height;
    ui.attackPower.value = data.physics.power;
    if (data.physics.mergeShadows !== undefined) {
      ui.mergeShadows.checked = data.physics.mergeShadows;
    }
    if (data.physics.netShadow !== undefined) {
      ui.netShadowToggle.checked = data.physics.netShadow;
    }
    ui.contactHeight.dispatchEvent(new Event('input'));
    ui.attackPower.dispatchEvent(new Event('input'));
  }

  if (data.zones) {
    data.zones.forEach(zd => {
      const z = createZoneMesh({ color: zd.color });
      const corners = zd.corners.map(c => new THREE.Vector3(c.x, 0, c.z));
      updateZoneGeometry(z, ...corners);
      scene.add(z);
      zones.push(z);
    });
  }

  updateBlockShadow();
  updateNetShadow();
  updatePlayerRotations();
  updateAttackIndicator();
  saveLastKnown();
}

function generateShareUrl() {
  const state = {
    r: players.map(p => ({
      l: p.userData.label,
      h: p.userData.height,
      j: p.userData.jump || 3.10
    })),
    t: {
      p: players.map(p => ({
        x: parseFloat(p.position.x.toFixed(2)),
        z: parseFloat(p.position.z.toFixed(2))
      })),
      b: { x: parseFloat(ball.position.x.toFixed(2)), z: parseFloat(ball.position.z.toFixed(2)) },
      tg: { x: parseFloat(attackTarget.position.x.toFixed(2)), z: parseFloat(attackTarget.position.z.toFixed(2)) },
      ph: {
        h: ui.contactHeight.value,
        pw: ui.attackPower.value,
        ms: ui.mergeShadows.checked,
        ns: ui.netShadowToggle.checked
      },
      z: zones.map(z => ({
        c: '#' + z.material.color.getHexString(),
        r: z.userData.corners.map(c => ({ x: parseFloat(c.x.toFixed(2)), z: parseFloat(c.z.toFixed(2)) }))
      }))
    }
  };

  const json = JSON.stringify(state);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const url = new URL(window.location.href);
  url.searchParams.set("s", base64);

  navigator.clipboard.writeText(url.toString()).then(() => {
    alert("Shareable URL copied to clipboard!");
  }).catch(() => {
    prompt("Copy this URL to share:", url.toString());
  });
}

function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get("s");
  if (!shared) return false;

  try {
    const json = decodeURIComponent(escape(atob(shared)));
    const state = JSON.parse(json);

    // Apply roster (r)
    if (state.r) {
      state.r.forEach((d, i) => {
        if (players[i]) {
          updatePlayerLabel(players[i], d.l, true);
          updatePlayerHeight(players[i], d.h, true);
          if (d.j) updatePlayerJump(players[i], d.j, true);
        }
      });
    }

    // Apply tactics (t)
    if (state.t) {
      const legacyData = {
        players: state.t.p,
        ball: state.t.b,
        target: state.t.tg,
        physics: {
          height: state.t.ph.h,
          power: state.t.ph.pw,
          mergeShadows: state.t.ph.ms,
          netShadow: state.t.ph.ns
        },
        zones: state.t.z ? state.t.z.map(zd => ({
          color: zd.c,
          corners: zd.r
        })) : []
      };
      applyTacticalState(legacyData);
    }

    // Clear URL after loading to avoid re-loading on refresh
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  } catch (e) {
    console.warn("Failed to load shared state", e);
    return false;
  }
}

setPaintMode(false);

// Startup Sequence: URL state > Auto-save > Reset
const loadedFromUrl = loadFromUrl();

if (!loadedFromUrl) {
  // Auto-load last session state (auto-saved) if available
  if (localStorage.getItem("volleyballer_lastLineup")) {
    loadLineup("volleyballer_lastLineup", true);
  } else if (localStorage.getItem("volleyballer_lineup")) {
    loadLineup("volleyballer_lineup", true);
  }

  // Important: Load lineup BEFORE loading positions
  if (localStorage.getItem("volleyballer_lastPositions")) {
    loadPositions("volleyballer_lastPositions");
  } else if (localStorage.getItem("volleyballer_positions")) {
    loadPositions("volleyballer_positions");
  } else {
    resetPlayerPositions();
  }
}

// Initial labels for attack physics
ui.heightValue.textContent = "3.00m";
ui.powerValue.textContent = "Normal";

// Resize
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// Menu Toggle Logic
function toggleMenu(force) {
  const isClosed = ui.menu.classList.toggle("closed", force);
  ui.menuToggle.innerHTML = isClosed 
    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>'
    : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
}

ui.menuToggle.addEventListener("click", () => toggleMenu());

// Auto-close menu on mobile when clicking the canvas
renderer.domElement.addEventListener("pointerdown", () => {
  if (window.innerWidth <= 600 && !ui.menu.classList.contains("closed")) {
    toggleMenu(true);
  }
});

// Initial state for mobile
if (window.innerWidth <= 600) {
  toggleMenu(true);
}

// Animate
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.016;

  controls.update();

  players.forEach((player) => {
    player.position.y = player.userData.dragHeight ?? 0;
  });
  attackTarget.position.y = 0.06;

  // Animated attack target
  const pulse = (Math.sin(time * 4) + 1) / 2;
  attackTarget.material.opacity = 0.4 + pulse * 0.4;
  attackTarget.scale.setScalar(0.95 + pulse * 0.15);
  attackTargetInner.material.opacity = 0.6 + pulse * 0.4;

  // Subtle ball rotation
  ball.rotation.x += 0.01;
  ball.rotation.y += 0.005;

  updatePlayerRotations();
  updateAttackIndicator();
  updateBlockShadow();
  updateNetShadow();

  composer.render();
}
animate();
