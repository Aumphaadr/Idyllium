import {
  capsuleCollisionShape,
  circleCollisionShape,
  collisionShapeContains,
  collisionShapesIntersect,
  rectangleCollisionShape,
  transformDrawablePoint,
} from '../src/runtime/drawable-geometry';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function close(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-8, `${message}: expected ${expected}, got ${actual}`);
}

const topLeftTransform = {
  x: 300,
  y: 200,
  originX: 0,
  originY: 0,
  rotation: 90,
  scaleX: 1,
  scaleY: 1,
};

const rotatedCorner = transformDrawablePoint({ x: 100, y: 0 }, topLeftTransform);
close(rotatedCorner.x, 300, 'clockwise rotated corner x');
close(rotatedCorner.y, 300, 'clockwise rotated corner y');

const centeredTransform = {
  x: 300,
  y: 200,
  originX: 50,
  originY: 25,
  rotation: 90,
  scaleX: 1,
  scaleY: 1,
};
const centeredCorner = transformDrawablePoint({ x: 0, y: 0 }, centeredTransform);
close(centeredCorner.x, 325, 'center-origin rotated corner x');
close(centeredCorner.y, 150, 'center-origin rotated corner y');

const orbitCenter = { x: 300, y: 200 };
const orbitRadius = 100;
const pointRadius = 5;
for (const angle of [0, 45, 90, 135, 180, 225, 270, 315, 360]) {
  const actual = transformDrawablePoint({ x: pointRadius, y: pointRadius }, {
    x: orbitCenter.x,
    y: orbitCenter.y,
    originX: pointRadius - orbitRadius,
    originY: pointRadius,
    rotation: angle,
    scaleX: 1,
    scaleY: 1,
  });
  const radians = angle * Math.PI / 180;
  close(actual.x, orbitCenter.x + orbitRadius * Math.cos(radians), `orbit x at ${angle} degrees`);
  close(actual.y, orbitCenter.y + orbitRadius * Math.sin(radians), `orbit y at ${angle} degrees`);
}

const plainRectangle = rectangleCollisionShape({ ...topLeftTransform, rotation: 0 }, 100, 50);
const rotatedRectangle = rectangleCollisionShape(topLeftTransform, 100, 50);
assert(collisionShapeContains(plainRectangle, { x: 370, y: 220 }), 'plain rectangle should contain point');
assert(!collisionShapeContains(rotatedRectangle, { x: 370, y: 220 }), 'rotated rectangle should reject old point');
assert(collisionShapeContains(rotatedRectangle, { x: 280, y: 250 }), 'rotated rectangle should contain transformed point');

const outer = rectangleCollisionShape({
  x: 0, y: 0, originX: 0, originY: 0, rotation: 17, scaleX: 1, scaleY: 1,
}, 200, 160);
const inner = rectangleCollisionShape({
  x: 60, y: 50, originX: 0, originY: 0, rotation: 17, scaleX: 1, scaleY: 1,
}, 20, 20);
assert(collisionShapesIntersect(outer, inner), 'nested polygons should intersect without crossing edges');
assert(collisionShapesIntersect(inner, outer), 'polygon intersection should be symmetric');

const firstCircle = circleCollisionShape({
  x: 100, y: 100, originX: 30, originY: 30, rotation: 0, scaleX: 1, scaleY: 1,
}, 30);
const touchingCircle = circleCollisionShape({
  x: 150, y: 100, originX: 20, originY: 20, rotation: 0, scaleX: 1, scaleY: 1,
}, 20);
const separateCircle = circleCollisionShape({
  x: 151, y: 100, originX: 20, originY: 20, rotation: 0, scaleX: 1, scaleY: 1,
}, 20);
assert(collisionShapesIntersect(firstCircle, touchingCircle), 'touching circles should intersect');
assert(!collisionShapesIntersect(firstCircle, separateCircle), 'separate circles should not intersect');

const line = capsuleCollisionShape({ x: 0, y: 10 }, { x: 100, y: 10 }, 10);
assert(collisionShapeContains(line, { x: 50, y: 15 }), 'line boundary should be included');
assert(!collisionShapeContains(line, { x: 50, y: 16 }), 'point outside line thickness should be rejected');
const touchingLine = capsuleCollisionShape({ x: 0, y: 100 }, { x: 65, y: 100 }, 10);
assert(collisionShapesIntersect(touchingLine, firstCircle), 'line capsule should intersect circle');

console.log('drawable geometry: transforms, contains and collision pairs pass');
