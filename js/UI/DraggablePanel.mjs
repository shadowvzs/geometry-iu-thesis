// Make panels draggable by their headers
export class DraggablePanel {
    constructor(panelElement, headerElement) {
        this.panel = panelElement;
        this.header = headerElement;
        this.isDragging = false;
        this.currentX = 0;
        this.currentY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.xOffset = 0;
        this.yOffset = 0;

        this.init();
    }

    init() {
        // Make header indicate it's draggable
        this.header.style.cursor = 'move';
        
        // Add event listeners
        this.header.addEventListener('mousedown', (e) => this.dragStart(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.dragEnd());
    }

    dragStart(e) {
        // Don't drag if clicking on buttons
        if (e.target.tagName === 'BUTTON') {
            return;
        }

        this.initialX = e.clientX - this.xOffset;
        this.initialY = e.clientY - this.yOffset;

        this.isDragging = true;
        this.panel.style.transition = 'none'; // Disable transition during drag
    }

    drag(e) {
        if (this.isDragging) {
            e.preventDefault();

            this.currentX = e.clientX - this.initialX;
            this.currentY = e.clientY - this.initialY;

            this.xOffset = this.currentX;
            this.yOffset = this.currentY;

            this.setTranslate(this.currentX, this.currentY);
        }
    }

    dragEnd() {
        if (this.isDragging) {
            this.initialX = this.currentX;
            this.initialY = this.currentY;
            this.isDragging = false;
            this.panel.style.transition = ''; // Re-enable transition
        }
    }

    setTranslate(xPos, yPos) {
        this.panel.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    reset() {
        this.currentX = 0;
        this.currentY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.xOffset = 0;
        this.yOffset = 0;
        this.panel.style.transform = 'translate(0px, 0px)';
    }
}

// Initialize all draggable panels
export function initDraggablePanels() {
    // Definitions Panel
    const definitionsPanel = document.getElementById('definitionsPanel');
    const definitionsHeader = definitionsPanel?.querySelector('.definitions-header');
    if (definitionsPanel && definitionsHeader) {
        new DraggablePanel(definitionsPanel, definitionsHeader);
    }

    // Debug Panel
    const debugPanel = document.getElementById('debugPanel');
    const debugHeader = debugPanel?.querySelector('.debug-header');
    if (debugPanel && debugHeader) {
        new DraggablePanel(debugPanel, debugHeader);
    }

    // JSON Panel
    const jsonPanel = document.getElementById('jsonPanel');
    const jsonHeader = jsonPanel?.querySelector('.json-header');
    if (jsonPanel && jsonHeader) {
        new DraggablePanel(jsonPanel, jsonHeader);
    }
}
