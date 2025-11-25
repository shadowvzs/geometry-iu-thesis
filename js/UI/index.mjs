import { Toolbar } from "./Toolbar.mjs";
import { PanelManager } from "./PanelManager.mjs";
import { createElement } from "../utils/domHelper.mjs";
import { Canvas } from "./Canvas.mjs";

export class UI {
    constructor(messagingHub) {
        // Store messaging hub for communication
        this.messagingHub = messagingHub;
        
        // UI initialization code here
        this.toolbar = new Toolbar(messagingHub);
        this.panels = new PanelManager(messagingHub);
        this.canvas = new Canvas(messagingHub);
    }

    initialize() {
        this.container = createElement('div', { class: 'app-container' }, [
            this.toolbar.initialize(),
            this.canvas.initialize()
        ]);
        document.querySelector('.container').appendChild(this.container);
        
        // Initialize panels (they append themselves to .container)
        this.panels.initialize();
    }
}
