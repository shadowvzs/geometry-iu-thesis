import { MessagingHub } from "../../MessagingHub";
import { Panel } from "./Panel";

type PanelClass = new (messagingHub: MessagingHub) => Panel & { initialize(): Panel };

export class PanelManager {
    private messagingHub: MessagingHub;
    private panels: Map<string, Panel>;

    constructor(messagingHub: MessagingHub) {
        this.messagingHub = messagingHub;
        this.panels = new Map();
    }

    initialize(): this {
        return this;
    }

    registerPanel = (name: string, PanelClass: PanelClass): void => {
        if (!PanelClass) {
            console.error(`Panel "${name}" not found.`);
            return;
        }
        const panelInstance = new PanelClass(this.messagingHub).initialize();
        this.panels.set(name, panelInstance);
    }

    getPanel = <T extends Panel>(name: string): T | undefined => {
        return this.panels.get(name) as T | undefined;
    }

    togglePanel = (name: string): void => {
        const panel = this.panels.get(name);
        if (panel) {
            panel.togglePanel();
        }
    }
}

