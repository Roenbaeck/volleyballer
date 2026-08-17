import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/GTAOPass.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import {
  createBallisticParameters,
  getBallisticPoint,
  getNetCrossingT,
  normalizePhysicsState,
  projectAntennaShadowEnd,
  rotateClockwisePositions
} from "./tactics-core.js?v=20260817-fidelity11";

let playerModelAsset = null;
try {
  playerModelAsset = await new GLTFLoader().loadAsync("./assets/volleyball-player.glb");
} catch (error) {
  console.warn("Animated player model could not be loaded; using the procedural fallback.", error);
}

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
  trajectoryStatus: document.getElementById("trajectoryStatus"),

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
const TACTICAL_SHADOW_DEPTH = 22;
const EDGE_FOG_FADE_DISTANCE = 9;

// Scene
const scene = new THREE.Scene();

// Restrained studio-style gradient keeps attention on the court.
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

// Black distance fog complements the court-edge veil below.
scene.fog = new THREE.FogExp2(0x030507, 0.012);

// Camera
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 15.2, -24);
camera.lookAt(0, 0.45, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  stencil: true
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.76;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
renderer.domElement.dataset.playerModel = playerModelAsset ? "gltf" : "procedural";

// A neutral image-based lighting environment gives PBR materials coherent
// reflections without requiring a large HDR download.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
roomEnvironment.dispose();
pmremGenerator.dispose();

// Post-processing
const composerTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType,
  depthBuffer: true,
  stencilBuffer: true
});
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
renderPass.clearStencil = true;
composer.addPass(renderPass);

const gtaoPass = new GTAOPass(
  scene,
  camera,
  innerWidth,
  innerHeight,
  undefined,
  { radius: 0.22, distanceExponent: 1.6, thickness: 1.2, distanceFallOff: 0.8, scale: 0.9, samples: 8 },
  { radius: 4, rings: 2, samples: 8 }
);
gtaoPass.blendIntensity = 0.55;
gtaoPass.enabled = innerWidth > 700;
composer.addPass(gtaoPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.15, // strength
  0.3, // radius
  0.92 // threshold
);
composer.addPass(bloomPass);

const smaaPass = new SMAAPass(innerWidth, innerHeight);
composer.addPass(smaaPass);

// Vignette shader
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.34 },
    offset: { value: 0.74 }
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
      float vignette = 1.0 - smoothstep(offset, offset + 0.35, dist * (1.0 + darkness));
      color.rgb *= mix(0.86, 1.0, vignette);
      gl_FragColor = color;
    }
  `
};
const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);

// Tone mapping and sRGB conversion must happen after all visual effects.
const outputPass = new OutputPass();
composer.addPass(outputPass);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 45;
controls.minPolarAngle = Math.PI / 6;
controls.maxPolarAngle = Math.PI / 2.1;
controls.target.set(0, 0.45, 0);
controls.update();

// Lights - Stadium lighting
const ambientLight = new THREE.AmbientLight(0x6f91ad, 0.22);
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

// Overhead court lights
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

createSpotLight(-12, 12, 95, 0xffffff, false);
createSpotLight(12, 12, 60, 0xffffff, false);
createSpotLight(-12, -12, 70, 0xffeedd, false);
createSpotLight(12, -12, 40, 0xffeedd, false);

// Hemisphere light for realistic ambient
const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362a1a, 0.25);
scene.add(hemi);

// Neutral floor outside the court
const arenaFloorGeo = new THREE.PlaneGeometry(60, 60);
const arenaFloorMat = new THREE.MeshStandardMaterial({
  color: 0x080b0e,
  roughness: 0.92,
  metalness: 0.05
});
const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
arenaFloor.rotation.x = -Math.PI / 2;
arenaFloor.position.y = -0.02;
arenaFloor.receiveShadow = true;
scene.add(arenaFloor);

// Court group
const courtGroup = new THREE.Group();
scene.add(courtGroup);

// Authored maple texture generated for the project. Mirrored repeat avoids an
// obvious edge even on GPUs that sample the outermost texels aggressively.
function configureCourtTexture(texture, colorSpace = THREE.NoColorSpace) {
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const courtTexture = configureCourtTexture(
  new THREE.TextureLoader().load("./assets/court-maple.webp"),
  THREE.SRGBColorSpace
);
const courtRoughnessMap = configureCourtTexture(
  new THREE.TextureLoader().load("./assets/court-roughness.webp")
);
const courtHeightMap = configureCourtTexture(
  new THREE.TextureLoader().load("./assets/court-height.webp")
);

const court = new THREE.Mesh(
  new THREE.PlaneGeometry(COURT.width, COURT.length),
  new THREE.MeshPhysicalMaterial({
    color: 0xb98755,
    map: courtTexture,
    bumpMap: courtHeightMap,
    bumpScale: 0.014,
    roughnessMap: courtRoughnessMap,
    roughness: 0.68,
    metalness: 0.0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.55
  })
);
court.rotation.x = -Math.PI / 2;
court.receiveShadow = true;
courtGroup.add(court);

const courtBase = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width + 0.38, 0.12, COURT.length + 0.38),
  new THREE.MeshPhysicalMaterial({
    color: 0x101820,
    roughness: 0.5,
    metalness: 0.12,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4
  })
);
courtBase.position.y = -0.085;
courtBase.receiveShadow = true;
courtGroup.add(courtBase);

// A world-space rectangular falloff darkens everything beyond the court. The
// tactical projections remain readable for several metres before dissolving
// into black, while the playing surface itself stays completely unaffected.
const courtEdgeFog = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.ShaderMaterial({
    uniforms: {
      fogColor: { value: new THREE.Color(0x010203) },
      halfExtents: { value: new THREE.Vector2(COURT.halfWidth, COURT.halfLength) },
      fadeDistance: { value: EDGE_FOG_FADE_DISTANCE }
    },
    vertexShader: `
      varying vec2 vWorldXZ;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldXZ = worldPosition.xz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 fogColor;
      uniform vec2 halfExtents;
      uniform float fadeDistance;
      varying vec2 vWorldXZ;

      void main() {
        vec2 outside = max(abs(vWorldXZ) - halfExtents, 0.0);
        float distanceFromCourt = length(outside);
        float haze = smoothstep(0.25, fadeDistance, distanceFromCourt);
        float grain = fract(sin(dot(vWorldXZ, vec2(12.9898, 78.233))) * 43758.5453);
        float alpha = haze * mix(0.91, 0.96, grain);
        gl_FragColor = vec4(fogColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide
  })
);
courtEdgeFog.rotation.x = -Math.PI / 2;
courtEdgeFog.position.y = 0.035;
courtEdgeFog.renderOrder = 50;
scene.add(courtEdgeFog);

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

