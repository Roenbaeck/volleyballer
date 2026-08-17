import test from "node:test";
import assert from "node:assert/strict";

import {
  createBallisticParameters,
  getBallisticPoint,
  getNetCrossingT,
  normalizePhysicsState,
  projectAntennaShadowEnd,
  rotateClockwisePositions
} from "../tactics-core.js";

test("clockwise rotation advances each player exactly one position", () => {
  const positions = ["P1", "P2", "P3", "P4", "P5", "P6"];
  assert.deepEqual(rotateClockwisePositions(positions), ["P6", "P1", "P2", "P3", "P4", "P5"]);
});

test("rotation rejects incomplete teams instead of silently corrupting positions", () => {
  assert.throws(() => rotateClockwisePositions(["P1", "P2"]), /exactly six/);
});

test("ballistic trajectory reaches both endpoints and lower power creates a higher arc", () => {
  const start = { x: 0, y: 3, z: 4 };
  const end = { x: 2, y: 0.06, z: -6 };
  const weak = createBallisticParameters(start, end, 20);
  const strong = createBallisticParameters(start, end, 90);

  assert.deepEqual(getBallisticPoint(weak, 0), start);
  const weakEnd = getBallisticPoint(weak, 1);
  assert.ok(Math.abs(weakEnd.x - end.x) < 1e-9);
  assert.ok(Math.abs(weakEnd.y - end.y) < 1e-9);
  assert.ok(Math.abs(weakEnd.z - end.z) < 1e-9);
  assert.ok(getBallisticPoint(weak, 0.5).y > getBallisticPoint(strong, 0.5).y);
});

test("net crossing time is solved analytically", () => {
  assert.equal(getNetCrossingT(4, -6), 0.4);
  assert.equal(getNetCrossingT(4, 2), null);
  assert.equal(getNetCrossingT(0, -2), 0);
});

test("antenna shadow endpoint stays on the projection ray", () => {
  const endpoint = projectAntennaShadowEnd(-6, 4, -4.5, -9, -20, 20);
  assert.ok(endpoint);
  assert.ok(Math.abs(endpoint.x - (-1.125)) < 1e-9);
  const ballToAntenna = { x: 1.5, z: -4 };
  const antennaToEnd = { x: endpoint.x + 4.5, z: endpoint.z };
  const crossProduct = ballToAntenna.x * antennaToEnd.z - ballToAntenna.z * antennaToEnd.x;
  assert.ok(Math.abs(crossProduct) < 1e-9);
});

test("physics normalization preserves zero power and validates all persisted controls", () => {
  assert.deepEqual(
    normalizePhysicsState({
      height: 3.2,
      power: 0,
      mergeShadows: false,
      netShadow: true,
      netHeight: "2.24"
    }),
    {
      height: 3.2,
      power: 0,
      mergeShadows: false,
      netShadow: true,
      netHeight: "2.24"
    }
  );

  assert.deepEqual(
    normalizePhysicsState({ height: "bad", power: 400, netHeight: "9.99" }),
    {
      height: 3,
      power: 100,
      mergeShadows: true,
      netShadow: false,
      netHeight: "2.43"
    }
  );
});
