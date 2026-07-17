export interface DrawablePoint {
  readonly x: number;
  readonly y: number;
}

export interface DrawableTransform {
  readonly x: number;
  readonly y: number;
  readonly originX: number;
  readonly originY: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export interface CircleCollisionShape {
  readonly kind: 'circle';
  readonly center: DrawablePoint;
  readonly radius: number;
}

export interface PolygonCollisionShape {
  readonly kind: 'polygon';
  readonly vertices: readonly DrawablePoint[];
}

export interface CapsuleCollisionShape {
  readonly kind: 'capsule';
  readonly start: DrawablePoint;
  readonly end: DrawablePoint;
  readonly radius: number;
}

export type DrawableCollisionShape = CircleCollisionShape | PolygonCollisionShape | CapsuleCollisionShape;

export const DRAWABLE_GEOMETRY_EPSILON = 1e-9;

export function transformDrawablePoint(point: DrawablePoint, transform: DrawableTransform): DrawablePoint {
  const radians = degreesToRadians(transform.rotation);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = (point.x - transform.originX) * transform.scaleX;
  const dy = (point.y - transform.originY) * transform.scaleY;
  return {
    x: transform.x + dx * cosine - dy * sine,
    y: transform.y + dx * sine + dy * cosine,
  };
}

export function inverseTransformDrawablePoint(
  point: DrawablePoint,
  transform: DrawableTransform,
): DrawablePoint | null {
  if (Math.abs(transform.scaleX) <= DRAWABLE_GEOMETRY_EPSILON
    || Math.abs(transform.scaleY) <= DRAWABLE_GEOMETRY_EPSILON) {
    return null;
  }
  const radians = degreesToRadians(transform.rotation);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = point.x - transform.x;
  const dy = point.y - transform.y;
  return {
    x: transform.originX + (dx * cosine + dy * sine) / transform.scaleX,
    y: transform.originY + (-dx * sine + dy * cosine) / transform.scaleY,
  };
}

export function rectangleCollisionShape(
  transform: DrawableTransform,
  width: number,
  height: number,
): PolygonCollisionShape | null {
  if (width <= 0 || height <= 0
    || Math.abs(transform.scaleX) <= DRAWABLE_GEOMETRY_EPSILON
    || Math.abs(transform.scaleY) <= DRAWABLE_GEOMETRY_EPSILON) {
    return null;
  }
  return {
    kind: 'polygon',
    vertices: [
      transformDrawablePoint({ x: 0, y: 0 }, transform),
      transformDrawablePoint({ x: width, y: 0 }, transform),
      transformDrawablePoint({ x: width, y: height }, transform),
      transformDrawablePoint({ x: 0, y: height }, transform),
    ],
  };
}

export function circleCollisionShape(
  transform: DrawableTransform,
  radius: number,
): CircleCollisionShape | null {
  if (radius <= 0) return null;
  const scaleX = Math.abs(transform.scaleX);
  const scaleY = Math.abs(transform.scaleY);
  if (scaleX <= DRAWABLE_GEOMETRY_EPSILON || scaleY <= DRAWABLE_GEOMETRY_EPSILON) return null;
  if (Math.abs(scaleX - scaleY) > DRAWABLE_GEOMETRY_EPSILON) {
    throw new Error('circle collision geometry does not support non-uniform scale');
  }
  return {
    kind: 'circle',
    center: transformDrawablePoint({ x: radius, y: radius }, transform),
    radius: radius * scaleX,
  };
}

export function capsuleCollisionShape(
  start: DrawablePoint,
  end: DrawablePoint,
  thickness: number,
): CapsuleCollisionShape | null {
  if (thickness <= 0) return null;
  return {
    kind: 'capsule',
    start,
    end,
    radius: thickness / 2,
  };
}

export function collisionShapeContains(shape: DrawableCollisionShape | null, point: DrawablePoint): boolean {
  if (shape === null) return false;
  if (shape.kind === 'circle') {
    return squaredDistance(shape.center, point)
      <= shape.radius * shape.radius + DRAWABLE_GEOMETRY_EPSILON;
  }
  if (shape.kind === 'capsule') {
    return pointSegmentDistanceSquared(point, shape.start, shape.end)
      <= shape.radius * shape.radius + DRAWABLE_GEOMETRY_EPSILON;
  }
  return convexPolygonContains(shape, point);
}

export function collisionShapesIntersect(
  first: DrawableCollisionShape | null,
  second: DrawableCollisionShape | null,
): boolean {
  if (first === null || second === null) return false;

  if (first.kind === 'circle' && second.kind === 'circle') {
    const radius = first.radius + second.radius;
    return squaredDistance(first.center, second.center)
      <= radius * radius + DRAWABLE_GEOMETRY_EPSILON;
  }

  if (first.kind === 'polygon' && second.kind === 'polygon') {
    return polygonsIntersect(first, second);
  }

  if (first.kind === 'circle' && second.kind === 'polygon') {
    return circleIntersectsPolygon(first, second);
  }
  if (first.kind === 'polygon' && second.kind === 'circle') {
    return circleIntersectsPolygon(second, first);
  }

  if (first.kind === 'capsule' && second.kind === 'circle') {
    return capsuleIntersectsCircle(first, second);
  }
  if (first.kind === 'circle' && second.kind === 'capsule') {
    return capsuleIntersectsCircle(second, first);
  }

  if (first.kind === 'capsule' && second.kind === 'polygon') {
    return capsuleIntersectsPolygon(first, second);
  }
  if (first.kind === 'polygon' && second.kind === 'capsule') {
    return capsuleIntersectsPolygon(second, first);
  }

  return capsulesIntersect(first as CapsuleCollisionShape, second as CapsuleCollisionShape);
}

function convexPolygonContains(polygon: PolygonCollisionShape, point: DrawablePoint): boolean {
  let sawPositive = false;
  let sawNegative = false;
  for (let index = 0; index < polygon.vertices.length; index++) {
    const start = polygon.vertices[index];
    const end = polygon.vertices[(index + 1) % polygon.vertices.length];
    const cross = crossProduct(subtract(end, start), subtract(point, start));
    if (cross > DRAWABLE_GEOMETRY_EPSILON) sawPositive = true;
    if (cross < -DRAWABLE_GEOMETRY_EPSILON) sawNegative = true;
    if (sawPositive && sawNegative) return false;
  }
  return true;
}

function polygonsIntersect(first: PolygonCollisionShape, second: PolygonCollisionShape): boolean {
  return !hasSeparatingAxis(first, second) && !hasSeparatingAxis(second, first);
}

function hasSeparatingAxis(first: PolygonCollisionShape, second: PolygonCollisionShape): boolean {
  for (let index = 0; index < first.vertices.length; index++) {
    const start = first.vertices[index];
    const end = first.vertices[(index + 1) % first.vertices.length];
    const edge = subtract(end, start);
    const axis = { x: -edge.y, y: edge.x };
    const firstProjection = projectPolygon(first, axis);
    const secondProjection = projectPolygon(second, axis);
    if (firstProjection.max < secondProjection.min - DRAWABLE_GEOMETRY_EPSILON
      || secondProjection.max < firstProjection.min - DRAWABLE_GEOMETRY_EPSILON) {
      return true;
    }
  }
  return false;
}

function projectPolygon(
  polygon: PolygonCollisionShape,
  axis: DrawablePoint,
): { readonly min: number; readonly max: number } {
  let min = dotProduct(polygon.vertices[0], axis);
  let max = min;
  for (let index = 1; index < polygon.vertices.length; index++) {
    const projection = dotProduct(polygon.vertices[index], axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function circleIntersectsPolygon(circle: CircleCollisionShape, polygon: PolygonCollisionShape): boolean {
  if (convexPolygonContains(polygon, circle.center)) return true;
  const radiusSquared = circle.radius * circle.radius + DRAWABLE_GEOMETRY_EPSILON;
  for (let index = 0; index < polygon.vertices.length; index++) {
    const start = polygon.vertices[index];
    const end = polygon.vertices[(index + 1) % polygon.vertices.length];
    if (pointSegmentDistanceSquared(circle.center, start, end) <= radiusSquared) return true;
  }
  return false;
}

function capsuleIntersectsCircle(capsule: CapsuleCollisionShape, circle: CircleCollisionShape): boolean {
  const radius = capsule.radius + circle.radius;
  return pointSegmentDistanceSquared(circle.center, capsule.start, capsule.end)
    <= radius * radius + DRAWABLE_GEOMETRY_EPSILON;
}

function capsuleIntersectsPolygon(capsule: CapsuleCollisionShape, polygon: PolygonCollisionShape): boolean {
  if (convexPolygonContains(polygon, capsule.start) || convexPolygonContains(polygon, capsule.end)) return true;
  const radiusSquared = capsule.radius * capsule.radius + DRAWABLE_GEOMETRY_EPSILON;
  for (let index = 0; index < polygon.vertices.length; index++) {
    const start = polygon.vertices[index];
    const end = polygon.vertices[(index + 1) % polygon.vertices.length];
    if (segmentDistanceSquared(capsule.start, capsule.end, start, end) <= radiusSquared) return true;
  }
  return false;
}

function capsulesIntersect(first: CapsuleCollisionShape, second: CapsuleCollisionShape): boolean {
  const radius = first.radius + second.radius;
  return segmentDistanceSquared(first.start, first.end, second.start, second.end)
    <= radius * radius + DRAWABLE_GEOMETRY_EPSILON;
}

function pointSegmentDistanceSquared(point: DrawablePoint, start: DrawablePoint, end: DrawablePoint): number {
  const segment = subtract(end, start);
  const lengthSquared = dotProduct(segment, segment);
  if (lengthSquared <= DRAWABLE_GEOMETRY_EPSILON) return squaredDistance(point, start);
  const projection = clamp(dotProduct(subtract(point, start), segment) / lengthSquared, 0, 1);
  const closest = {
    x: start.x + segment.x * projection,
    y: start.y + segment.y * projection,
  };
  return squaredDistance(point, closest);
}

function segmentDistanceSquared(
  firstStart: DrawablePoint,
  firstEnd: DrawablePoint,
  secondStart: DrawablePoint,
  secondEnd: DrawablePoint,
): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
  return Math.min(
    pointSegmentDistanceSquared(firstStart, secondStart, secondEnd),
    pointSegmentDistanceSquared(firstEnd, secondStart, secondEnd),
    pointSegmentDistanceSquared(secondStart, firstStart, firstEnd),
    pointSegmentDistanceSquared(secondEnd, firstStart, firstEnd),
  );
}

function segmentsIntersect(
  firstStart: DrawablePoint,
  firstEnd: DrawablePoint,
  secondStart: DrawablePoint,
  secondEnd: DrawablePoint,
): boolean {
  const firstDirection = subtract(firstEnd, firstStart);
  const secondDirection = subtract(secondEnd, secondStart);
  const denominator = crossProduct(firstDirection, secondDirection);
  const offset = subtract(secondStart, firstStart);

  if (Math.abs(denominator) <= DRAWABLE_GEOMETRY_EPSILON) {
    if (Math.abs(crossProduct(offset, firstDirection)) > DRAWABLE_GEOMETRY_EPSILON) return false;
    const firstLengthSquared = dotProduct(firstDirection, firstDirection);
    if (firstLengthSquared <= DRAWABLE_GEOMETRY_EPSILON) {
      return pointSegmentDistanceSquared(firstStart, secondStart, secondEnd) <= DRAWABLE_GEOMETRY_EPSILON;
    }
    const secondPosition = dotProduct(offset, firstDirection) / firstLengthSquared;
    const secondEndPosition = dotProduct(subtract(secondEnd, firstStart), firstDirection) / firstLengthSquared;
    return Math.max(Math.min(secondPosition, secondEndPosition), 0)
      <= Math.min(Math.max(secondPosition, secondEndPosition), 1) + DRAWABLE_GEOMETRY_EPSILON;
  }

  const firstPosition = crossProduct(offset, secondDirection) / denominator;
  const secondPosition = crossProduct(offset, firstDirection) / denominator;
  return firstPosition >= -DRAWABLE_GEOMETRY_EPSILON
    && firstPosition <= 1 + DRAWABLE_GEOMETRY_EPSILON
    && secondPosition >= -DRAWABLE_GEOMETRY_EPSILON
    && secondPosition <= 1 + DRAWABLE_GEOMETRY_EPSILON;
}

function subtract(left: DrawablePoint, right: DrawablePoint): DrawablePoint {
  return { x: left.x - right.x, y: left.y - right.y };
}

function dotProduct(left: DrawablePoint, right: DrawablePoint): number {
  return left.x * right.x + left.y * right.y;
}

function crossProduct(left: DrawablePoint, right: DrawablePoint): number {
  return left.x * right.y - left.y * right.x;
}

function squaredDistance(first: DrawablePoint, second: DrawablePoint): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}
