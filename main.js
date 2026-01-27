import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1118);

// Camera
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 18, 18);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 10;
controls.maxDistance = 35;
controls.minPolarAngle = Math.PI / 5;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(0, 0, 0);
controls.update();

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(6, 14, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 2;
dir.shadow.camera.far = 40;
dir.shadow.camera.left = -12;
dir.shadow.camera.right = 12;
dir.shadow.camera.top = 12;
dir.shadow.camera.bottom = -12;
scene.add(dir);

const hemi = new THREE.HemisphereLight(0x9ecbff, 0x0a0a0a, 0.35);
scene.add(hemi);

// Court and markings
const courtGroup = new THREE.Group();
scene.add(courtGroup);

const courtTexture = (() => {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#1b472c");
  grad.addColorStop(1, "#154023");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 100; i += 4) {
    ctx.fillStyle = i % 8 === 0 ? "#1f5a35" : "#173b25";
    ctx.fillRect(0, i * 8, size, 6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  return texture;
})();

const court = new THREE.Mesh(
  new THREE.PlaneGeometry(COURT.width, COURT.length),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: courtTexture,
    roughness: 0.85,
    metalness: 0.02
  })
);
court.rotation.x = -Math.PI / 2;
court.receiveShadow = true;
courtGroup.add(court);

const linesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
const linesGeometry = new THREE.BufferGeometry();
const linePoints = [];
const halfW = COURT.halfWidth;
const halfL = COURT.halfLength;

// Boundary rectangle
linePoints.push(
  new THREE.Vector3(-halfW, 0.02, -halfL),
  new THREE.Vector3(halfW, 0.02, -halfL),
  new THREE.Vector3(halfW, 0.02, -halfL),
  new THREE.Vector3(halfW, 0.02, halfL),
  new THREE.Vector3(halfW, 0.02, halfL),
  new THREE.Vector3(-halfW, 0.02, halfL),
  new THREE.Vector3(-halfW, 0.02, halfL),
  new THREE.Vector3(-halfW, 0.02, -halfL)
);
// Attack lines (3m from net)
linePoints.push(
  new THREE.Vector3(-halfW, 0.02, -3),
  new THREE.Vector3(halfW, 0.02, -3),
  new THREE.Vector3(-halfW, 0.02, 3),
  new THREE.Vector3(halfW, 0.02, 3)
);
// Center line (net)
linePoints.push(
  new THREE.Vector3(-halfW, 0.02, 0),
  new THREE.Vector3(halfW, 0.02, 0)
);

linesGeometry.setFromPoints(linePoints);
const lines = new THREE.LineSegments(linesGeometry, linesMaterial);
courtGroup.add(lines);

// Net
const netTexture = (() => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(230,230,230,0.7)";
  ctx.lineWidth = 2;
  const step = 24;
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
  texture.repeat.set(2, 1);
  return texture;
})();

const netMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: netTexture,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
  roughness: 0.6,
  metalness: 0.05
});
const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT.width, 1.0), netMaterial);
net.position.y = 2.43 - 0.5;
net.position.z = 0;
net.castShadow = true;
scene.add(net);

const netTape = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width, 0.08, 0.05),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 })
);
netTape.position.y = 2.43 + 0.02;
netTape.position.z = 0;
netTape.castShadow = true;
scene.add(netTape);

const netBottomTape = new THREE.Mesh(
  new THREE.BoxGeometry(COURT.width, 0.06, 0.05),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 })
);
netBottomTape.position.y = 2.43 - 1.0 + 0.03;
netBottomTape.position.z = 0;
netBottomTape.castShadow = true;
scene.add(netBottomTape);

// Player tokens (sprite humans)
function createPlayer({ color, height = 1.7, label, side = "home", isBlocker = false }) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(128, 80, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.beginPath();
  ctx.roundRect(70, 130, 116, 210, 40);
  ctx.fill();

  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.beginPath();
  ctx.roundRect(50, 350, 50, 120, 24);
  ctx.roundRect(156, 350, 50, 120, 24);
  ctx.fill();

  if (isBlocker) {
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.beginPath();
    ctx.roundRect(40, 110, 36, 140, 20);
    ctx.roundRect(180, 110, 36, 140, 20);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);

  const scaleY = height;
  const scaleX = height * 0.45;
  sprite.scale.set(scaleX, scaleY, 1);
  const jumpOffset = isBlocker ? 0.35 : 0;
  sprite.userData = {
    label,
    side,
    dragHeight: scaleY / 2 + jumpOffset,
    jumpOffset,
    kind: "player"
  };
  return sprite;
}

