/**
 * Geometry Drawing Tool - Type Definitions
 * 
 * This file contains all type definitions for geometry entities.
 * Each entity has two versions:
 * - Normal version: Used during runtime with full properties
 * - Serialized version: Compact format for JSON storage/transfer (prefixed with "Serialized")
 */

// =============================================================================
// STATE TYPES
// =============================================================================

/** Saved point state (subset of Point) */
export interface SavedPoint {
    id: string;
    x: number;
    y: number;
    hide?: boolean;
}

/** Saved edge state (without element and id) */
export interface SavedEdge {
    points: [string, string];
    hide?: boolean;
}

/** Saved circle state (without element and id) */
export interface SavedCircle {
    name?: string;
    centerPoint: string;
    centerX: number;
    centerY: number;
    radius: number;
    pointsOnLine: string[];
    hide?: boolean;
}

/** Saved angle state (without groupElement) */
export interface SavedAngle {
    id: string;
    pointId: string;
    sidepoints: [string, string] | string[];
    value?: number | null;
    calculatedValue?: number;
    name: string;
    label: string;
    radius: number;
    hide?: boolean;
}

/** History state for undo/redo */
export interface HistoryState {
    points: SavedPoint[];
    edges: SavedEdge[];
    circles: SavedCircle[];
    angles: SavedAngle[];
    lines: Line[];
    definitions: Definition[];
    bisectedAngles: string[];
    linkedAngles: [string, string][];
    showPointNames?: boolean;
}

export interface SolverHistoryItem {
    angle: Angle;
    message: string;
    method: string;
}

// =============================================================================
// POINT TYPES
// =============================================================================

/** Point entity - represents a point on the canvas */
export interface Position {
    x: number;
    y: number;
}

export interface Rect extends Position {
    top: number;
    left: number;
    width: number;
    height: number;
}
export interface Point extends Position {
    /** Unique identifier (typically A, B, C, etc.) */
    id: string;
    /** Whether the point is hidden */
    hide?: boolean;
}

/** Serialized point for JSON storage */
export interface SerializedPoint {
    /** Point identifier */
    id: string;
    /** X coordinate */
    x: number;
    /** Y coordinate */
    y: number;
    /** Hide flag (1 = hidden) */
    h?: 1;
}

// =============================================================================
// EDGE TYPES
// =============================================================================

/** Edge entity - represents a line segment between two points */
export interface Edge {
    /** Unique identifier */
    id: string;
    /** Array of exactly 2 point IDs [startPointId, endPointId] */
    points: [string, string];
    /** Whether the edge is hidden */
    hide?: boolean;
    /** UI element reference */
    element: HTMLElement | null;
}

/** Serialized edge for JSON storage */
export interface SerializedEdge {
    /** Points array [startPointId, endPointId] */
    p: [string, string];
    /** Hide flag (1 = hidden) */
    h?: 1;
}

// =============================================================================
// CIRCLE TYPES
// =============================================================================

/** Circle entity - represents a circle on the canvas */
export interface Circle {
    /** Unique identifier */
    id: string;
    /** Display name */
    name?: string;
    /** ID of the center point */
    centerPoint: string;
    /** X coordinate of center */
    centerX: number;
    /** Y coordinate of center */
    centerY: number;
    /** Radius in pixels */
    radius: number;
    /** Array of point IDs that lie on the circle */
    pointsOnLine: string[];
    /** Whether the circle is hidden */
    hide?: boolean;
    /** UI element reference */
    element: HTMLElement | null;
}

/** Serialized circle for JSON storage */
export interface SerializedCircle {
    /** Center point ID */
    id: string;
    /** X coordinate of center */
    x: number;
    /** Y coordinate of center */
    y: number;
    /** Radius */
    r: number;
    /** Points on the circle line */
    p?: string[];
    /** Hide flag (1 = hidden) */
    h?: 1;
}

// =============================================================================
// ANGLE TYPES
// =============================================================================

