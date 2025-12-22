import { ToolbarIcons } from "./ToolbarIcons";

export interface ButtonConfig {
    icon?: string;      // SVG string (optional)
    text?: string;      // Text label (optional, shown if no icon)
    title: string;
    class?: string;
    action: string;
    params: string[];
    options?: string[];
}

export const getDefaultButtonConfigs = (): Record<string, ButtonConfig> => ({
    pointer: {
        icon: ToolbarIcons.pointer,
        title: 'Pointer Tool',
        action: 'setTool',
        params: ['pointer']
    },
    drawPoint: {
        icon: ToolbarIcons.drawPoint,
        title: 'Add Point (Click on canvas)',
        class: 'active',
        action: 'setTool',
        params: ['addPoint']
    },
    drawCircle: {
        icon: ToolbarIcons.drawCircle,
        title: 'Draw Circle (Select center point, then radius point)',
        action: 'setTool',
        params: ['drawCircle']
    },
    drawEdge: {
        icon: ToolbarIcons.drawEdge,
        title: 'Draw Edge (Select 2 points)',
        action: 'setTool',
        params: ['drawEdge']
    },
    assignAngle: {
        icon: ToolbarIcons.assignAngle,
        title: 'Edit the angle value, label, size, target etc',
        action: 'setTool',
        params: ['assignAngle']
    },
    angleBisector: {
        icon: ToolbarIcons.angleBisector,
        title: 'Create Angle Bisector (Click on angle)',
        action: 'setTool',
        params: ['angleBisector']
    },
    toggleNames: {
        icon: ToolbarIcons.toggleNames,
        title: 'Toggle Point Names (V)',
        action: 'togglePointNames',
        params: []
    },
    solveAngles: {
        icon: ToolbarIcons.solveAngles,
        title: 'Solve Unknown Angles (Use geometric theorems)',
        action: 'solveAngles',
        params: []
    },
    extractEquations: {
        icon: ToolbarIcons.extractEquations,
        title: 'Extract Equations',
        action: 'extractEquations',
        params: []
    },
    hideElement: {
        icon: ToolbarIcons.hideElement,
        title: 'Hide element (Click on element)',
        action: 'hideElement',
        params: []
    },
    save: {
        icon: ToolbarIcons.save,
        title: 'Save to Clipboard (JSON)',
        action: 'saveToClipboard',
        params: []
    },
    load: {
        icon: ToolbarIcons.load,
        title: 'Load from JSON',
        action: 'loadFromJSON',
        params: []
    },
    undo: {
        icon: ToolbarIcons.undo,
        title: 'Undo (Ctrl+Z)',
        action: 'undo',
        params: []
    },
    redo: {
        icon: ToolbarIcons.redo,
        title: 'Redo (Ctrl+Y)',
        action: 'redo',
        params: []
    },
    clear: {
        icon: ToolbarIcons.clear,
        title: 'Clear all',
        class: 'danger',
        action: 'clear',
        params: []
    },
    toSolvedMode: {
        text: 'Solve',
        title: 'Solve in new tab',
        class: 'to-solver-mode',
        action: 'solveInNewTab',
        params: []
    },
    toggleResultPanel: {
        text: 'Solve',
        title: 'Toggle Result Panel',
        class: 'solve-btn',
        action: 'toggleResultPanel',
        params: []
    },
    exportImage: {
        icon: ToolbarIcons.exportImage,
        title: 'Export Image',
        action: 'exportImage',
        params: [],
        options: ['png', 'svg']
    }
});