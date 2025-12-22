import { NAME, VERSION } from "@/data/constants";
import { createElement } from "../utils/domHelper";
import { MessagingHub, Messages } from "../MessagingHub";
import { ToolbarIcons } from "./ToolbarIcons";

interface ButtonConfig {
    icon?: string;      // SVG string (optional)
    text?: string;      // Text label (optional, shown if no icon)
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
        icon: ToolbarIcons.pointer,
        title: 'Pointer Tool',
        action: 'setTool',
        params: ['pointer']
    },
    drawPoint: {
        icon: ToolbarIcons.drawPoint,
        title: 'Add Point (Click on canvas)',
        class: 'active',
        action: 'setTool',
        params: ['addPoint']
    },
    drawCircle: {
        icon: ToolbarIcons.drawCircle,
        title: 'Draw Circle (Select center point, then radius point)',
        action: 'setTool',
        params: ['drawCircle']
    },
    drawEdge: {
        icon: ToolbarIcons.drawEdge,
        title: 'Draw Edge (Select 2 points)',
        action: 'setTool',
        params: ['drawEdge']
    },
    assignAngle: {
        icon: ToolbarIcons.assignAngle,
        title: 'Edit the angle value, label, size, target etc',
        action: 'setTool',
        params: ['assignAngle']
    },
    angleBisector: {
        icon: ToolbarIcons.angleBisector,
        title: 'Create Angle Bisector (Click on angle)',
        action: 'setTool',
        params: ['angleBisector']
    },
    toggleNames: {
        icon: ToolbarIcons.toggleNames,
        title: 'Toggle Point Names (V)',
        action: 'togglePointNames',
        params: []
    },
    solveAngles: {
        icon: ToolbarIcons.solveAngles,
        title: 'Solve Unknown Angles (Use geometric theorems)',
        action: 'solveAngles',
        params: []
    },
    extractEquations: {
        icon: ToolbarIcons.extractEquations,
        title: 'Extract Equations',
        action: 'extractEquations',
        params: []
    },
    hideElement: {
        icon: ToolbarIcons.hideElement,
        title: 'Hide element (Click on element)',
        action: 'hideElement',
        params: []
    },
    save: {
        icon: ToolbarIcons.save,
        title: 'Save to Clipboard (JSON)',
        action: 'saveToClipboard',
        params: []
    },
    load: {
        icon: ToolbarIcons.load,
        title: 'Load from JSON',
        action: 'loadFromJSON',
        params: []
    },
    undo: {
        icon: ToolbarIcons.undo,
        title: 'Undo (Ctrl+Z)',
        action: 'undo',
        params: []
    },
    redo: {
        icon: ToolbarIcons.redo,
        title: 'Redo (Ctrl+Y)',
        action: 'redo',
        params: []
    },
    clear: {
        icon: ToolbarIcons.clear,
        title: 'Clear all',
        class: 'danger',
        action: 'clear',
        params: []
    },
    toSolvedMode: {
        text: 'Solve',
        title: 'Solve in new tab',
        class: 'to-solver-mode',
        action: 'solveInNewTab',
        params: []
    },
    toggleResultPanel: {
        text: 'Solve',
        title: 'Toggle Result Panel',
        class: 'solve-btn',
        action: 'toggleResultPanel',
        params: []
    }
});

export class Toolbar {
    private messagingHub: MessagingHub;
    private buttonMap: Map<string, ButtonInfo>;
    private defaultButtons: Record<string, ButtonConfig>;
    private problemNameInput: HTMLInputElement | null;
    private problemNameElement: HTMLElement | null;
    private problemNameButton: HTMLElement | null;
    container!: HTMLElement;
    private feedback!: HTMLElement;
    private buttons!: HTMLElement;
    private statusText!: HTMLElement;

    constructor(messagingHub: MessagingHub) {
        this.messagingHub = messagingHub;
        this.buttonMap = new Map();
        this.defaultButtons = getDefaultButtonConfigs();
        this.problemNameInput = null;
        this.problemNameElement = null;
        this.problemNameButton = null;
        // Subscribe to status updates
        this.messagingHub.subscribe(Messages.STATUS_UPDATE, (message: string) => {
            this.updateStatus(message);
        });
    }

    public initialize(): HTMLElement {
        this.problemNameInput = createElement('input', { type: 'text', class: 'problem-name-input hide', placeholder: 'Problem Name' }) as HTMLInputElement;
        this.problemNameElement = createElement('div', { class: 'problem-name' }, ['Untitled problem']) as HTMLElement;
        this.problemNameButton = createElement('button', { class: 'problem-name-button' }, ['Edit']) as HTMLElement;
        this.problemNameButton.addEventListener('click', this.updateProblemName);
        this.container = createElement('div', { class: 'toolbar' }, [
            ['header', { class: 'toolbar-header' }, [
                ['section', { class: 'page-title-section' }, [
                    ['h1', {}, [`${NAME} v${VERSION}`]],
                    this.problemNameInput,
                    this.problemNameElement,
                    this.problemNameButton,
                ]],
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

    public setProblemName = (name: string, locked: boolean = false): void => {
        if (!this.problemNameInput || !this.problemNameElement) return;
        if (!name) name = 'Untitled problem'
        this.problemNameInput.value = name;
        this.problemNameElement.textContent = name;
        this.problemNameElement.title = name;
        if (locked && this.problemNameButton) {
            this.problemNameButton.classList.add('hide');
        }
    }

    private updateProblemName = (): void => {
        if (!this.problemNameButton) return;
        const isEditMode = this.problemNameElement?.classList.contains('hide');
        // if edit mode then we need to hide input and emit the event to update the problem name
        if (isEditMode) {
            this.problemNameInput?.classList.add('hide');
            this.problemNameButton.textContent = 'Edit';
            if (this.problemNameElement) {
                this.problemNameElement.classList.remove('hide');
                this.problemNameElement.textContent = this.problemNameInput?.value || 'Untitled problem';
            }
            this.messagingHub.emit(Messages.UPDATE_PROBLEM_NAME, this.problemNameInput?.value);
        } else {
            this.problemNameInput?.classList.remove('hide');
            this.problemNameElement?.classList.add('hide');
            this.problemNameButton.textContent = 'Save';
        }
    }

    public registerFeedback = (): void => {
        this.feedback.classList.remove('hide');
    }

    public registerButton = (id: string, onclick: () => void): void => {
        const config = this.defaultButtons[id];
        if (!config) {
            console.warn(`No default configuration found for button ID: ${id}`);
            return;
        }
        const classes = config.class ? `tool-btn ${config.class}` : 'tool-btn';
        const button = createElement('button', { id: `${id}Btn`, class: classes, title: config.title }) as HTMLButtonElement;
        
        // Set content: prefer icon (SVG), fallback to text
        if (config.icon) {
            button.innerHTML = config.icon;
        } else if (config.text) {
            button.textContent = config.text;
        }
        
        button.addEventListener('click', onclick);

        this.buttons.appendChild(button);
        this.buttonMap.set(id, { onclick, element: button });
    }

    public unregisterButton = (id: string): void => {
        const button = this.buttonMap.get(id);
        if (button) {
            this.buttonMap.delete(id);
            button.element.removeEventListener('click', button.onclick);
            button.element.remove();
        }
    }
    
    public updateStatus = (message: string): void => {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }
    
    public getButton = (id: string): HTMLButtonElement | undefined => {
        return this.buttonMap.get(id)?.element;
    }

    public updateFeedback = (text: string | number): void => {
        this.feedback.textContent = String(text);
    }
}

