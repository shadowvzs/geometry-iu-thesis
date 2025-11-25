import { Panel } from '../Panel.mjs';
import { createElement } from '../../utils/domHelper.mjs';

export class DefinitionsPanel extends Panel {
    constructor(messagingHub) {
        super(messagingHub);
        this.messagingHub = messagingHub;
    }

    initialize() {
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

        document.querySelector('.container').appendChild(panel);
        document.querySelector('.container').appendChild(maximizeBtn);

        this.setupToggleListeners('toggleDefinitionsPanel', 'maximizeDefinitionsBtn');

        return this;
    }

    /**
     * Update definitions panel with definitions data
     * @param {Array} definitions - Array of definitions
     */
    updateDefinitions(definitions) {
        const definitionsList = document.getElementById('definitionsList');
        
        // Clear existing content
        definitionsList.innerHTML = '';
        
        if (definitions.length === 0) {
            const noDefMsg = createElement('p', { class: 'no-definitions' });
            noDefMsg.textContent = 'No definitions yet. Add your first definition above.';
            definitionsList.appendChild(noDefMsg);
            return;
        }

        definitions.forEach(def => {
            const defItem = createElement('div', { 
                class: 'definition-item',
                'data-id': def.id 
            });
            
            const defText = createElement('div', { class: 'definition-text' });
            defText.textContent = def.text;
            
            const editInput = createElement('input', {
                type: 'text',
                class: 'definition-edit-input',
                'data-id': def.id
            });
            editInput.value = def.text;
            
            const actions = createElement('div', { class: 'definition-actions' });
            
            const editBtn = createElement('button', {
                class: 'definition-btn definition-edit-btn',
                'data-id': def.id,
                title: 'Edit'
            });
            editBtn.textContent = '✏️';
            
            const deleteBtn = createElement('button', {
                class: 'definition-btn definition-delete-btn',
                'data-id': def.id,
                title: 'Delete'
            });
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
