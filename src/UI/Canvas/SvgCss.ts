export default `
/* SVG Elements - Points */
.point-group {
    cursor: pointer;
    pointer-events: auto;
}

.point-group.creator-only {
    opacity: 0.5;
}

.svg-canvas.solver-mode .point-group.creator-only {
    display: none;
}

.point-circle {
    fill: #3498db;
    stroke: #2980b9;
    stroke-width: 2;
}

.point-circle:hover {
    fill: #5dade2;
    stroke-width: 3;
}

.point-circle.selected {
    fill: #ff0000;
    stroke: #cc0000;
    stroke-width: 3;
}

.point-circle.dragging {
    fill: #e67e22;
    stroke: #d35400;
    stroke-width: 3;
    cursor: grabbing !important;
}

.point-label {
    fill: #2c3e50;
    font-size: 14px;
    font-weight: bold;
    text-anchor: middle;
    pointer-events: none;
    user-select: none;
}

/* SVG Elements - Circles */
.circle-shape {
    fill: none;
    stroke: #95a5a6;
    stroke-width: 2;
}

.circle-shape.creator-only {
    stroke-dasharray: 5,5;
}

.svg-canvas.solver-mode .circle-shape.creator-only {
    display: none;
}

[tool="addPoint"] .mouse-on-this-element.circle-shape,
[tool="hideElement"] .mouse-on-this-element.circle-shape
{
    stroke-width: 3;
    stroke: #2c3e50;
    cursor: cell;
}

/* SVG Elements - Lines */
.edge {
    stroke: #34495e;
    stroke-width: 2;
    pointer-events: stroke;
    transition: stroke-width 0.2s;
}

.edge-container.creator-only .edge {
    stroke-dasharray: 5,5;
}

.svg-canvas.solver-mode .edge-container.creator-only .edge {
    display: none;
}

[tool="addPoint"] .edge:hover,
[tool="hideElement"] .edge:hover,
[tool="addPoint"] .mouse-on-this-element .edge
{
    cursor: cell;
    stroke-width: 4;
    stroke: #2c3e50;
}

.edge.helper {
    display: none;
}
.mouse-on-this-element .edge.helper {
    display: block;
    stroke: #ccc;
    stroke-width: 2;
}

.edge.diameter {
    stroke: #bdc3c7;
    stroke-width: 1.5;
    stroke-dasharray: 3,3;
}

.edge.radius-line {
    stroke: #3498db;
    stroke-width: 1.5;
    stroke-dasharray: 5,5;
    pointer-events: none;
}

.edge.bisector {
    stroke: #e67e22;
    stroke-width: 2;
    stroke-dasharray: 5,5;
}

/* Guide line for constrained movement */
.move-guide-line {
    pointer-events: none;
}

/* SVG Elements - Angles */
.angle-arc {
    fill: rgba(52, 152, 219, 0.2);
    stroke: #3498db;
    stroke-width: 2;
    cursor: pointer;
    transition: all 0.2s;
}

.svg-canvas:not(.solver-mode) .angle-arc:hover,
.svg-canvas:not(.solver-mode) .angle-group:hover .angle-arc,
.svg-canvas:not(.solver-mode) .angle-group.selected .angle-arc
{
    fill: rgba(52, 152, 219, 0.8);
    stroke-width: 3;
}

.svg-canvas:not(.solver-mode) .target-angle .angle-arc:hover,
.svg-canvas:not(.solver-mode) .angle-group.target-angle:hover .angle-arc
{
    fill: rgba(230, 140, 30, 0.8);
}

.angle-group.creator-only {
    opacity: 0.5;
    filter: grayscale(1);
}

.svg-canvas.solver-mode .angle-group.creator-only {
    display: none;
}

.angle-text {
    fill: #2c3e50;
    font-size: 14px;
    font-weight: normal;
    text-anchor: middle;
    cursor: pointer;
    user-select: none;
    opacity: 0.5;
    transition: opacity 0.2s;
}

.svg-canvas:not(.solver-mode) .angle-text:hover,
.svg-canvas:not(.solver-mode) .angle-group:hover .angle-text,
.svg-canvas:not(.solver-mode) .angle-group.selected .angle-text,
.target-angle .angle-text {
    fill: black;
    opacity: 1;
    font-weight: bold;
    font-size: 18px;
}

.target-angle .angle-arc {
    fill: rgba(255, 165, 52, 0.8);
    stroke: #db9834;
}

`;