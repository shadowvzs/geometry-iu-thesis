import { createElement } from "../utils/domHelper.mjs";
import { Messages } from "../MessagingHub.mjs";

const getDefaultButtonConfigs = () => ({
    pointer: {
        icon: '👆',
        title: 'Pointer Tool (Click to select/edit elements)',
        action: 'setTool',
        params: ['pointer']
    },
    drawPoint: {
        icon: '➕',
        title: 'Add Point (Click on canvas)',
        class: 'active',
        action: 'setTool',
        params: ['addPoint']
    },
    drawCircle: {
        icon: '⭕',
        title: 'Draw Circle (Select center point, then radius point)',
        action: 'setTool',
        params: ['drawCircle']
    },
    drawEdge: {
        icon: '📏',
        title: 'Draw Edge (Select 2 points)',
        action: 'setTool',
        params: ['drawEdge']
    },
    assignAngle: {
        icon: '∠',
        title: 'Assign Angle Value (Click on angle)',
        action: 'setTool',
        params: ['assignAngle']
    },
    angleBisector: {
        icon: '✂️',
        title: 'Create Angle Bisector (Click on angle)',
        action: 'setTool',
        params: ['angleBisector']
    },
    toggleNames: {
        icon: '👁️',
        title: 'Toggle Point Names (V)',
        action: 'togglePointNames',
        params: []
    },
    solveAngles: {
        icon: '🔍',
        title: 'Solve Unknown Angles (Use geometric theorems)',
        action: 'solveAngles',
        params: []
    },
    hideElement: {
        icon: '⛏',
        title: 'Hide element (Click on element)',
        action: 'hideElement',
        params: []
    },
    save: {
        icon: '💾',
        title: 'Save to Clipboard (JSON)',
        action: 'saveToClipboard',
        params: []
    },
    load: {
        icon: '📂',
        title: 'Load from JSON',
        action: 'loadFromJSON',
        params: []
    },
    undo: {
        icon: '↶',
        title: 'Undo (Ctrl+Z)',
        action: 'undo',
        params: []
    },
    redo: {
        icon: '↷',
        title: 'Redo (Ctrl+Y)',
        action: 'redo',
        params: []
    },
    clear: {
        icon: '🗑️',
        title: 'Clear all',
        class: 'danger',
        action: 'clear',
        params: []
    },
    toSolvedMode: {
        icon: '⚓',
        title: 'Solve in new tab',
        class: 'to-solver-mode',
        action: 'solveInNewTab',
        params: []
    }
});

export class Toolbar {
    constructor(messagingHub) {
        this.messagingHub = messagingHub;
        this.buttonMap = new Map();
        this.defaultButtons = getDefaultButtonConfigs();
        
        // Subscribe to status updates
        this.messagingHub.subscribe(Messages.STATUS_UPDATE, (message) => {
            this.updateStatus(message);
        });
    }

    initialize() {
        this.container = createElement('div', { class: 'toolbar' }, [
            ['header', { class: 'toolbar-header' }, [
                ['h1', {}, ['Geometry Tool']],
                ['div', { class: 'toolbar-feedback hide' }, []]
            ]],
            ['div', { class: 'tool-buttons' }],
            ['div', { class: 'info' }, [
                ['p', { id: 'statusText' }, ['Click on canvas to Add Points']]
            ]]
        ]);
        this.feedback = this.container.querySelector('.toolbar-feedback');
        this.buttons = this.container.querySelector('.tool-buttons');
        this.statusText = this.container.querySelector('#statusText');

        // Initialize default buttons
        return this.container;
    }

    registerFeedback = () => {
        this.feedback.classList.remove('hide');
    }

    // Register toolbar buttons
    registerButton = (id, onclick) => {
        const config = this.defaultButtons[id];
        if (!config) {
            console.warn(`No default configuration found for button ID: ${id}`);
            return;
        }
        const classes = config.class ? `tool-btn ${config.class}` : 'tool-btn';
        const button = createElement('button', { id: `${id}Btn`, class: classes, title: config.title }, [config.icon]);
        button.addEventListener('click', onclick);

        this.buttons.appendChild(button);
        this.buttonMap.set(id, { onclick, element: button });
    }

    unregisterButton = (id) => {
        const button = this.buttonMap.get(id);
        if (button) {
            this.buttonMap.delete(id);
            button.element.removeEventListener('click', button.onclick);
            button.element.remove();
        }
    }
    
    updateStatus = (message) => {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }
    
    getButton = (id) => {
        return this.buttonMap.get(id)?.element;
    }

    updateFeedback = (text) => {
        this.feedback.textContent = text;
    }
}