// Antennas (with red and white stripes texture)
const antennaTexture = (() => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Create alternating red and white horizontal stripes (10cm each in real volleyball)
  const stripeHeight = size / 18; // 18 stripes for 1.8m antenna (10cm each)
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#ff0000" : "#ffffff";
    ctx.fillRect(0, i * stripeHeight, size, stripeHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
})();

const antennaGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 12);
const antennaMat = new THREE.MeshStandardMaterial({
  map: antennaTexture,
  roughness: 0.4,
  metalness: 0.1
});
const leftAntenna = new THREE.Mesh(antennaGeo, antennaMat);
leftAntenna.position.set(-COURT.halfWidth, 2.43 - 1.0 + 0.9, 0);
leftAntenna.castShadow = true;
scene.add(leftAntenna);

const rightAntenna = new THREE.Mesh(antennaGeo, antennaMat.clone());
rightAntenna.position.set(COURT.halfWidth, 2.43 - 1.0 + 0.9, 0);
rightAntenna.castShadow = true;
scene.add(rightAntenna);

function updateNetHeightVisuals() {
  const h = parseFloat(ui.netHeight.value);
  net.position.y = h - 0.5;
  netTape.position.y = h + 0.015;
  netBottomTape.position.y = h - 1.0 + 0.025;
  leftAntenna.position.y = h - 1.0 + 0.9;
  rightAntenna.position.y = h - 1.0 + 0.9;

  updateAttackIndicator();
  updateNetShadow();
  updateAntennaShadows();
  updateBlockShadow();
}

ui.netHeight.addEventListener("change", () => {
  updateNetHeightVisuals();
  saveLastKnown();
});

function drawPlayerLabelCanvas(canvas, text, isBlocker) {
  const ctx = canvas.getContext("2d");
  const accent = isBlocker ? "#55b7ff" : "#75d77d";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(12,18,25,0.94)");
  gradient.addColorStop(1, "rgba(5,9,14,0.84)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 24);
  else ctx.rect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 68px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text).slice(0, 6), canvas.width / 2, canvas.height / 2 + 2);
  ctx.shadowBlur = 0;
}

function createPlayerLabelSprite(label, isBlocker) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  drawPlayerLabelCanvas(canvas, label, isBlocker);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.name = "labelSprite";
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

