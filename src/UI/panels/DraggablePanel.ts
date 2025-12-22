// Make panels draggable by their headers
export class DraggablePanel {
    private panel: HTMLElement;
    private header: HTMLElement;
    private isDragging: boolean = false;
    private currentX: number = 0;
    private currentY: number = 0;
    private initialX: number = 0;
    private initialY: number = 0;
    private xOffset: number = 0;
    private yOffset: number = 0;

    constructor(panelElement: HTMLElement, headerElement: HTMLElement) {
        this.panel = panelElement;
        this.header = headerElement;

        this.init();
    }

    private init(): void {
        // Make header indicate it's draggable
        this.header.style.cursor = 'move';
        
        // Add event listeners
        this.header.addEventListener('mousedown', (e) => this.dragStart(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.dragEnd());
    }

    private dragStart(e: MouseEvent): void {
        // Don't drag if clicking on buttons
        if ((e.target as HTMLElement).tagName === 'BUTTON') {
            return;
        }

        this.initialX = e.clientX - this.xOffset;
        this.initialY = e.clientY - this.yOffset;

        this.isDragging = true;
        this.panel.style.transition = 'none'; // Disable transition during drag
    }

    private drag(e: MouseEvent): void {
        if (this.isDragging) {
            e.preventDefault();

            this.currentX = e.clientX - this.initialX;
            this.currentY = e.clientY - this.initialY;

            this.xOffset = this.currentX;
            this.yOffset = this.currentY;

            this.setTranslate(this.currentX, this.currentY);
        }
    }

    private dragEnd(): void {
        if (this.isDragging) {
            this.initialX = this.currentX;
            this.initialY = this.currentY;
            this.isDragging = false;
            this.panel.style.transition = ''; // Re-enable transition
        }
    }

    private setTranslate(xPos: number, yPos: number): void {
        this.panel.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    reset(): void {
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
export function initDraggablePanels(): void {
    // Definitions Panel
    const definitionsPanel = document.getElementById('definitionsPanel');
    const definitionsHeader = definitionsPanel?.querySelector('.definitions-header') as HTMLElement | null;
    if (definitionsPanel && definitionsHeader) {
        new DraggablePanel(definitionsPanel, definitionsHeader);
    }

    // Debug Panel
    const debugPanel = document.getElementById('debugPanel');
    const debugHeader = debugPanel?.querySelector('.debug-header') as HTMLElement | null;
    if (debugPanel && debugHeader) {
        new DraggablePanel(debugPanel, debugHeader);
    }

    // JSON Panel
    const jsonPanel = document.getElementById('jsonPanel');
    const jsonHeader = jsonPanel?.querySelector('.json-header') as HTMLElement | null;
    if (jsonPanel && jsonHeader) {
        new DraggablePanel(jsonPanel, jsonHeader);
    }
}

