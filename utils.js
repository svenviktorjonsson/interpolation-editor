// utils.js
import * as C from './constants.js';

/**
 * Calculates points for a Catmull-Rom spline (a type of cubic piecewise spline).
 * This is a great starting point for the 'Pass Through' and 'Mixed' modes.
 *
 * @param {Array<Object>} points - An array of points {x, y} the spline must pass through.
 * @param {number} tension - A value from 0 to 1 controlling the curve's tightness.
 * @param {boolean} closed - Whether the path is a closed loop.
 * @param {number} segments - The number of line segments to draw between each pair of points.
 * @returns {Array<Object>} An array of points representing the final curve.
 */
const DEFAULT_SEGMENTS = 16;

const buildCatmullRomMatrix = (tau) => ([
    [-tau, 2 - tau, -2 + tau, tau],
    [2 * tau, -3 + tau, 3 - 2 * tau, -tau],
    [-tau, 0, tau, 0],
    [0, 1, 0, 0]
]);

const formatPolynomial = (coeffs) => {
    const terms = [
        { power: 3, value: coeffs[0] },
        { power: 2, value: coeffs[1] },
        { power: 1, value: coeffs[2] },
        { power: 0, value: coeffs[3] }
    ];

    const formatNumber = (value) => Number(value.toFixed(6));
    return terms
        .filter(term => Math.abs(term.value) > 1e-10)
        .map((term, index) => {
            const sign = term.value < 0 ? '-' : '+';
            const absValue = Math.abs(term.value);
            const formatted = formatNumber(absValue);
            const power = term.power === 0 ? '' : `t^${term.power}`;
            const coefficient = term.power === 0 ? `${formatted}` : `${formatted}${power}`;
            if (index === 0) {
                return term.value < 0 ? `-${coefficient}` : `${coefficient}`;
            }
            return `${sign} ${coefficient}`;
        })
        .join(' ')
        .replace(/t\^1\b/g, 't');
};

const calculateCatmullRomCoefficients = (matrix, p0, p1, p2, p3) => {
    const px = [p0.x, p1.x, p2.x, p3.x];
    const py = [p0.y, p1.y, p2.y, p3.y];
    const coeffX = matrix.map(row => row.reduce((sum, value, index) => sum + value * px[index], 0));
    const coeffY = matrix.map(row => row.reduce((sum, value, index) => sum + value * py[index], 0));
    return { x: coeffX, y: coeffY };
};

const getSplineSegmentPoints = (points, closed) => {
    if (points.length < 2) return [];
    const count = points.length;
    const wrap = (idx) => (idx + count) % count;

    const extrapolateStart = () => ({
        x: points[0].x + (points[0].x - points[1].x),
        y: points[0].y + (points[0].y - points[1].y)
    });
    const extrapolateEnd = () => ({
        x: points[count - 1].x + (points[count - 1].x - points[count - 2].x),
        y: points[count - 1].y + (points[count - 1].y - points[count - 2].y)
    });

    const getPoint = (idx) => {
        if (closed) return points[wrap(idx)];
        if (idx < 0) return extrapolateStart();
        if (idx >= count) return extrapolateEnd();
        return points[idx];
    };

    const last = closed ? count : count - 1;
    const segments = [];
    for (let i = 0; i < last; i++) {
        segments.push({
            index: i,
            p0: getPoint(i - 1),
            p1: getPoint(i),
            p2: getPoint(i + 1),
            p3: getPoint(i + 2)
        });
    }
    return segments;
};

export function getCatmullRomSegments(points, closed = false) {
    return getSplineSegmentPoints(points, closed);
}

export function calculateLinearSpline(points, closed = false, segments = DEFAULT_SEGMENTS) {
    if (points.length < 2) return points;
    const path = [];
    const count = points.length;
    const last = closed ? count : count - 1;

    for (let i = 0; i < last; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % count];
        const startS = i === 0 ? 0 : 1;
        for (let s = startS; s <= segments; s++) {
            const t = s / segments;
            path.push({
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t
            });
        }
    }

    return path;
}

const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));

const normalize = (v) => {
    const len = Math.hypot(v.x, v.y);
    return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v, s) => ({ x: v.x * s, y: v.y * s });
