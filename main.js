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
  paintToggle: document.getElementById("paintToggle"),
  paintStatus: document.getElementById("paintStatus"),
  zoneType: document.getElementById("zoneType"),
  zoneColor: document.getElementById("zoneColor"),
  netHeight: document.getElementById("netHeight"),
  clearZones: document.getElementById("clearZones"),
  resetPlayers: document.getElementById("resetPlayers")
};

const COURT = {
  width: 9,
  length: 18,
  halfWidth: 4.5,
  halfLength: 9
};

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
camera.position.set(0, 16, 22);
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
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
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
scene.add(createNetPost(-halfW - 0.15));
scene.add(createNetPost(halfW + 0.15));

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
const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT.width, 1.0), netMaterial);
net.position.y = 2.43 - 0.5;
net.position.z = 0;
net.castShadow = true;
net.receiveShadow = true;
scene.add(net);

// Net tape (top)
const netTape = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width, 0.07, 0.03),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
);
netTape.position.y = 2.43 + 0.015;
netTape.position.z = 0;
netTape.castShadow = true;
scene.add(netTape);

// Net tape (bottom)
const netBottomTape = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width, 0.05, 0.03),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
);
netBottomTape.position.y = 2.43 - 1.0 + 0.025;
netBottomTape.position.z = 0;
netBottomTape.castShadow = true;
scene.add(netBottomTape);

// Dynamic 3D character models
function createPlayer({ color, height = 1.75, label, side = "home", isBlocker = false }) {
  const group = new THREE.Group();
  
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8d4c4, roughness: 0.8 });
  const jerseyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });

  const s = height / 1.75;

  // Legs
  const legGeo = new THREE.CapsuleGeometry(0.09 * s, 0.45 * s, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.16 * s, 0.32 * s, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.16 * s, 0.32 * s, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
  
  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.12 * s, 0.08 * s, 0.22 * s);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.16 * s, 0.04 * s, 0.04 * s);
  leftShoe.castShadow = true;
  group.add(leftShoe);
  
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.16 * s, 0.04 * s, 0.04 * s);
  rightShoe.castShadow = true;
  group.add(rightShoe);

  // Torso
  const torsoGeo = new THREE.CylinderGeometry(0.24 * s, 0.18 * s, 0.65 * s, 8);
  const torso = new THREE.Mesh(torsoGeo, jerseyMat);
  torso.position.y = 0.85 * s;
  torso.castShadow = true;
  group.add(torso);

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.3 * s;
  group.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 16, 16), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.rotation.x = -0.2;
  headGroup.add(hair);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.07 * s, 0.45 * s, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  
  if (isBlocker) {
    leftArm.position.set(-0.32 * s, 1.35 * s, 0);
    leftArm.rotation.z = 0.1;
    rightArm.position.set(0.32 * s, 1.35 * s, 0);
    rightArm.rotation.z = -0.1;
  } else {
    leftArm.position.set(-0.32 * s, 0.9 * s, 0.15 * s);
    leftArm.rotation.x = -1.1;
    leftArm.rotation.z = 0.25;
    rightArm.position.set(0.32 * s, 0.9 * s, 0.15 * s);
    rightArm.rotation.x = -1.1;
    rightArm.rotation.z = -0.25;
  }
  leftArm.castShadow = true;
  rightArm.castShadow = true;
  group.add(leftArm, rightArm);

  // Floating label
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 120;
  labelCanvas.height = 60;
  const lctx = labelCanvas.getContext("2d");
  lctx.fillStyle = "rgba(0,0,0,0.6)";
  lctx.beginPath();
  if (lctx.roundRect) {
    lctx.roundRect(0, 0, 120, 60, 12);
  } else {
    lctx.rect(0, 0, 120, 60);
  }
  lctx.fill();
  lctx.fillStyle = "white";
  lctx.font = "bold 30px sans-serif";
  lctx.textAlign = "center";
  lctx.textBaseline = "middle";
  lctx.fillText(label, 60, 30);
  
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = 1.7 * s;
  labelSprite.scale.set(0.8, 0.4, 1);
  group.add(labelSprite);

  const jumpOffset = isBlocker ? 0.35 : 0;
  group.userData = {
    label,
    side,
    dragHeight: jumpOffset,
    jumpOffset,
    kind: "player"
  };
  return group;
}