/** Angle entity - represents an angle formed by three points */
export interface Angle {
    /** Unique identifier */
    id: string;
    /** Display name (e.g., "∠ABC") */
    name: string;
    /** ID of the vertex point */
    pointId: string;
    /** IDs of the two side points [point1Id, point2Id] */
    sidepoints: [string, string];
    /** User-assigned angle value in degrees */
    value?: number | null;
    /** Calculated angle value in degrees */
    calculatedValue?: number;
    /** User label for the angle */
    label?: string;
    /** Arc radius for display */
    radius: number;
    /** Start angle in radians for arc drawing */
    startAngle: number;
    /** End angle in radians for arc drawing */
    endAngle: number;
    /** UI element reference containing arc and text */
    groupElement: HTMLElement | null;
    /** Whether the angle is hidden */
    hide?: boolean;
    /** Whether this is the target angle to solve */
    target?: boolean;
}

/** Serialized angle for JSON storage */
export interface SerializedAngle {
    /** Vertex point ID */
    id: string;
    /** Side points [point1Id, point2Id] */
    p: [string, string];
    /** Angle value in degrees */
    v?: number | string | null;
    /** Label */
    l?: string;
    /** Hide flag (1 = hidden) */
    h?: 1;
    /** Target flag (1 = target angle) */
    t?: 1;
}

// =============================================================================
// LINE TYPES
// =============================================================================

/** Line entity - represents a set of collinear points */
export interface Line {
    /** Unique identifier */
    id: string;
    /** Array of point IDs in order along the line */
    points: string[];
}

/** Serialized line is just an array of point IDs */
export type SerializedLine = string[];

// =============================================================================
// DEFINITION TYPES
// =============================================================================

/** Definition entity - user-defined constraints or notes */
export interface Definition {
    /** Unique identifier */
    id: string;
    /** Definition text */
    text: string;
    /** Creation timestamp */
    timestamp: number;
}

/** Serialized definition for JSON storage */
export interface SerializedDefinition {
    /** Unique identifier */
    id: string;
    /** Definition text */
    text: string;
    /** Creation timestamp */
    timestamp: number;
}

// =============================================================================
// TRIANGLE TYPES
// =============================================================================

/** Triangle - a set of 3 point IDs forming a triangle */
export type Triangle = Set<string>;

/** Serialized triangle as array */
export type SerializedTriangle = string[];

// =============================================================================
// GEOMETRY DATA TYPES
// =============================================================================

/** Complete geometry data structure used during runtime */
export interface GeometryData {
    points: Point[];
    edges: Edge[];
    circles: Circle[];
    angles: Angle[];
    lines: Line[];
    triangles: Triangle[];
    definitions: Definition[];
}

/** Serialized geometry data for JSON storage */
export interface SerializedGeometryData {
    points: SerializedPoint[];
    edges: SerializedEdge[];
    circles: SerializedCircle[];
    angles: SerializedAngle[];
    lines: SerializedLine[];
    definitions?: SerializedDefinition[];
}

/** Normalized data structure from deserialization */
export interface NormalizedGeometryData {
    points: Point[];
    edges: Edge[];
    circles: Circle[];
    angles: Angle[];
    lines: SerializedLine[];
    triangles: SerializedTriangle[];
    definitions: Definition[];
}