const shortestSweep = (startAngle, endAngle) => {
    const tau = Math.PI * 2;
    let delta = (endAngle - startAngle) % tau;
    if (delta < 0) delta += tau;
    if (delta > Math.PI) delta -= tau;
    return delta;
};

const isAngleBetween = (start, mid, end, clockwise) => {
    const wrap = (angle) => (angle + Math.PI * 2) % (Math.PI * 2);
    const s = wrap(start);
    const m = wrap(mid);
    const e = wrap(end);
    if (clockwise) {
        if (s < e) return m <= s || m >= e;
        return m <= s && m >= e;
    }
    if (s > e) return m >= s || m <= e;
    return m >= s && m <= e;
};

const addArcPoints = (path, center, startAngle, endAngle, clockwise, segments, includeStart) => {
    const totalAngle = clockwise
        ? ((startAngle - endAngle + Math.PI * 2) % (Math.PI * 2))
        : ((endAngle - startAngle + Math.PI * 2) % (Math.PI * 2));
    const steps = Math.max(2, segments);
    for (let i = includeStart ? 0 : 1; i <= steps; i++) {
        const t = i / steps;
        const angle = clockwise
            ? startAngle - totalAngle * t
            : startAngle + totalAngle * t;
        path.push({
            x: center.x + Math.cos(angle) * center.radius,
            y: center.y + Math.sin(angle) * center.radius
        });
    }
};

const chooseArcDirection = (startAngle, endAngle, preferredClockwise) => {
    const wrap = (angle) => (angle + Math.PI * 2) % (Math.PI * 2);
    const start = wrap(startAngle);
    const end = wrap(endAngle);
    const cwSweep = (start - end + Math.PI * 2) % (Math.PI * 2);
    const ccwSweep = (end - start + Math.PI * 2) % (Math.PI * 2);
    const preferredSweep = preferredClockwise ? cwSweep : ccwSweep;
    if (preferredSweep <= Math.PI + 1e-6) {
        return preferredClockwise;
    }
    return !preferredClockwise;
};

const chooseArcDirectionByMid = (startAngle, endAngle, midAngle, preferredClockwise) => {
    const midOnCcw = isAngleBetween(startAngle, midAngle, endAngle, false);
    const midOnCw = isAngleBetween(startAngle, midAngle, endAngle, true);
    if (midOnCcw && !midOnCw) return false;
    if (midOnCw && !midOnCcw) return true;
    return chooseArcDirection(startAngle, endAngle, preferredClockwise);
};

const chooseArcDirectionExcludeMid = (startAngle, endAngle, midAngle, preferredClockwise) => {
    const midOnCcw = isAngleBetween(startAngle, midAngle, endAngle, false);
    const midOnCw = isAngleBetween(startAngle, midAngle, endAngle, true);
    if (midOnCcw && !midOnCw) return true;
    if (midOnCw && !midOnCcw) return false;
    return chooseArcDirection(startAngle, endAngle, preferredClockwise);
};

const circleFromThreePoints = (a, b, c) => {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-8) return null;
    const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y)
        + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
    const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x)
        + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
    const radius = Math.hypot(a.x - ux, a.y - uy);
    return { x: ux, y: uy, radius };
};

