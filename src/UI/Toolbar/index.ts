import { NAME, VERSION } from "@/data/constants";
import { createElement } from "../../utils/domHelper";
import { MessagingHub, Messages } from "../../MessagingHub";
import { ButtonConfig, getDefaultButtonConfigs } from "./defaultButtons";
import { ExportImageType } from "@/types";
import testdata from "../../data/index";
import type { SerializedGeometryData } from "@/types";


interface ButtonInfo {
    onclick: (ev: Event, option?: string) => void;
    element: HTMLButtonElement;
}

export class Toolbar {
    private messagingHub: MessagingHub;
    private buttonMap: Map<string, ButtonInfo>;
    private defaultButtons: Record<string, ButtonConfig>;
    private problemNameInput: HTMLInputElement | null;
    private problemNameElement: HTMLElement | null;
    private problemNameButton: HTMLElement | null;
    private loadTestdataButton: HTMLElement | null;
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
        this.loadTestdataButton = null;
        // Subscribe to status updates
        this.messagingHub.subscribe(Messages.STATUS_UPDATE, (message: string) => {
            this.updateStatus(message);
        });
        
        // Subscribe to feedback updates
        this.messagingHub.subscribe(Messages.FEEDBACK_UPDATE, (text: string | number) => {
            this.updateFeedback(text);
        });
    }

    public initialize(): HTMLElement {
        this.problemNameInput = createElement('input', { type: 'text', class: 'problem-name-input hide', placeholder: 'Problem Name' }) as HTMLInputElement;
        this.problemNameElement = createElement('div', { class: 'problem-name' }, ['Untitled problem']) as HTMLElement;
        this.problemNameButton = createElement('button', { class: 'problem-name-button' }, ['Edit']) as HTMLElement;
        this.problemNameButton.addEventListener('click', this.updateProblemName);
        this.loadTestdataButton = createElement('button', { class: 'problem-name-button' }, ['Load Predefined Data']) as HTMLElement;
        this.loadTestdataButton.addEventListener('click', this.showLoadTestdataDialog);
        this.container = createElement('div', { class: 'toolbar' }, [
            ['header', { class: 'toolbar-header' }, [
                ['section', { class: 'page-title-section' }, [
                    ['h1', {}, [`${NAME} v${VERSION}`]],
                    this.problemNameInput,
                    this.problemNameElement,
                    this.problemNameButton,
                    this.loadTestdataButton,
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
        if (locked) {
            if (this.problemNameButton) {
                this.problemNameButton.classList.add('hide');
            }
            if (this.loadTestdataButton) {
                this.loadTestdataButton.classList.add('hide');
            }
        } else {
            if (this.problemNameButton) {
                this.problemNameButton.classList.remove('hide');
            }
            if (this.loadTestdataButton) {
                this.loadTestdataButton.classList.remove('hide');
            }
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

    public registerButton = (id: string, onclick: (ev: Event, option?: string) => void): void => {
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
        
        this.buttons.appendChild(button);
        if (config.options) {
            const options = config.options.map(opt => {
                const optionElement = createElement('li', { class: 'tool-btn-option', value: opt }, [opt]);
                optionElement.addEventListener('click', (ev) => {
                    onclick(ev, opt as ExportImageType);
                });
                return optionElement;
            });
            const wrapper = createElement('div', { class: 'tool-btn-wrapper' }, [
                button,
                ['ul', { class: 'tool-btn-options' }, options],
            ]);
            this.buttons.appendChild(wrapper);
        } else {
            button.addEventListener('click', onclick);
        }
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

    private showLoadTestdataDialog = (): void => {
        // Remove any existing dialogs
        document.querySelectorAll('.testdata-dialog').forEach(el => el.remove());
        
        const dialog = createElement('div', { class: 'testdata-dialog' }) as HTMLElement;
        
        // Create list of testdata items
        const testdataList = createElement('div', { class: 'testdata-list' }) as HTMLElement;

        // we want the most recent to be at the top
        const sortedTestdata = [...testdata].reverse();
        
        sortedTestdata.forEach((data, index) => {
            const testName = (data as { name?: string }).name || `Test Data ${index + 1}`;
            const item = createElement('div', { 
                class: 'testdata-item',
                title: testName,
                'data-index': String(index)
            }, [testName]) as HTMLElement;
            
            item.addEventListener('click', () => {
                this.messagingHub.emit(Messages.DATA_LOAD_REQUESTED, data as SerializedGeometryData);
                dialog.remove();
                this.messagingHub.emit(Messages.STATUS_UPDATE, `✅ Loaded: ${testName}`);
            });
            
            testdataList.appendChild(item);
        });
        
        dialog.appendChild(createElement('div', { class: 'testdata-dialog-content' }, [
            createElement('h3', {}, ['Load Test Data']),
            testdataList,
            createElement('div', { class: 'testdata-dialog-buttons' }, [
                createElement('button', { id: 'testdataCancel' }, ['Cancel'])
            ])
        ]));
        
        document.body.appendChild(dialog);
        
        // Close on cancel button
        document.getElementById('testdataCancel')!.addEventListener('click', () => {
            dialog.remove();
        });
        
        // Close on Escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                dialog.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Close on click outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        });
    }
}