const blockers = [
  createPlayer({ color: 0x1565c0, label: "BL", side: "home", isBlocker: true }),
  createPlayer({ color: 0x1565c0, label: "BR", side: "home", isBlocker: true })
];
blockers[0].position.set(-1.2, blockers[0].userData.dragHeight, -0.6);
blockers[1].position.set(1.2, blockers[1].userData.dragHeight, -0.6);

const defenders = [
  createPlayer({ color: 0x2e7d32, label: "D1", side: "home" }),
  createPlayer({ color: 0x2e7d32, label: "D2", side: "home" }),
  createPlayer({ color: 0x2e7d32, label: "D3", side: "home" }),
  createPlayer({ color: 0x2e7d32, label: "D4", side: "home" })
];
defenders[0].position.set(-2.5, defenders[0].userData.dragHeight, -5.5);
defenders[1].position.set(0, defenders[1].userData.dragHeight, -6.4);
defenders[2].position.set(2.7, defenders[2].userData.dragHeight, -5.6);
defenders[3].position.set(0, defenders[3].userData.dragHeight, -2.8);

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

const allPlayers = [...blockers, ...defenders, ball];
scene.add(...blockers, ...defenders, ball);

// Block shadow (wedge from blocker occlusion)
const shadowMat = new THREE.MeshBasicMaterial({ 
  color: 0x000000, 
  transparent: true, 
  opacity: 0.45, 
  side: THREE.DoubleSide,
  depthWrite: false
});
const blockShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
blockShadow.rotation.set(0, 0, 0);
blockShadow.position.set(0, 0, 0);
blockShadow.renderOrder = -1;
scene.add(blockShadow);

// Attack indicator (glowing)
const attackLineMat = new THREE.MeshBasicMaterial({ 
  color: 0x8b00ff
});
let attackLine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), attackLineMat);
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
  ui.paintStatus.textContent = active ? "Paint zones" : "Drag players";
  controls.enabled = !active;
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

function createZoneMesh({ color, type }) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: type === "undefended" ? 0.3 : 0.22,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  return mesh;
}

function clampToCourt(object) {
  const margin = 0.4;
  const minX = -COURT.halfWidth + margin;
  const maxX = COURT.halfWidth - margin;
  const minZ = -COURT.halfLength + margin;
  const maxZ = COURT.halfLength - margin;

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
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const length = start.distanceTo(end);
  const dir = end.clone().sub(start).normalize();
  
  attackLine.position.copy(mid);
  attackLine.scale.set(1, length, 1);
  attackLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

function updateBlockShadow() {
  const ballPos = ball.position.clone();
  ballPos.y = 0;
  const depth = 14;
  const blockerRadius = 0.4;

  const allPositions = [];

  blockers.forEach((blocker) => {
    const bPos = blocker.position.clone();
    bPos.y = 0;

    const toBlocker = bPos.clone().sub(ballPos);
    if (toBlocker.lengthSq() < 0.001) return;

    const dir = toBlocker.clone().normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);

    const edgeA = bPos.clone().addScaledVector(perp, blockerRadius);
    const edgeB = bPos.clone().addScaledVector(perp, -blockerRadius);

    const rayA = edgeA.clone().sub(ballPos).normalize();
    const rayB = edgeB.clone().sub(ballPos).normalize();

    const farA = edgeA.clone().addScaledVector(rayA, depth);
    const farB = edgeB.clone().addScaledVector(rayB, depth);

    allPositions.push(
      edgeA.x, 0.01, edgeA.z,
      edgeB.x, 0.01, edgeB.z,
      farB.x, 0.01, farB.z,
      farA.x, 0.01, farA.z
    );
  });

  if (allPositions.length === 0) return;

  const positions = new Float32Array(allPositions);
  const indices = [];
  for (let i = 0; i < blockers.length; i++) {
    const base = i * 4;
    indices.push(base, base + 1, base + 2, base + 2, base + 3, base);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  blockShadow.geometry.dispose();
  blockShadow.geometry = geometry;
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
  if (!hits.length) return;
  
  activeDrag = hits[0].object;
  // Traverse up to find the root draggable group/mesh
  while (activeDrag.parent && !draggable.includes(activeDrag)) {
    activeDrag = activeDrag.parent;
  }

  const dragHeight = activeDrag.userData.dragHeight ?? 0;
  dragPlane.set(new THREE.Vector3(0, 1, 0), -dragHeight);
  raycaster.ray.intersectPlane(dragPlane, dragPoint);
  dragOffset.copy(activeDrag.position).sub(dragPoint);
  controls.enabled = false;
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!activeDrag || paintMode) return;
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
  const dragHeight = activeDrag.userData.dragHeight ?? 0;
  activeDrag.position.set(dragPoint.x + dragOffset.x, dragHeight, dragPoint.z + dragOffset.z);
  clampToCourt(activeDrag);
  updateAttackIndicator();
  updateBlockShadow();
});