export function calculateCornerRadiusPath(points, closed = false, radiusMode = 'fixed', radiusValue = 0, segments = DEFAULT_SEGMENTS, passThrough = false) {
    if (points.length < 2) return points;
    const count = points.length;
    const path = [];
    const corners = [];

    const buildCorner = (i) => {
        const prev = points[(i - 1 + count) % count];
        const curr = points[i];
        const next = points[(i + 1) % count];
        const dirIn = normalize(sub(curr, prev));
        const dirOut = normalize(sub(next, curr));
        const lenA = Math.hypot(prev.x - curr.x, prev.y - curr.y);
        const lenB = Math.hypot(next.x - curr.x, next.y - curr.y);
        const angle = angleBetween(dirIn, dirOut);
        if (!Number.isFinite(angle) || angle < 1e-4) {
            return null;
        }

        const maxOffset = Math.min(lenA, lenB) * 0.5;
        let offset;
        let radius;
        if (radiusMode === 'relative') {
            offset = Math.max(0, Math.min(1, radiusValue)) * maxOffset;
            radius = offset / Math.max(Math.tan(angle / 2), 1e-4);
        } else {
            radius = Math.max(0, radiusValue);
            offset = Math.min(maxOffset, radius * Math.tan(angle / 2));
            radius = offset / Math.max(Math.tan(angle / 2), 1e-4);
        }

        if (offset <= 1e-6 || radius <= 1e-6) {
            return null;
        }

        const tangentA = add(curr, scale(dirIn, -offset));
        const tangentB = add(curr, scale(dirOut, offset));
        const turn = dirIn.x * dirOut.y - dirIn.y * dirOut.x;
        const bisector = normalize(add(dirIn, dirOut));

        const isConcave = turn < 0;
        if (passThrough) {
            const circle = circleFromThreePoints(tangentA, curr, tangentB);
            if (!circle) return null;
            const startAngle = Math.atan2(tangentA.y - circle.y, tangentA.x - circle.x);
            const endAngle = Math.atan2(tangentB.y - circle.y, tangentB.x - circle.x);
            const midAngle = Math.atan2(curr.y - circle.y, curr.x - circle.x);
            const preferredClockwise = !isAngleBetween(startAngle, midAngle, endAngle, false);
            const clockwise = isConcave
                ? chooseArcDirectionByMid(startAngle, endAngle, midAngle, preferredClockwise)
                : chooseArcDirectionExcludeMid(startAngle, endAngle, midAngle, preferredClockwise);
            return { tangentA, tangentB, circle, startAngle, endAngle, clockwise };
        }

        const sinHalf = Math.max(Math.sin(angle / 2), 1e-4);
        const centerDistance = radius / sinHalf;
        const center = add(curr, scale(bisector, centerDistance));
        const circle = { x: center.x, y: center.y, radius };
        const startAngle = Math.atan2(tangentA.y - circle.y, tangentA.x - circle.x);
        const endAngle = Math.atan2(tangentB.y - circle.y, tangentB.x - circle.x);
        const preferredClockwise = turn < 0;
        const midAngle = Math.atan2(curr.y - circle.y, curr.x - circle.x);
        const clockwise = isConcave
            ? chooseArcDirectionByMid(startAngle, endAngle, midAngle, preferredClockwise)
            : chooseArcDirectionExcludeMid(startAngle, endAngle, midAngle, preferredClockwise);
        return { tangentA, tangentB, circle, startAngle, endAngle, clockwise };
    };

    if (closed) {
        for (let i = 0; i < count; i++) {
            const corner = buildCorner(i);
            if (corner) corners.push(corner);
        }
        if (!corners.length) return [...points, points[0]];
        path.push(corners[0].tangentA);
        corners.forEach((corner, index) => {
            addArcPoints(path, corner.circle, corner.startAngle, corner.endAngle, corner.clockwise, segments, false);
            const nextCorner = corners[(index + 1) % corners.length];
            if (nextCorner) {
                path.push(nextCorner.tangentA);
            }
        });
        path.push({ ...path[0] });
        return path;
    }

    path.push(points[0]);
    for (let i = 1; i < count - 1; i++) {
        const corner = buildCorner(i);
        if (!corner) {
            path.push(points[i]);
            continue;
        }
        path.push(corner.tangentA);
        addArcPoints(path, corner.circle, corner.startAngle, corner.endAngle, corner.clockwise, segments, false);
        path.push(corner.tangentB);
    }
    path.push(points[count - 1]);
    return path;
}

const addAffineArcPoints = (path, origin, axisX, axisY, baseScale, segments, includeStart) => {
    const radius = baseScale * 0.5;
    if (radius <= 1e-6) return;
    const center = { x: radius, y: radius };
    const startAngle = Math.PI;
    const endAngle = -Math.PI / 2;
    const sweep = shortestSweep(startAngle, endAngle);
    const steps = Math.max(2, segments);
    for (let i = includeStart ? 0 : 1; i <= steps; i++) {
        const t = i / steps;
        const angle = startAngle + sweep * t;
        const basePoint = {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
        };
        path.push({
            x: origin.x + axisX.x * basePoint.x + axisY.x * basePoint.y,
            y: origin.y + axisX.y * basePoint.x + axisY.y * basePoint.y
        });
    }
};

