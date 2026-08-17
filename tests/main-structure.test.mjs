import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainSource = await readFile(new URL("../main.js", import.meta.url), "utf8");

test("the rotate button has one canonical handler", () => {
  const handlers = mainSource.match(/ui\.rotateTeam\.addEventListener\("click"/g) || [];
  assert.equal(handlers.length, 1);
  assert.match(mainSource, /rotateClockwisePositions\(players\.map/);
});

test("the animation loop does not rebuild tactical geometry", () => {
  const animateStart = mainSource.indexOf("function animate() {");
  const animateEnd = mainSource.indexOf("\nanimate();", animateStart);
  assert.ok(animateStart >= 0 && animateEnd > animateStart);
  const animateBody = mainSource.slice(animateStart, animateEnd);
  for (const update of [
    "updateAttackIndicator()",
    "updateBlockShadow()",
    "updateNetShadow()",
    "updateAntennaShadows()",
    "updatePlayerRotations()"
  ]) {
    assert.doesNotMatch(animateBody, new RegExp(update.replace(/[()]/g, "\\$&")));
  }
});

test("saved tactics include every physics and display control", () => {
  const stateStart = mainSource.indexOf("function getFullStateJSON()");
  const stateEnd = mainSource.indexOf("\n}\n\nrenderer.domElement.addEventListener(\"pointerup\"", stateStart) + 2;
  const stateFunction = mainSource.slice(stateStart, stateEnd);
  assert.match(stateFunction, /height: ui\.contactHeight\.value/);
  assert.match(stateFunction, /power: ui\.attackPower\.value/);
  assert.match(stateFunction, /mergeShadows: ui\.mergeShadows\.checked/);
  assert.match(stateFunction, /netShadow: ui\.netShadowToggle\.checked/);
  assert.match(stateFunction, /netHeight: ui\.netHeight\.value/);
});

test("clearing zones immediately updates the saved session", () => {
  const clearStart = mainSource.indexOf('ui.clearZones.addEventListener("click"');
  const clearEnd = mainSource.indexOf("\n});", clearStart) + 4;
  assert.match(mainSource.slice(clearStart, clearEnd), /saveLastKnown\(\)/);
});

test("OutputPass is the final post-processing pass", () => {
  const vignetteIndex = mainSource.indexOf("composer.addPass(vignettePass)");
  const outputIndex = mainSource.indexOf("composer.addPass(outputPass)");
  assert.ok(vignetteIndex >= 0 && outputIndex > vignetteIndex);
  assert.equal(mainSource.indexOf("composer.addPass(", outputIndex + 1), -1);
});

test("the animated glTF player is primary and retains a procedural fallback", () => {
  assert.match(mainSource, /new GLTFLoader\(\)\.loadAsync\("\.\/assets\/volleyball-player\.glb"\)/);
  assert.match(mainSource, /return playerModelAsset \? createGLTFPlayer\(options\) : createProceduralPlayer\(options\)/);
  assert.match(mainSource, /player\.userData\.mixer\?\.update\(delta\)/);
});

test("the focused court omits audience stands and commercial boards", () => {
  assert.doesNotMatch(mainSource, /createArenaEnvironment|InstancedMesh|ledMaterial|standMaterial/);
});

test("tactical shadows extend into a black court-edge falloff", () => {
  assert.match(mainSource, /const TACTICAL_SHADOW_DEPTH = 22/);
  assert.match(mainSource, /const courtEdgeFog = new THREE\.Mesh/);
  assert.match(mainSource, /smoothstep\(0\.25, fadeDistance, distanceFromCourt\)/);
  assert.match(mainSource, /const depth = TACTICAL_SHADOW_DEPTH/);

  const fogStart = mainSource.indexOf("const courtEdgeFog = new THREE.Mesh");
  const fogEnd = mainSource.indexOf("scene.add(courtEdgeFog)", fogStart);
  const fogLayer = mainSource.slice(fogStart, fogEnd);
  assert.match(fogLayer, /depthTest: true/);
  assert.doesNotMatch(fogLayer, /depthTest: false/);
});

test("overlapping block wedges render as a constant-opacity stencil union", () => {
  assert.match(mainSource, /stencilBuffer: true/);
  assert.match(mainSource, /stencilFunc: THREE\.AlwaysStencilFunc/);
  assert.match(mainSource, /stencilFunc: THREE\.EqualStencilFunc/);
  assert.match(mainSource, /const blockShadowFill = new THREE\.Mesh/);
});
