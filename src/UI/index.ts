import { Toolbar } from "./Toolbar";
import { PanelManager } from "./panels";
import { createElement } from "../utils/domHelper";
import { Canvas } from "./Canvas";
import { MessagingHub } from "../MessagingHub";

export class UI {
    private messagingHub: MessagingHub;
    toolbar: Toolbar;
    panels: PanelManager;
    canvas: Canvas;
    container!: HTMLElement;

    constructor(messagingHub: MessagingHub) {
        // Store messaging hub for communication
        this.messagingHub = messagingHub;
        
        // UI initialization code here
        this.toolbar = new Toolbar(messagingHub);
        this.panels = new PanelManager(messagingHub);
        this.canvas = new Canvas(messagingHub);
    }

    initialize(): void {
        this.container = createElement('div', { class: 'app-container' }, [
            this.toolbar.initialize(),
            this.canvas.initialize()
        ]) as HTMLElement;
        document.querySelector('.container')?.appendChild(this.container);
        
        // Initialize panels (they append themselves to .container)
        this.panels.initialize();
    }
}

