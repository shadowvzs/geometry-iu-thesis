/**
 * SVG Icons for Toolbar buttons
 * 
 * LICENSE: These icons are original creations, hand-coded using basic SVG primitives.
 * They are released into the PUBLIC DOMAIN (CC0 1.0 Universal).
 * You can copy, modify, distribute and use them, even for commercial purposes,
 * all without asking permission or providing attribution.
 * 
 * No icons from external libraries (Font Awesome, Material Icons, Feather, etc.) are used.
 */

export const ToolbarIcons = {
    pointer: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4 L4 18 L9 13 L14 20 L16 19 L11 12 L18 12 Z" fill="currentColor"/>
    </svg>`,

    drawPoint: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="6" fill="currentColor"/>
    </svg>`,

    drawCircle: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="12" x2="20" y2="12" stroke="cyan" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="2" fill="#aaaaff"/>
        <circle cx="20" cy="12" r="2" fill="#aaaaff"/>
    </svg>`,

    drawEdge: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="2"/>
        <circle cx="4" cy="20" r="3" fill="currentColor"/>
        <circle cx="20" cy="4" r="3" fill="currentColor"/>
    </svg>`,

    assignAngle: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
        <line x1="4" y1="20" x2="18" y2="6" stroke="currentColor" stroke-width="2"/>
        <path d="M12 20 A8 8 0 0 0 10 14" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,

    angleBisector: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
        <line x1="4" y1="20" x2="18" y2="6" stroke="currentColor" stroke-width="2"/>
        <line x1="4" y1="20" x2="19" y2="13" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    </svg>`,

    toggleNames: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4 L5 20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M12 4 L19 20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="3,3" opacity="0.4"/>
        <line x1="7" y1="15" x2="12" y2="15" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-dasharray="2,2" opacity="0.4"/>
    </svg>`,

    solveAngles: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2"/>
    <path d="M2 22 L4 24 L8 20" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`,

    extractEquations: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <text x="2" y="15" font-family="Times, serif" font-size="13" font-style="italic" fill="currentColor">x</text>
        <line x1="10" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="2"/>
        <line x1="10" y1="14" x2="15" y2="14" stroke="currentColor" stroke-width="2"/>
        <text x="16" y="15" font-family="Times, serif" font-size="13" font-style="italic" fill="currentColor">y</text>
    </svg>`,

    hideElement: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <!-- Dashed line -->
    <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="2" stroke-dasharray="4,2"/>
    
    <!-- Pointer (mouse cursor) -->
    <path d="M4 8 L4 20 L9 15 L14 22 L16 21 L11 14 L18 14 Z" fill="currentColor"/>
</svg>`,

    save: `
<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="5" x2="13" y2="5" stroke="white" stroke-width="1"/>
    <line x1="3" y1="10" x2="13" y2="10" stroke="white" stroke-width="1"/>
    <line x1="3" y1="15" x2="13" y2="15" stroke="white" stroke-width="1"/>
    <rect x="0" y="0" width="16" height="20" fill="transparent" stroke="white" stroke-width="1"/>
    <line x1="17" y1="4" x2="20" y2="4" stroke="white" stroke-width="1"/>
    <line x1="20" y1="4" x2="20" y2="24" stroke="white" stroke-width="1"/>
    <line x1="4" y1="24" x2="20" y2="24" stroke="white" stroke-width="1"/>
    <line x1="4" y1="24" x2="4" y2="20" stroke="white" stroke-width="1"/>
</svg>
`,

    load: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <!-- Clipboard top -->
    <rect x="7" y="0" width="11" height="4" rx="1" ry="1" fill="currentColor"/>
    <!-- Main document -->
    <rect x="3" y="3" width="19" height="21" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
    <!-- Text lines -->
    <line x1="7" y1="8" x2="18" y2="8" stroke="currentColor" stroke-width="1.5"/>
    <line x1="7" y1="13" x2="18" y2="13" stroke="currentColor" stroke-width="1.5"/>
    <line x1="7" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="1.5"/>
</svg>`,

    undo: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 7 L3 11 L7 15" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M3 11 H15 A5 5 0 1 1 15 21 H12" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,

    redo: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 7 L21 11 L17 15" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M21 11 H9 A5 5 0 1 0 9 21 H12" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,

    clear: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 6 L18 6 L17 21 L7 21 Z" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="2"/>
        <path d="M9 6 L9 3 L15 3 L15 6" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="10" y1="10" x2="10" y2="17" stroke="currentColor" stroke-width="1.5"/>
        <line x1="14" y1="10" x2="14" y2="17" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
};

