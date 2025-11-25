import { NotesPanel } from './panels/NotesPanel.mjs';
import { DefinitionsPanel } from './panels/DefinitionsPanel.mjs';
import { JsonPanel } from './panels/JsonPanel.mjs';
import { DebugPanel } from './panels/DebugPanel.mjs';

export class PanelManager {
    constructor(messagingHub) {
        this.messagingHub = messagingHub;
        this.panels = new Map();
    }

    initialize() {
        // Create and initialize all panels
        const notesPanel = new NotesPanel(this.messagingHub).initialize();
        const definitionsPanel = new DefinitionsPanel(this.messagingHub).initialize();
        const jsonPanel = new JsonPanel(this.messagingHub).initialize();
        const debugPanel = new DebugPanel(this.messagingHub).initialize();

        // Store panels in map
        this.panels.set('notes', notesPanel);
        this.panels.set('definitions', definitionsPanel);
        this.panels.set('json', jsonPanel);
        this.panels.set('debug', debugPanel);

        return this;
    }

    getPanel(name) {
        return this.panels.get(name);
    }
}