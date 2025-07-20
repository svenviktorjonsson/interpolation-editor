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
export function calculateCubicSpline(points, tension = 0.5, closed = false, segments = 16) {
    if (points.length < 2) return points;

    const path = [];
    const pts = [...points];

    if (closed) {
        pts.unshift(points[points.length - 1]);
        pts.push(points[0], points[1]);
    } else {
        pts.unshift(points[0]);
        pts.push(points[points.length - 1]);
    }

    const loopEnd = closed ? pts.length - 2 : pts.length - 1;
    for (let i = 1; i < loopEnd; i++) {
        if (i > 1 && !closed) {
             path.push({...pts[i]});
        }
        for (let t = 0; t <= segments; t++) {
            const s = t / segments;

            const p0 = pts[i - 1];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || p2;

            const t01 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), tension);
            const t12 = Math.pow(Math.hypot(p2.x - p1.x, p2.y - p1.y), tension);
            const t23 = Math.pow(Math.hypot(p3.x - p2.x, p3.y - p2.y), tension);

            const m1 = {
                x: ((p2.x - p1.x) / t12 - (p1.x - p0.x) / t01) * (1 - tension) * t12,
                y: ((p2.y - p1.y) / t12 - (p1.y - p0.y) / t01) * (1 - tension) * t12
            };

            const m2 = {
                x: ((p3.x - p2.x) / t23 - (p2.x - p1.x) / t12) * (1 - tension) * t12,
                y: ((p3.y - p2.y) / t23 - (p2.y - p1.y) / t12) * (1 - tension) * t12
            };

            const a = 2 * (p1.x - p2.x) + m1.x + m2.x;
            const b = -3 * (p1.x - p2.x) - 2 * m1.x - m2.x;
            const c = m1.x;
            const d = p1.x;

            const e = 2 * (p1.y - p2.y) + m1.y + m2.y;
            const f = -3 * (p1.y - p2.y) - 2 * m1.y - m2.y;
            const g = m1.y;
            const h = p1.y;

            path.push({
                x: a * s * s * s + b * s * s + c * s + d,
                y: e * s * s * s + f * s * s + g * s + h,
            });
        }
    }
    return path;
}