export class PanelManager {
    constructor(messagingHub) {
        this.messagingHub = messagingHub;
        this.panels = new Map();
        this.panelMap = {};
    }

    initialize() {
        return this;
    }

    registerPanel = (name, PanelClass) => {
        if (!PanelClass) {
            console.error(`Panel "${name}" not found.`);
            return;
        }
        const panelInstance = new PanelClass(this.messagingHub).initialize();
        this.panels.set(name, panelInstance);
    }

    getPanel = (name) => {
        return this.panels.get(name);
    }
}