import { Panel } from '../Panel';
import { createElement } from '../../utils/domHelper';
import { MessagingHub } from '../../MessagingHub';
import { Definition } from '../../types';

export class DefinitionsPanel extends Panel {
    private messagingHub: MessagingHub;

    constructor(messagingHub: MessagingHub) {
        super(messagingHub);
        this.messagingHub = messagingHub;
    }

    initialize(): this {
        const { panel, maximizeBtn } = this.createPanel({
            id: 'definitionsPanel',
            panelClass: 'definitions-panel',
            headerTitle: '📚 Definitions',
            icon: '📚',
            content: [
                ['div', { class: 'definitions-content' }, [
                    ['div', { class: 'add-definition-section' }, [
                        ['input', {
                            type: 'text',
                            id: 'definitionInput',
                            placeholder: 'Enter a definition or rule...',
                            class: 'definition-input'
                        }],
                        ['button', { id: 'addDefinitionBtn', class: 'add-definition-btn' }, ['Add']]
                    ]],
                    ['div', { id: 'definitionsList', class: 'definitions-list' }, [
                        ['p', { class: 'no-definitions' }, ['No definitions yet. Add your first definition above.']]
                    ]]
                ]]
            ]
        });

        document.querySelector('.container')?.appendChild(panel);
        document.querySelector('.container')?.appendChild(maximizeBtn);

        this.setupToggleListeners('toggleDefinitionsPanel', 'maximizeDefinitionsBtn');

        return this;
    }

    /**
     * Update definitions panel with definitions data
     */
    updateDefinitions(definitions: Definition[]): void {
        const definitionsList = document.getElementById('definitionsList');
        if (!definitionsList) return;
        
        // Clear existing content
        definitionsList.innerHTML = '';
        
        if (definitions.length === 0) {
            const noDefMsg = createElement('p', { class: 'no-definitions' }) as HTMLElement;
            noDefMsg.textContent = `
            To add point to list: [A, B]+C\r\n
            To remove point from list: [A, B]-C`;
            definitionsList.appendChild(noDefMsg);
            return;
        }

        definitions.forEach(def => {
            const defItem = createElement('div', { 
                class: 'definition-item',
                'data-id': String(def.id)
            }) as HTMLElement;
            
            const defText = createElement('div', { class: 'definition-text' }) as HTMLElement;
            defText.textContent = def.text;
            
            const editInput = createElement('input', {
                type: 'text',
                class: 'definition-edit-input',
                'data-id': String(def.id)
            }) as HTMLInputElement;
            editInput.value = def.text;
            
            const actions = createElement('div', { class: 'definition-actions' }) as HTMLElement;
            
            const editBtn = createElement('button', {
                class: 'definition-btn definition-edit-btn',
                'data-id': String(def.id),
                title: 'Edit'
            }) as HTMLElement;
            editBtn.textContent = '✏️';
            
            const deleteBtn = createElement('button', {
                class: 'definition-btn definition-delete-btn',
                'data-id': String(def.id),
                title: 'Delete'
            }) as HTMLElement;
            deleteBtn.textContent = '🗑️';
            
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            
            defItem.appendChild(defText);
            defItem.appendChild(editInput);
            defItem.appendChild(actions);
            
            definitionsList.appendChild(defItem);
        });
    }
}