// Dynamic 3D character models with anatomically correct proportions
function createProceduralPlayer({ color = 0x1565c0, height = 1.9, jump = 3.10, label, side = "home", isBlocker = false }) {
  const group = new THREE.Group();
  const H = height;

  // Materials
  const skinPalette = [0xf0c7ae, 0xd9a07e, 0xb97858, 0x8f5c43, 0x6f4936, 0xe5b99b];
  const labelHash = String(label).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const skinColor = skinPalette[labelHash % skinPalette.length];
  const hairPalette = [0x2b1b13, 0x5a3822, 0x171719, 0x8a603a, 0x3d2a22];
  const skinMat = new THREE.MeshPhysicalMaterial({ color: skinColor, roughness: 0.72, metalness: 0.0, sheen: 0.08 });
  const jerseyMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.68,
    metalness: 0.0,
    sheen: 0.34,
    sheenColor: new THREE.Color(0xffffff),
    sheenRoughness: 0.8
  });
  const jerseyTrimMat = new THREE.MeshStandardMaterial({ color: 0xdceeff, roughness: 0.58, metalness: 0.02 });
  const shortsMat = new THREE.MeshPhysicalMaterial({ color: 0x122038, roughness: 0.66, sheen: 0.18 });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.72 });
  const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0x151b2a, roughness: 0.38, clearcoat: 0.22, clearcoatRoughness: 0.45 });
  const shoeAccentMat = new THREE.MeshStandardMaterial({ color: 0x72d4ff, roughness: 0.52 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairPalette[labelHash % hairPalette.length], roughness: 0.92 });

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

  const collar = new THREE.Mesh(new THREE.TorusGeometry(cw * 0.34, H * 0.008, 8, 24), jerseyTrimMat);
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.72;
  collar.position.set(0, torsoH * 0.93, 0);
  torso.add(collar);

  const chestBand = new THREE.Mesh(new THREE.TorusGeometry(cw * 0.92, H * 0.007, 6, 32), jerseyTrimMat);
  chestBand.rotation.x = Math.PI / 2;
  chestBand.scale.z = 0.66;
  chestBand.position.set(0, torsoH * 0.64, 0);
  torso.add(chestBand);

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

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x17202a, roughness: 0.45 });
  const eyeGeo = new THREE.SphereGeometry(headRad * 0.075, 8, 8);
  for (const sideX of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sideX * headRad * 0.31, headRad * 1.12, headRad * 0.76);
    eye.scale.y = 1.1;
    headJoint.add(eye);

    const ear = new THREE.Mesh(new THREE.SphereGeometry(headRad * 0.13, 8, 8), skinMat);
    ear.position.set(sideX * headRad * 0.87, headRad, 0);
    ear.scale.set(0.5, 1, 0.7);
    headJoint.add(ear);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(headRad * 0.075, headRad * 0.2, 8), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, headRad * 0.92, headRad * 0.84);
  headJoint.add(nose);

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

  const kneePadGeo = new THREE.SphereGeometry(kneeRad * 1.12, 10, 8);
  for (const knee of [leftKnee, rightKnee]) {
    const pad = new THREE.Mesh(kneePadGeo, shortsMat);
    pad.position.z = kneeRad * 0.55;
    pad.scale.set(0.92, 0.82, 0.48);
    pad.castShadow = true;
    knee.add(pad);
  }

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

  for (const shoe of [leftShoe, rightShoe]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(H * 0.06, H * 0.012, H * 0.05), shoeAccentMat);
    stripe.position.set(0, footH * 0.55, H * 0.045);
    stripe.rotation.y = -0.3;
    shoe.add(stripe);
  }

  // === LABEL SPRITE ===
  group.add(createPlayerLabelSprite(label, isBlocker));

  // Metadata
  group.userData = {
    label,
    side,
    kind: "player",
    height,
    jump,
    jerseyMaterial: jerseyMat,
    jerseyTrimMaterial: jerseyTrimMat,
    animationPhase: (labelHash % 11) * 0.57
  };

  setPlayerStance(group, isBlocker);
  return group;
}

function createGLTFPlayer({ height = 1.9, jump = 3.10, label, side = "home", isBlocker = false }) {
  const group = new THREE.Group();
  const model = playerModelAsset.scene.clone(true);
  const jerseyMaterials = [];
  const jerseyTrimMaterials = [];
  const skinMaterials = [];
  const hairMaterials = [];
  const skinPalette = [0xf0c7ae, 0xd9a07e, 0xb97858, 0x8f5c43, 0x6f4936, 0xe5b99b];
  const hairPalette = [0x2b1b13, 0x5a3822, 0x171719, 0x8a603a, 0x3d2a22];
  const labelHash = String(label).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

  model.name = "animatedPlayerModel";
  model.scale.setScalar(height / 1.9);
  model.traverse(object => {
    if (!object.isMesh) return;
    object.geometry = object.geometry.clone();
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const clonedMaterials = sourceMaterials.map(material => material.clone());
    object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
    clonedMaterials.forEach(material => {
      if (material.name === "Jersey") jerseyMaterials.push(material);
      if (material.name === "JerseyTrim") jerseyTrimMaterials.push(material);
      if (material.name === "Skin") skinMaterials.push(material);
      if (material.name === "Hair") hairMaterials.push(material);
    });
    object.castShadow = true;
    object.receiveShadow = true;
  });
  skinMaterials.forEach(material => material.color.setHex(skinPalette[labelHash % skinPalette.length]));
  hairMaterials.forEach(material => material.color.setHex(hairPalette[labelHash % hairPalette.length]));

  group.add(model);
  group.add(createPlayerLabelSprite(label, isBlocker));

  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(
    playerModelAsset.animations.map(clip => [clip.name, mixer.clipAction(clip)])
  );
  group.userData = {
    label,
    side,
    kind: "player",
    height,
    jump,
    isGLTFModel: true,
    model,
    mixer,
    actions,
    jerseyMaterials,
    jerseyTrimMaterials,
    animationPhase: (labelHash % 11) * 0.57
  };

  setPlayerStance(group, isBlocker);
  return group;
}