renderer.domElement.addEventListener("pointerup", () => {
  if (!activeDrag) return;
  activeDrag = null;
  controls.enabled = !paintMode;
});

// Paint zones
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!paintMode) return;
  controls.enabled = false;
  painting = true;
  zoneStart = worldPointFromEvent(event);
  currentZone = createZoneMesh({
    color: ui.zoneColor.value,
    type: ui.zoneType.value
  });
  scene.add(currentZone);
  zones.push(currentZone);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!paintMode || !painting || !currentZone || !zoneStart) return;
  const point = worldPointFromEvent(event);
  const center = new THREE.Vector3(
    (zoneStart.x + point.x) / 2,
    0.02,
    (zoneStart.z + point.z) / 2
  );
  const width = Math.max(0.3, Math.abs(zoneStart.x - point.x));
  const height = Math.max(0.3, Math.abs(zoneStart.z - point.z));
  currentZone.geometry.dispose();
  currentZone.geometry = new THREE.PlaneGeometry(width, height);
  currentZone.position.set(
    THREE.MathUtils.clamp(center.x, -COURT.halfWidth + 0.2, COURT.halfWidth - 0.2),
    0.015,
    THREE.MathUtils.clamp(center.z, -COURT.halfLength + 0.2, COURT.halfLength - 0.2)
  );
});

renderer.domElement.addEventListener("pointerup", () => {
  if (!paintMode) return;
  painting = false;
  zoneStart = null;
  currentZone = null;
  controls.enabled = !paintMode;
});

ui.paintToggle.addEventListener("change", (event) => {
  setPaintMode(event.target.checked);
});

ui.clearZones.addEventListener("click", () => {
  zones.forEach((zone) => {
    zone.geometry.dispose();
    zone.material.dispose();
    scene.remove(zone);
  });
  zones.length = 0;
});

ui.resetPlayers.addEventListener("click", () => {
  blockers[0].position.set(-1.2, blockers[0].userData.dragHeight, -0.6);
  blockers[1].position.set(1.2, blockers[1].userData.dragHeight, -0.6);
  defenders[0].position.set(-2.5, defenders[0].userData.dragHeight, -5.5);
  defenders[1].position.set(0, defenders[1].userData.dragHeight, -6.4);
  defenders[2].position.set(2.7, defenders[2].userData.dragHeight, -5.6);
  defenders[3].position.set(0, defenders[3].userData.dragHeight, -2.8);
  ball.position.set(0, 3, 4);
  updateAttackIndicator();
  updateBlockShadow();
});

ui.netHeight.addEventListener("change", (event) => {
  const height = Number(event.target.value) || 2.43;
  net.geometry.dispose();
  net.geometry = new THREE.PlaneGeometry(COURT.width, 1.0);
  net.position.y = height - 0.5;
  netTape.position.y = height + 0.015;
  netBottomTape.position.y = height - 1.0 + 0.025;
});

const initialNetHeight = Number(ui.netHeight?.value) || 2.43;
net.geometry.dispose();
net.geometry = new THREE.PlaneGeometry(COURT.width, 1.0);
net.position.y = initialNetHeight - 0.5;
netTape.position.y = initialNetHeight + 0.015;
netBottomTape.position.y = initialNetHeight - 1.0 + 0.025;

setPaintMode(false);
updateAttackIndicator();
updateBlockShadow();

// Resize
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// Animate
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.016;
  
  controls.update();

  blockers.forEach((player) => {
    player.position.y = player.userData.dragHeight ?? 0;
  });
  defenders.forEach((player) => {
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

  composer.render();
}
animate();