/** Enriched geometry data with helper maps */
export interface EnrichedGeometryData {
    points: Point[];
    edges: Edge[];
    circles: Circle[];
    angles: Angle[];
    lines: Line[];
    triangles: Triangle[];
    definitions: Definition[];
    pointsMap: Map<string, Point>;
    adjacentPoints: Map<string, Set<string>>;
    overlappingAngles: Map<string, Set<string>>;
    anglesToCreate?: AngleToCreate[];
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/** Angle calculation result from getAngleCalculatedInfo */
export interface AngleCalculatedInfo {
    angle1: number;
    angle2: number;
    angleDegrees: number;
    radius: number;
}

/** Data for creating a new angle */
export interface AngleToCreate {
    vertex: Point;
    point1: Point;
    point2: Point;
    size?: number;
    angleDegrees: number;
}

export interface AngleToCreate2 {
    point: Point;
    neighbor1: Point;
    neighbor2: Point;
    size: number;
}

/** Edge with additional info for nearest edge detection */
export interface NearbyEdge {
    edge: Edge;
    closestPoint: { x: number; y: number };
    distance: number;
}

/** Edge info with connected point data */
export interface EdgeWithAngle {
    edge: Edge;
    otherPoint: Point;
    otherPointId: string;
    edgeAngle?: number;
    angleDiff?: number;
}

/** Highlightable elements result */
export interface HighlightableElements {
    lines: string[];
    edges: string[];
    circles: string[];
    intersectedEdges: string[];
}

export interface EdgeIntersection {
    edge: Edge;
    point1: Pick<Point, 'x' | 'y' | 'id'>;
    point2: Pick<Point, 'x' | 'y' | 'id'>;
}

/** Validation result */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/** Tool mode types */
export type ToolMode = 'creator' | 'solver';

/** Current tool selection */
export type ToolName = 
    | 'none'
    | 'pointer'
    | 'addPoint'
    | 'drawCircle'
    | 'drawEdge'
    | 'assignAngle'
    | 'angleBisector'
    | 'hideElement';


// =============================================================================
// UI TYPES
// =============================================================================

/** Panel configuration */
export interface PanelConfig {
    id: string;
    title: string;
    content?: string;
}

/** Button configuration */
export interface ButtonConfig {
    id: string;
    label: string;
    icon?: string;
    onClick?: () => void;
}

/** Message types for MessagingHub */
export interface Messages {
    TOOL_SELECTED: string;
    TOGGLE_NAMES: string;
    UNDO_REQUESTED: string;
    REDO_REQUESTED: string;
    CLEAR_REQUESTED: string;
    CANVAS_CLICKED: string;
    POINT_CLICKED: string;
    ANGLE_CLICKED: string;
    POINT_CREATE_REQUESTED: string;
    POINT_DRAGGING: string;
    POINT_MOVED: string;
    STATUS_UPDATED: string;
    STATUS_UPDATE: string;
    POINT_MENU_REQUESTED: string;
}

// =============================================================================
// FUNCTION PARAMETER TYPES
// =============================================================================

/** Parameters for point creation request */
export interface PointCreateRequestData {
    fromPoint: Point;
    distance: number;
    angle: number;
    newX: number;
    newY: number;
}

/** Parameters for point dragging event */
export interface PointDraggingData {
    point: Point;
}

/** Parameters for canvas click event */
export interface CanvasClickData {
    event: MouseEvent;
}

/** Parameters for point click event */
export interface PointClickData {
    point: Point;
}

/** Parameters for angle click event */
export interface AngleClickData {
    angleData: Angle;
    angles: Angle[];
}

export interface AngleEditRequestData {
    angle: Angle;
    angles?: Angle[];
}

/** Parameters for angle update event */
export interface UpdateAngleData {
    angleData: Angle;
    name: string;
    label: string;
    value: number;
    radius: number;
}

/** Solve options */
export interface SolveOptions {
    setAngle: (angle: Angle, value: number) => void;
    maxIterations?: number;
}

/** Solve result */
export interface SolveResult {
    solved: boolean;
    score?: number | string;
}

// =============================================================================
// SVG HELPER TYPES
// =============================================================================

/** SVG group structure for canvas layers */
export interface SvgGroups {
    circle: HTMLElement;
    edge: HTMLElement;
    angle: HTMLElement;
    point: HTMLElement;
}

/** SVG element attributes */
export type SvgAttributes = Record<string, string | number | string[]>;
export type ElementChild = string | Element | [string, SvgAttributes?, ElementChild[]?];