const blockers = [
  createPlayer({ color: 0x1976d2, label: "BL", side: "home", isBlocker: true }),
  createPlayer({ color: 0x1976d2, label: "BR", side: "home", isBlocker: true })
];
blockers[0].position.set(-1.2, blockers[0].userData.dragHeight, -0.6);
blockers[1].position.set(1.2, blockers[1].userData.dragHeight, -0.6);

const defenders = [
  createPlayer({ color: 0x43a047, label: "D1", side: "home" }),
  createPlayer({ color: 0x43a047, label: "D2", side: "home" }),
  createPlayer({ color: 0x43a047, label: "D3", side: "home" }),
  createPlayer({ color: 0x43a047, label: "D4", side: "home" })
];
defenders[0].position.set(-2.5, defenders[0].userData.dragHeight, -5.5);
defenders[1].position.set(0, defenders[1].userData.dragHeight, -6.4);
defenders[2].position.set(2.7, defenders[2].userData.dragHeight, -5.6);
defenders[3].position.set(0, defenders[3].userData.dragHeight, -2.8);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.3, metalness: 0.1 })
);
ball.position.set(0, 3, 4);
ball.castShadow = true;
ball.userData = { side: "away", dragHeight: 3, kind: "ball" };

const allPlayers = [...blockers, ...defenders, ball];
scene.add(...blockers, ...defenders, ball);

// Block shadow (wedge from blocker occlusion)
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
const blockShadows = [];

function createShadowMesh() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat.clone());
  mesh.rotation.set(0, 0, 0);
  mesh.position.set(0, 0, 0);
  scene.add(mesh);
  return mesh;
}

blockShadows.push(createShadowMesh(), createShadowMesh());

// Attack indicator
const attackLineMat = new THREE.LineBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.8 });
const attackLineGeom = new THREE.BufferGeometry();
const attackLine = new THREE.Line(attackLineGeom, attackLineMat);
scene.add(attackLine);

const attackTarget = new THREE.Mesh(
  new THREE.RingGeometry(0.25, 0.5, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
);
attackTarget.rotation.x = -Math.PI / 2;
attackTarget.position.set(0, 0.06, -4.5);
attackTarget.userData = { side: "home", dragHeight: 0.06, kind: "target" };
scene.add(attackTarget);

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
    opacity: type === "undefended" ? 0.25 : 0.18,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.021;
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
  attackLineGeom.setFromPoints([ball.position.clone(), attackTarget.position.clone()]);
}

function updateBlockShadow() {
  const ballPos = ball.position.clone();
  ballPos.y = 0;
  const depth = 12.5;
  const blockerRadius = 0.35;

  blockers.forEach((blocker, index) => {
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

    const shape = new THREE.Shape();
    shape.moveTo(edgeA.x, edgeA.z);
    shape.lineTo(edgeB.x, edgeB.z);
    shape.lineTo(farB.x, farB.z);
    shape.lineTo(farA.x, farA.z);
    shape.lineTo(edgeA.x, edgeA.z);

    const mesh = blockShadows[index];
    const positions = new Float32Array([
      edgeA.x, 0.02, edgeA.z,
      edgeB.x, 0.02, edgeB.z,
      farB.x, 0.02, farB.z,
      farA.x, 0.02, farA.z
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex([0, 1, 2, 2, 3, 0]);
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  });
}

// Dragging
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
    0.021,
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
  netTape.position.y = height + 0.02;
  netBottomTape.position.y = height - 1.0 + 0.03;
});

const initialNetHeight = Number(ui.netHeight?.value) || 2.43;
net.geometry.dispose();
net.geometry = new THREE.PlaneGeometry(COURT.width, 1.0);
net.position.y = initialNetHeight - 0.5;
netTape.position.y = initialNetHeight + 0.02;
netBottomTape.position.y = initialNetHeight - 1.0 + 0.03;

setPaintMode(false);
updateAttackIndicator();
updateBlockShadow();

// Resize
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  blockers.forEach((player) => {
    player.position.y = player.userData.dragHeight ?? 0;
  });
  defenders.forEach((player) => {
    player.position.y = player.userData.dragHeight ?? 0;
  });
  attackTarget.position.y = 0.06;

  const pulse = (Math.sin(performance.now() * 0.004) + 1) / 2;
  attackTarget.material.opacity = 0.35 + pulse * 0.35;
  attackTarget.scale.setScalar(0.9 + pulse * 0.25);

  renderer.render(scene, camera);
}
animate();