function createPlayer(options) {
  return playerModelAsset ? createGLTFPlayer(options) : createProceduralPlayer(options);
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

  // Update the player's shared jersey materials in place. This recolors the
  // torso and shoulders together and avoids leaking a GPU material per switch.
  const jerseyMaterials = player.userData.jerseyMaterials
    ?? [player.userData.jerseyMaterial].filter(Boolean);
  const jerseyTrimMaterials = player.userData.jerseyTrimMaterials
    ?? [player.userData.jerseyTrimMaterial].filter(Boolean);
  jerseyMaterials.forEach(material => material.color.setHex(isBlocker ? 0x1769aa : 0x2f8248));
  jerseyTrimMaterials.forEach(material => material.color.setHex(isBlocker ? 0xcfeeff : 0xd7f6d8));
  if (labelSprite?.material?.map?.image) {
    drawPlayerLabelCanvas(labelSprite.material.map.image, player.userData.label, isBlocker);
    labelSprite.material.map.needsUpdate = true;
  }

  if (player.userData.isGLTFModel) {
    const standingReach = H * 1.25;
    player.userData.dragHeight = isBlocker ? Math.max(0, J - standingReach) : 0;
    if (labelSprite) labelSprite.position.y = H + 0.25;

    const action = player.userData.actions?.[isBlocker ? "Block" : "Defend"];
    const previousAction = player.userData.currentAction;
    if (action && action !== previousAction) {
      action.reset().setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      if (player.userData.stanceInitialized) {
        previousAction?.fadeOut(0.12);
        action.fadeIn(0.12).play();
      } else {
        action.play();
        player.userData.mixer.update(action.getClip().duration);
      }
      player.userData.currentAction = action;
    }

    if (!player.userData.stanceInitialized) {
      player.position.y = player.userData.dragHeight;
      player.userData.stanceInitialized = true;
    }
    return;
  }

  // 1. Reset all hierarchical rotations
  [hips, torso, neck, head, leftShoulder, rightShoulder, leftUpperArm, rightUpperArm,
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
  if (!player.userData.stanceInitialized) {
    player.position.y = player.userData.dragHeight;
    player.userData.stanceInitialized = true;
  }
}

function updatePlayerLabel(player, text, silent = false) {
  player.userData.label = text;
  const labelSprite = player.getObjectByName("labelSprite");
  if (!labelSprite) return;

  const canvas = labelSprite.material.map.image;
  drawPlayerLabelCanvas(canvas, text, player.userData.isBlocker);
  labelSprite.material.map.needsUpdate = true;
  if (!silent) saveLastKnown();
}

function disposeObject3D(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  if (root.userData.mixer) {
    root.userData.mixer.stopAllAction();
    if (root.userData.model) root.userData.mixer.uncacheRoot(root.userData.model);
  }

  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach(material => {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    });
  });

  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
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
  disposeObject3D(player);

  updateAttackIndicator();
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
  disposeObject3D(player);

  updateAttackIndicator();
  updateBlockShadow();
  updatePlayerRotations();
  if (!silent) saveLastKnown();
}

function readStorageJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Ignoring invalid saved data for ${key}`, error);
    return fallback;
  }
}

function finiteInRange(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? THREE.MathUtils.clamp(number, min, max) : fallback;
}

function refreshDropdowns() {
  const rosters = readStorageJSON("volleyballer_rosters", {});
  ui.lineupList.innerHTML = '<option value="">Select Lineup...</option>';
  Object.keys(rosters).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    ui.lineupList.appendChild(opt);
  });

  const savedTactics = readStorageJSON("volleyballer_tactics", {});
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
    const rosters = readStorageJSON("volleyballer_rosters", {});
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
    const rosters = readStorageJSON("volleyballer_rosters", {});
    data = rosters[name];
  } else {
    data = readStorageJSON(key, null);
  }

  if (!Array.isArray(data)) {
    if (!silent) alert("No saved lineup found.");
    return;
  }

  data.forEach((d, i) => {
    if (players[i]) {
      updatePlayerLabel(players[i], String(d.label ?? i + 1).slice(0, 6), true);
      updatePlayerHeight(players[i], finiteInRange(d.height, 1.6, 2.2, 1.9), true);
      updatePlayerJump(players[i], finiteInRange(d.jump, 2, 4, 3.1), true);
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
    const rosters = readStorageJSON("volleyballer_rosters", {});
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
    const tactics = readStorageJSON("volleyballer_tactics", {});
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
      const tactics = readStorageJSON("volleyballer_tactics", {});
      data = tactics[name];
    }
  } else {
    data = readStorageJSON(key, null);
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
    const tactics = readStorageJSON("volleyballer_tactics", {});
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

// Block shadows first write a binary stencil mask. A single blue fill is then
// drawn through that mask, so overlapping wedges form a visual union instead
// of accumulating alpha and becoming over-saturated.
const blockShadowMaskMat = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
  stencilWrite: true,
  stencilWriteMask: 0xff,
  stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.ReplaceStencilOp
});
const blockShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blockShadowMaskMat);
blockShadow.renderOrder = -2;
scene.add(blockShadow);

const blockShadowFillMat = new THREE.MeshBasicMaterial({
  color: 0x208ce5,
  transparent: true,
  opacity: 0.26,
  side: THREE.DoubleSide,
  depthWrite: false,
  stencilWrite: true,
  stencilWriteMask: 0x00,
  stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc,
  stencilFuncMask: 0xff,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.KeepStencilOp
});
const blockShadowFill = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), blockShadowFillMat);
blockShadowFill.rotation.x = -Math.PI / 2;
blockShadowFill.position.y = 0.012;
blockShadowFill.renderOrder = -1;
scene.add(blockShadowFill);

// Net shadow (dead zone where hard hits can't reach)
const netShadowMat = new THREE.MeshBasicMaterial({
  color: 0xf2a93b,
  transparent: true,
  opacity: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1.5
});
const netShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), netShadowMat);
netShadow.renderOrder = -1;
scene.add(netShadow);

// Antenna shadows (show unreachable areas based on antenna positioning)
const antennaShadowMat = new THREE.MeshBasicMaterial({
  color: 0xff5b62,
  transparent: true,
  opacity: 0.24,
  side: THREE.DoubleSide,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2
});
const leftAntennaShadow = new THREE.Mesh(new THREE.BufferGeometry(), antennaShadowMat);
leftAntennaShadow.renderOrder = -1;
scene.add(leftAntennaShadow);

const rightAntennaShadow = new THREE.Mesh(new THREE.BufferGeometry(), antennaShadowMat);
rightAntennaShadow.renderOrder = -1;
scene.add(rightAntennaShadow);

// Attack indicator (arced tube)
const attackLineMat = new THREE.MeshStandardMaterial({
  color: 0x8f5bff,
  emissive: 0x24105e,
  emissiveIntensity: 1.15,
  roughness: 0.34,
  metalness: 0.08
});
let attackLine = new THREE.Mesh(new THREE.BufferGeometry(), attackLineMat);
scene.add(attackLine);

const attackTarget = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.45, 48),
  new THREE.MeshBasicMaterial({
    color: 0x8b00ff,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false
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
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2.5
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
  zoneNodeHandles.forEach(handle => {
    scene.remove(handle);
    handle.geometry.dispose();
    handle.material.dispose();
  });
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
  if (object.userData.kind !== "player") {
    object.position.y = object.userData.dragHeight ?? 0;
  }

  if (object.userData.side === "home") {
    const netBuffer = object.userData.kind === "target" ? 0.6 : 0.3;
    object.position.z = Math.min(object.position.z, -netBuffer);
  }
  if (object.userData.side === "away") {
    object.position.z = Math.max(object.position.z, 0.4);
  }
}

const BALL_RADIUS = 0.21;

class BallisticCurve extends THREE.Curve {
  constructor(start, end, power) {
    super();
    this.start = start.clone();
    this.end = end.clone();
    this.parameters = createBallisticParameters(start, end, power);
    this.duration = this.parameters.duration;
    this.horizontalSpeed = this.parameters.horizontalSpeed;
    this.verticalVelocity = this.parameters.verticalVelocity;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return getBallisticPoint(this.parameters, t, target);
  }
}

class TrimmedCurve extends THREE.Curve {
  constructor(source, endT) {
    super();
    this.source = source;
    this.endT = endT;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return this.source.getPoint(t * this.endT, target);
  }
}

function getNetCrossing(curve, start, end) {
  const t = getNetCrossingT(start.z, end.z);
  if (t === null) return null;
  return { t, point: curve.getPoint(t) };
}

function getNetOrAntennaCollision(curve, start, end) {
  const crossing = getNetCrossing(curve, start, end);
  if (!crossing) return null;

  if (Math.abs(crossing.point.x) + BALL_RADIUS > COURT.halfWidth) {
    return { t: crossing.t, type: "antenna" };
  }

  const netHeight = parseFloat(ui.netHeight.value);
  const netBottom = netHeight - 1;
  if (crossing.point.y - BALL_RADIUS <= netHeight && crossing.point.y + BALL_RADIUS >= netBottom) {
    return { t: crossing.t, type: "net" };
  }
  return null;
}

function getIndividualBlockCollisionT(curve, start, end, blocker) {
  const pathX = end.x - start.x;
  const pathZ = end.z - start.z;
  const relX = start.x - blocker.position.x;
  const relZ = start.z - blocker.position.z;
  const radius = (blocker.userData.height || 1.9) * BLOCKER_RADIUS_FACTOR + BALL_RADIUS;
  const a = pathX * pathX + pathZ * pathZ;
  const b = 2 * (relX * pathX + relZ * pathZ);
  const c = relX * relX + relZ * relZ - radius * radius;
  if (a < 1e-8) return null;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  if (c <= 0) candidates.unshift(0);
  const reach = blocker.userData.jump || 3.10;

  for (const t of candidates.sort((x, y) => x - y)) {
    if (t < 0 || t > 1) continue;
    const point = curve.getPoint(t);
    if (point.y - BALL_RADIUS <= reach && point.y + BALL_RADIUS >= 0) return t;
  }
  return null;
}

function getTightBlockCollisionT(curve, blockers, currentBest = 1) {
  const samples = 120;
  for (let i = 0; i < blockers.length; i++) {
    for (let j = i + 1; j < blockers.length; j++) {
      const a = blockers[i];
      const b = blockers[j];
      const segmentX = b.position.x - a.position.x;
      const segmentZ = b.position.z - a.position.z;
      const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
      if (segmentLengthSq <= 1e-8 || Math.sqrt(segmentLengthSq) >= BLOCK_THRESHOLD) continue;

      const bridgeRadius = Math.min(a.userData.height || 1.9, b.userData.height || 1.9) * BLOCKER_RADIUS_FACTOR + BALL_RADIUS;
      for (let sample = 1; sample <= samples; sample++) {
        const t = (sample / samples) * currentBest;
        const point = curve.getPoint(t);
        const along = THREE.MathUtils.clamp(
          ((point.x - a.position.x) * segmentX + (point.z - a.position.z) * segmentZ) / segmentLengthSq,
          0,
          1
        );
        const closestX = a.position.x + segmentX * along;
        const closestZ = a.position.z + segmentZ * along;
        const dx = point.x - closestX;
        const dz = point.z - closestZ;
        const reach = THREE.MathUtils.lerp(a.userData.jump || 3.10, b.userData.jump || 3.10, along);
        if (dx * dx + dz * dz <= bridgeRadius * bridgeRadius && point.y - BALL_RADIUS <= reach) return t;
      }
    }
  }
  return null;
}

function getTrajectoryCollision(curve, start, end, includeBlockers = true) {
  let collision = getNetOrAntennaCollision(curve, start, end) || { t: 1, type: "none" };
  if (!includeBlockers) return collision.type === "none" ? null : collision;

  const activeBlockers = players.filter(player => player.userData.isBlocker);
  for (const blocker of activeBlockers) {
    const t = getIndividualBlockCollisionT(curve, start, end, blocker);
    if (t !== null && t < collision.t) collision = { t, type: "block" };
  }

  const tightBlockT = getTightBlockCollisionT(curve, activeBlockers, collision.t);
  if (tightBlockT !== null && tightBlockT < collision.t) collision = { t: tightBlockT, type: "block" };
  return collision;
}

function updateAttackIndicator() {
  const start = ball.position.clone();
  const end = attackTarget.position.clone();
  const power = parseInt(ui.attackPower.value, 10);
  const curve = new BallisticCurve(start, end, power);
  const collision = getTrajectoryCollision(curve, start, end);
  const blocked = collision.type !== "none";

  attackLineMat.color.setHex(blocked ? 0xff4d57 : 0x8f5bff);
  if (attackLineMat.emissive) attackLineMat.emissive.setHex(blocked ? 0x5c0710 : 0x24105e);
  attackTarget.material.color.setHex(blocked ? 0xff4d57 : 0x8f5bff);
  attackTargetInner.material.color.set(0xffffff);
  attackTarget.visible = true;
  attackTarget.userData.collisionType = collision.type;
  const collisionLabels = {
    none: "Clear",
    net: "Net contact",
    antenna: "Outside antenna",
    block: "Blocked"
  };
  ui.trajectoryStatus.textContent = collisionLabels[collision.type];
  ui.trajectoryStatus.dataset.state = blocked ? "blocked" : "clear";

  const trimmedCurve = new TrimmedCurve(curve, collision.t);
  attackLine.geometry.dispose();
  attackLine.geometry = new THREE.TubeGeometry(trimmedCurve, 48, 0.035, 10, false);
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
  const depth = TACTICAL_SHADOW_DEPTH;

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

  const start = ball.position.clone();
  const netHeight = parseFloat(ui.netHeight.value);
  const power = parseInt(ui.attackPower.value, 10);

  // Only show shadow if ball is in the attacking half (z > 0)
  if (start.z < 0) {
    netShadow.geometry.dispose();
    netShadow.geometry = new THREE.BufferGeometry();
    return;
  }

  const isBlockedAt = (targetX, targetZ) => {
    const end = new THREE.Vector3(targetX, attackTarget.position.y, targetZ);
    const curve = new BallisticCurve(start, end, power);
    const crossing = getNetCrossing(curve, start, end);
    if (!crossing || Math.abs(crossing.point.x) + BALL_RADIUS > COURT.halfWidth) return false;
    return crossing.point.y - BALL_RADIUS <= netHeight && crossing.point.y + BALL_RADIUS >= netHeight - 1;
  };

  const xSamples = 48;
  const nearZ = -0.6;
  const farZ = -COURT.halfLength;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= xSamples; i++) {
    const x = THREE.MathUtils.lerp(-COURT.halfWidth, COURT.halfWidth, i / xSamples);
    const nearBlocked = isBlockedAt(x, nearZ);
    let boundaryZ = 0;

    if (nearBlocked) {
      if (isBlockedAt(x, farZ)) {
        boundaryZ = farZ;
      } else {
        let blockedZ = nearZ;
        let reachableZ = farZ;
        for (let iteration = 0; iteration < 16; iteration++) {
          const candidateZ = (blockedZ + reachableZ) / 2;
          if (isBlockedAt(x, candidateZ)) blockedZ = candidateZ;
          else reachableZ = candidateZ;
        }
        boundaryZ = blockedZ;
      }
    }

    positions.push(x, 0.007, 0, x, 0.007, boundaryZ);
    if (i < xSamples) {
      const base = i * 2;
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  netShadow.geometry.dispose();
  netShadow.geometry = geometry;
}

function updateAntennaShadows() {
  const antennaTriangles = getAntennaShadowTriangles(ball.position);

  applyAntennaShadowGeometry(leftAntennaShadow, antennaTriangles.left);
  applyAntennaShadowGeometry(rightAntennaShadow, antennaTriangles.right);
}

function getAntennaShadowTriangles(ballPosition) {
  const b = ballPosition.clone();
  const antennaX = COURT.halfWidth;

  if (b.z < 0) {
    return { left: null, right: null };
  }

  const buildTriangle = (isLeft) => {
    const sideX = isLeft ? -antennaX : antennaX;
    const isOutside = isLeft ? (b.x < -antennaX) : (b.x > antennaX);

    if (!isOutside) {
      return null;
    }

    const endZ = -COURT.halfLength - 12;
    const maxVisibleX = COURT.halfWidth + 12;
    const endpoint = projectAntennaShadowEnd(b.x, b.z, sideX, endZ, -maxVisibleX, maxVisibleX);
    if (!endpoint) return null;

    return [
      new THREE.Vector3(sideX, 0.008, 0),
      new THREE.Vector3(sideX, 0.008, endZ),
      new THREE.Vector3(endpoint.x, 0.008, endpoint.z)
    ];
  };

  return {
    left: buildTriangle(true),
    right: buildTriangle(false)
  };
}

function applyAntennaShadowGeometry(shadowMesh, triangle) {
  if (!triangle) {
    shadowMesh.geometry.dispose();
    shadowMesh.geometry = new THREE.BufferGeometry();
    return;
  }

  const [a, b, c] = triangle;
  const positions = new Float32Array([
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();

  shadowMesh.geometry.dispose();
  shadowMesh.geometry = geometry;
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
    const visualHeight = activeDrag.userData.kind === "player" ? activeDrag.position.y : dragHeight;
    activeDrag.position.set(dragPoint.x + dragOffset.x, visualHeight, dragPoint.z + dragOffset.z);
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
    updateAntennaShadows();
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
      power: ui.attackPower.value,
      mergeShadows: ui.mergeShadows.checked,
      netShadow: ui.netShadowToggle.checked,
      netHeight: ui.netHeight.value
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
    opt.setAttribute("aria-pressed", String(opt === option));
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
  saveLastKnown();
});

ui.resetPlayers.addEventListener("click", () => {
  resetPlayerPositions();
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
  updateAntennaShadows();
  saveLastKnown();
});

function setPowerLabel(val) {
  let label = "Normal";
  if (val < 25) label = "Free";
  else if (val < 50) label = "Weak";
  else if (val > 85) label = "Strong";
  ui.powerValue.textContent = label;
}

ui.attackPower.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  setPowerLabel(val);

  updateAttackIndicator();
  updateNetShadow();
  updateAntennaShadows();
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
  // Standard clockwise rotation: 1 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1.
  if (players.length < 6) return;
  const rotatedPositions = rotateClockwisePositions(players.map(player => player.position.clone()));
  players.forEach((player, index) => player.position.copy(rotatedPositions[index]));

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
  updateAttackIndicator();
  updateBlockShadow();
  updateNetShadow();
  updateAntennaShadows();
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

  if (Array.isArray(data.players)) {
    data.players.forEach((d, i) => {
      if (players[i]) {
        const x = finiteInRange(d.x, -COURT.halfWidth - 1.5, COURT.halfWidth + 1.5, players[i].position.x);
        const z = finiteInRange(d.z, -COURT.halfLength - 1.5, -0.3, players[i].position.z);
        players[i].position.set(x, players[i].userData.dragHeight, z);
        setPlayerStance(players[i], z > -1.5);
      }
    });
  }
  if (data.ball) {
    ball.position.x = finiteInRange(data.ball.x, -COURT.halfWidth - 1.5, COURT.halfWidth + 1.5, ball.position.x);
    ball.position.z = finiteInRange(data.ball.z, 0.4, COURT.halfLength + 1.5, ball.position.z);
  }
  if (data.target) {
    attackTarget.position.x = finiteInRange(data.target.x, -COURT.halfWidth - 1.5, COURT.halfWidth + 1.5, attackTarget.position.x);
    attackTarget.position.z = finiteInRange(data.target.z, -COURT.halfLength - 1.5, -0.6, attackTarget.position.z);
  }
  if (data.physics) {
    const supportedNetHeights = [...ui.netHeight.options].map(option => option.value);
    const normalizedPhysics = normalizePhysicsState(data.physics, supportedNetHeights);
    const contactHeight = normalizedPhysics.height;
    const attackPower = normalizedPhysics.power;
    ui.contactHeight.value = String(contactHeight);
    ui.attackPower.value = String(attackPower);
    ball.position.y = contactHeight;
    ball.userData.dragHeight = contactHeight;
    ui.heightValue.textContent = contactHeight.toFixed(2) + "m";
    setPowerLabel(attackPower);
    ui.mergeShadows.checked = normalizedPhysics.mergeShadows;
    ui.netShadowToggle.checked = normalizedPhysics.netShadow;
    ui.netHeight.value = normalizedPhysics.netHeight;
    updateNetHeightVisuals();
  }

  if (Array.isArray(data.zones)) {
    data.zones.forEach(zd => {
      if (!Array.isArray(zd.corners) || zd.corners.length !== 4) return;
      const color = /^#[0-9a-f]{6}$/i.test(zd.color) ? zd.color : "#4fc3f7";
      const corners = zd.corners.map(c => new THREE.Vector3(
        finiteInRange(c.x, -COURT.halfWidth, COURT.halfWidth, 0),
        0,
        finiteInRange(c.z, -COURT.halfLength, COURT.halfLength, 0)
      ));
      const z = createZoneMesh({ color });
      updateZoneGeometry(z, ...corners);
      scene.add(z);
      zones.push(z);
    });
  }

  updateBlockShadow();
  updateNetShadow();
  updateAntennaShadows();
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
        ns: ui.netShadowToggle.checked,
        nh: ui.netHeight.value
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
    if (Array.isArray(state.r)) {
      state.r.forEach((d, i) => {
        if (players[i]) {
          updatePlayerLabel(players[i], String(d.l ?? i + 1).slice(0, 6), true);
          updatePlayerHeight(players[i], finiteInRange(d.h, 1.6, 2.2, 1.9), true);
          updatePlayerJump(players[i], finiteInRange(d.j, 2, 4, 3.1), true);
        }
      });
    }

    // Apply tactics (t)
    if (state.t) {
      const sharedPhysics = state.t.ph || {};
      const legacyData = {
        players: state.t.p,
        ball: state.t.b,
        target: state.t.tg,
        physics: {
          height: sharedPhysics.h,
          power: sharedPhysics.pw,
          mergeShadows: sharedPhysics.ms,
          netShadow: sharedPhysics.ns,
          netHeight: sharedPhysics.nh
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

// Labels reflect restored state rather than overwriting it with defaults.
ui.heightValue.textContent = Number(ui.contactHeight.value).toFixed(2) + "m";
setPowerLabel(parseInt(ui.attackPower.value, 10));

// Resize
addEventListener("resize", () => {
  const pixelRatio = Math.min(devicePixelRatio, 1.75);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  gtaoPass.enabled = innerWidth > 700;
});

// Menu Toggle Logic
function toggleMenu(force) {
  const isClosed = ui.menu.classList.toggle("closed", force);
  ui.menuToggle.setAttribute("aria-expanded", String(!isClosed));
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

// Animate. Tactical geometry is rebuilt only by state-changing events; this
// loop is reserved for camera damping and inexpensive presentation animation.
const clock = new THREE.Clock();
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  time += delta;

  controls.update();

  players.forEach((player, index) => {
    player.userData.mixer?.update(delta);
    const jumpBlend = 1 - Math.exp(-9 * delta);
    player.position.y = THREE.MathUtils.lerp(player.position.y, player.userData.dragHeight ?? 0, jumpBlend);
    const torso = player.getObjectByName("torso");
    if (torso) {
      const breath = Math.sin(time * 1.65 + player.userData.animationPhase + index * 0.17) * 0.006;
      torso.scale.set(1 - breath * 0.35, 1 + breath, 1 - breath * 0.35);
    }
  });
  attackTarget.position.y = 0.06;

  // Animated attack target
  const pulse = (Math.sin(time * 4) + 1) / 2;
  attackTarget.material.opacity = 0.4 + pulse * 0.4;
  attackTarget.scale.setScalar(0.95 + pulse * 0.15);
  attackTargetInner.material.opacity = 0.6 + pulse * 0.4;

  // Subtle ball rotation
  ball.rotation.x += delta * 0.62;
  ball.rotation.y += delta * 0.34;

  composer.render(delta);
}
animate();
