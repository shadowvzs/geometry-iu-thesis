import { createElement } from "../utils/domHelper";
import { MessagingHub, Messages } from "../MessagingHub";

interface ButtonConfig {
    icon: string;
    title: string;
    class?: string;
    action: string;
    params: string[];
}

interface ButtonInfo {
    onclick: () => void;
    element: HTMLButtonElement;
}

const getDefaultButtonConfigs = (): Record<string, ButtonConfig> => ({
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
    private messagingHub: MessagingHub;
    private buttonMap: Map<string, ButtonInfo>;
    private defaultButtons: Record<string, ButtonConfig>;
    container!: HTMLElement;
    private feedback!: HTMLElement;
    private buttons!: HTMLElement;
    private statusText!: HTMLElement;

    constructor(messagingHub: MessagingHub) {
        this.messagingHub = messagingHub;
        this.buttonMap = new Map();
        this.defaultButtons = getDefaultButtonConfigs();
        
        // Subscribe to status updates
        this.messagingHub.subscribe(Messages.STATUS_UPDATE, (message: string) => {
            this.updateStatus(message);
        });
    }

    initialize(): HTMLElement {
        this.container = createElement('div', { class: 'toolbar' }, [
            ['header', { class: 'toolbar-header' }, [
                ['h1', {}, ['Geometry Tool']],
                ['div', { class: 'toolbar-feedback hide' }, []]
            ]],
            ['div', { class: 'tool-buttons' }],
            ['div', { class: 'info' }, [
                ['p', { id: 'statusText' }, ['Click on canvas to Add Points']]
            ]]
        ]) as HTMLElement;
        this.feedback = this.container.querySelector('.toolbar-feedback') as HTMLElement;
        this.buttons = this.container.querySelector('.tool-buttons') as HTMLElement;
        this.statusText = this.container.querySelector('#statusText') as HTMLElement;

        return this.container;
    }

    registerFeedback = (): void => {
        this.feedback.classList.remove('hide');
    }

    registerButton = (id: string, onclick: () => void): void => {
        const config = this.defaultButtons[id];
        if (!config) {
            console.warn(`No default configuration found for button ID: ${id}`);
            return;
        }
        const classes = config.class ? `tool-btn ${config.class}` : 'tool-btn';
        const button = createElement('button', { id: `${id}Btn`, class: classes, title: config.title }, [config.icon]) as HTMLButtonElement;
        button.addEventListener('click', onclick);

        this.buttons.appendChild(button);
        this.buttonMap.set(id, { onclick, element: button });
    }

    unregisterButton = (id: string): void => {
        const button = this.buttonMap.get(id);
        if (button) {
            this.buttonMap.delete(id);
            button.element.removeEventListener('click', button.onclick);
            button.element.remove();
        }
    }
    
    updateStatus = (message: string): void => {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }
    
    getButton = (id: string): HTMLButtonElement | undefined => {
        return this.buttonMap.get(id)?.element;
    }

    updateFeedback = (text: string | number): void => {
        this.feedback.textContent = String(text);
    }
}