export function calculateAffineCornerRadiusPath(points, closed = false, radiusMode = 'relative', radiusValue = 0, segments = DEFAULT_SEGMENTS, arcsOnly = false) {
    if (points.length < 2) return points;
    if (radiusValue <= 1e-6) {
        return closed ? [...points, points[0]] : [...points];
    }
    const count = points.length;
    const path = [];
    const corners = [];

    const normalizedMode = radiusMode === 'fixed' ? 'absolute' : radiusMode;

    const buildCorner = (i) => {
        const prev = points[(i - 1 + count) % count];
        const curr = points[i];
        const next = points[(i + 1) % count];
        const edgeIn = sub(prev, curr);
        const edgeOut = sub(next, curr);
        const lenIn = Math.hypot(edgeIn.x, edgeIn.y);
        const lenOut = Math.hypot(edgeOut.x, edgeOut.y);
        if (lenIn <= 1e-6 || lenOut <= 1e-6) return null;

        const maxEdge = Math.max(lenIn, lenOut);
        let baseScale;
        let axisX;
        let axisY;
        if (normalizedMode === 'absolute') {
            const minEdge = Math.min(lenIn, lenOut);
            const clampedRadius = Math.max(0, Math.min(radiusValue, minEdge * 0.5));
            baseScale = clampedRadius * 2;
            axisX = normalize(edgeOut);
            axisY = normalize(edgeIn);
        } else {
            baseScale = Math.max(0, Math.min(1, radiusValue));
            axisX = edgeOut;
            axisY = edgeIn;
        }

        if (baseScale <= 1e-6) return null;
        const radius = baseScale * 0.5;
        const midInDistance = normalizedMode === 'absolute' ? lenIn * 0.5 : 0.5;
        const midOutDistance = normalizedMode === 'absolute' ? lenOut * 0.5 : 0.5;
        const midIn = {
            x: curr.x + axisY.x * midInDistance,
            y: curr.y + axisY.y * midInDistance
        };
        const midOut = {
            x: curr.x + axisX.x * midOutDistance,
            y: curr.y + axisX.y * midOutDistance
        };
        return { origin: curr, axisX, axisY, baseScale, radius, midIn, midOut };
    };

    if (closed) {
        for (let i = 0; i < count; i++) {
            const corner = buildCorner(i);
            if (corner) corners.push(corner);
        }
        if (!corners.length) return [...points, points[0]];
        const firstCorner = corners[0];
        path.push(firstCorner.midIn);
        corners.forEach((corner, index) => {
            if (index > 0) path.push(corner.midIn);
            addAffineArcPoints(path, corner.origin, corner.axisX, corner.axisY, corner.baseScale, segments, true);
            path.push(corner.midOut);
        });
        path.push({ ...firstCorner.midIn });
        return path;
    }

    if (normalizedMode === 'absolute') {
        for (let i = 1; i < count - 1; i++) {
            const corner = buildCorner(i);
            if (corner) corners.push(corner);
        }
        if (!corners.length) return [...points];
        const firstCorner = corners[0];
        path.push(points[0]);
        path.push(firstCorner.midIn);
        corners.forEach((corner, index) => {
            if (index > 0) path.push(corner.midIn);
            addAffineArcPoints(path, corner.origin, corner.axisX, corner.axisY, corner.baseScale, segments, true);
            path.push(corner.midOut);
        });
        path.push(points[count - 1]);
        return path;
    }

    path.push(points[0]);
    for (let i = 1; i < count - 1; i++) {
        const corner = buildCorner(i);
        if (!corner) {
            path.push(points[i]);
            continue;
        }
        path.push(corner.midIn);
        addAffineArcPoints(path, corner.origin, corner.axisX, corner.axisY, corner.baseScale, segments, true);
        path.push(corner.midOut);
    }
    path.push(points[count - 1]);
    return path;
}

const buildUniformKnotVector = (count, degree) => {
    const knots = [];
    const n = count - 1;
    const m = n + degree + 1;
    for (let i = 0; i <= m; i++) {
        if (i <= degree) {
            knots.push(0);
        } else if (i >= m - degree) {
            knots.push(n - degree + 1);
        } else {
            knots.push(i - degree);
        }
    }
    return knots;
};

