// constants.js

// Defines the core algorithm for interpolation
export const INTERPOLATION_TYPE = {
    CUBIC_SPLINE: 'cubic_spline',
    CIRCULAR_ARC: 'circular_arc',
};

// Defines how corners/vertices are handled
export const CORNER_HANDLING = {
    PASS_THROUGH: 'pass_through', // Interpolate through the vertex
    CUT_ALL: 'cut_all',         // Approximate/fillet all vertices
    MIXED: 'mixed',             // Cut concave, pass through convex
};

// Defines the side for open paths (used in MIXED mode)
export const SIDE_MODE = {
    LEFT: 'left',
    RIGHT: 'right',
    BOTH: 'both', // For creating ribbons/outlines
};

// Defines how the radius for corner rounding is interpreted
export const RADIUS_MODE = {
    ABSOLUTE: 'absolute',   // A fixed value in drawing units
    RELATIVE: 'relative',   // A percentage of the shortest adjacent edge
};

// Default style object for a new interpolation preset
export const DEFAULT_STYLE = {
    id: `style_${Date.now()}`,
    name: 'New Spline Style',
    type: INTERPOLATION_TYPE.CUBIC_SPLINE,
    cornerHandling: CORNER_HANDLING.MIXED,
    side: SIDE_MODE.LEFT,
    radiusMode: RADIUS_MODE.RELATIVE,
    radiusValue: 0.5,
    tension: 0.5, // Specific to cubic splines
};

// UI and Preview canvas constants
export const PREVIEW_CANVAS_WIDTH = 256;
export const PREVIEW_CANVAS_HEIGHT = 256;
export const PREVIEW_BACKGROUND_COLOR = '#2D3748';
export const PREVIEW_GRID_COLOR = 'rgba(74, 85, 104, 0.8)';
export const PREVIEW_PATH_COLOR = '#A0AEC0';
export const PREVIEW_CURVE_COLOR = '#3B82F6';
export const PREVIEW_FILL_COLOR = 'rgba(59, 130, 246, 0.3)';
export const PREVIEW_POINT_RADIUS = 4;
export const PREVIEW_DASH_PATTERN = [5, 4];