export const GRAVITY = 9.81;

export function rotateClockwisePositions(positions) {
  if (!Array.isArray(positions) || positions.length !== 6) {
    throw new TypeError("A volleyball rotation requires exactly six positions.");
  }
  return [positions[5], positions[0], positions[1], positions[2], positions[3], positions[4]];
}

export function getHorizontalAttackSpeed(power) {
  const normalizedPower = Math.min(1, Math.max(0, Number(power) / 100));
  return 4.8 + (10.8 - 4.8) * Math.pow(normalizedPower, 1.25);
}

export function createBallisticParameters(start, end, power, gravity = GRAVITY) {
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  };
  const horizontalDistance = Math.hypot(delta.x, delta.z);
  const horizontalSpeed = getHorizontalAttackSpeed(power);
  const duration = horizontalDistance / Math.max(horizontalSpeed, 0.01);
  const verticalVelocity = duration > 0
    ? (delta.y + 0.5 * gravity * duration * duration) / duration
    : 0;

  return {
    start: { x: start.x, y: start.y, z: start.z },
    end: { x: end.x, y: end.y, z: end.z },
    delta,
    gravity,
    horizontalSpeed,
    duration,
    verticalVelocity
  };
}

export function getBallisticPoint(parameters, t, target = {}) {
  const time = parameters.duration * t;
  target.x = parameters.start.x + parameters.delta.x * t;
  target.y = parameters.start.y + parameters.verticalVelocity * time
    - 0.5 * parameters.gravity * time * time;
  target.z = parameters.start.z + parameters.delta.z * t;
  return target;
}

export function getNetCrossingT(startZ, endZ) {
  if (startZ * endZ > 0 || Math.abs(startZ - endZ) < 1e-9) return null;
  const t = startZ / (startZ - endZ);
  return t >= 0 && t <= 1 ? t : null;
}

export function projectAntennaShadowEnd(ballX, ballZ, sideX, targetZ, minX, maxX) {
  const directionX = sideX - ballX;
  const directionZ = -ballZ;
  if (Math.abs(directionZ) < 1e-9) return null;
  const scale = targetZ / directionZ;
  const projectedX = sideX + directionX * scale;
  return {
    x: Math.min(maxX, Math.max(minX, projectedX)),
    z: targetZ,
    unclampedX: projectedX
  };
}

export function normalizePhysicsState(input = {}, supportedNetHeights = ["2.43", "2.35", "2.24", "2.20", "2.16"]) {
  const rawHeight = Number(input.height);
  const rawPower = Number(input.power);
  const requestedNetHeight = String(input.netHeight ?? "2.43");

  return {
    height: Number.isFinite(rawHeight) ? Math.min(3.8, Math.max(1, rawHeight)) : 3,
    power: Number.isFinite(rawPower) ? Math.min(100, Math.max(0, rawPower)) : 70,
    mergeShadows: input.mergeShadows === undefined ? true : Boolean(input.mergeShadows),
    netShadow: input.netShadow === undefined ? false : Boolean(input.netShadow),
    netHeight: supportedNetHeights.includes(requestedNetHeight) ? requestedNetHeight : "2.43"
  };
}