const deBoor = (k, t, degree, knots, controlPoints) => {
    const d = [];
    for (let j = 0; j <= degree; j++) {
        const point = controlPoints[k - degree + j];
        d[j] = { x: point.x, y: point.y };
    }
    for (let r = 1; r <= degree; r++) {
        for (let j = degree; j >= r; j--) {
            const i = k - degree + j;
            const denom = knots[i + degree + 1 - r] - knots[i];
            const alpha = denom === 0 ? 0 : (t - knots[i]) / denom;
            d[j] = {
                x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
                y: (1 - alpha) * d[j - 1].y + alpha * d[j].y
            };
        }
    }
    return d[degree];
};

export function calculateUniformBSpline(points, closed = false, degree = 3, segments = DEFAULT_SEGMENTS) {
    if (points.length < 2) return points;
    const clampedDegree = Math.max(1, Math.min(5, Math.round(degree)));
    if (clampedDegree === 1) {
        return calculateLinearSpline(points, closed, segments);
    }

    const controlPoints = [...points];
    if (closed) {
        for (let i = 0; i < clampedDegree; i++) {
            controlPoints.push(points[i % points.length]);
        }
    } else {
        const start = points[0];
        const end = points[points.length - 1];
        for (let i = 0; i < clampedDegree; i++) {
            controlPoints.unshift({ ...start });
            controlPoints.push({ ...end });
        }
    }

    if (controlPoints.length <= clampedDegree) return points;

    const knots = buildUniformKnotVector(controlPoints.length, clampedDegree);
    const n = controlPoints.length - 1;
    const maxSpan = n - clampedDegree + 1;
    const path = [];

    for (let span = clampedDegree; span <= n - clampedDegree + 1; span++) {
        const startS = span === clampedDegree ? 0 : 1;
        for (let s = startS; s <= segments; s++) {
            const t = span + s / segments;
            const k = Math.min(Math.floor(t), n);
            path.push(deBoor(k, t, clampedDegree, knots, controlPoints));
        }
    }

    if (closed && path.length) {
        path.push({ ...path[0] });
    }

    return path;
}

/**
 * Calculates points for a Catmull-Rom spline (a type of cubic piecewise spline).
 * This is a great starting point for the 'Pass Through' and 'Mixed' modes.
 *
 * @param {Array<Object>} points - An array of points {x, y} the spline must pass through.
 * @param {number} tension - A value from 0 to 1 controlling the curve's tightness.
 * @param {boolean} closed - Whether the path is a closed loop.
 * @param {number} segments - The number of line segments to draw between each pair of points.
 * @param {object} options - Optional debug settings for logging segment math.
 * @returns {Array<Object>} An array of points representing the final curve.
 */
export function calculateCubicSpline(points, tension = 0.5, closed = false, segments = DEFAULT_SEGMENTS, options = {}) {
    if (points.length < 2) return points;

    const path = [];
    const clampedTension = Math.max(0, Math.min(1, tension));
    const tau = (1 - clampedTension) * 0.5;
    const matrix = buildCatmullRomMatrix(tau);
    const logSegments = options?.logSegments ?? false;
    const label = options?.label ?? 'Catmull-Rom';

    const hermite = (p1, p2, m1, m2, t) => {
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        return {
            x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x,
            y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y
        };
    };

    const segmentsData = getSplineSegmentPoints(points, closed);
    segmentsData.forEach(({ index, p0, p1, p2, p3 }) => {
        if (logSegments) {
            const coeffs = calculateCatmullRomCoefficients(matrix, p0, p1, p2, p3);
            console.groupCollapsed(`${label} segment ${index}`);
            console.log('Matrix M (rows t^3,t^2,t,1; cols P0..P3):', matrix);
            console.log('P0..P3:', p0, p1, p2, p3);
            console.log(`tension: ${clampedTension}, tau: ${tau}`);
            console.log('P(t) = [t^3 t^2 t 1] * M * [P0 P1 P2 P3]');
            console.log(`x(t) = ${formatPolynomial(coeffs.x)}`);
            console.log(`y(t) = ${formatPolynomial(coeffs.y)}`);
            console.groupEnd();
        }

        const startS = index === 0 ? 0 : 1;
        const m1 = { x: (p2.x - p0.x) * tau, y: (p2.y - p0.y) * tau };
        const m2 = { x: (p3.x - p1.x) * tau, y: (p3.y - p1.y) * tau };
        for (let s = startS; s <= segments; s++) {
            const t = s / segments;
            path.push(hermite(p1, p2, m1, m2, t));
        }
    });

    return path;
}