import { Panel } from '../Panel';
import { MessagingHub } from '../../MessagingHub';

export class DebugPanel extends Panel {
    constructor(messagingHub: MessagingHub) {
        super(messagingHub);
    }

    initialize(): this {
        const { panel, maximizeBtn } = this.createPanel({
            id: 'debugPanel',
            panelClass: 'debug-panel',
            headerTitle: '🐛 Debug Log',
            icon: '🐛',
            clearButton: {
                id: 'clearDebugBtn',
                class: 'clear-debug-btn',
                title: 'Clear logs',
                icon: '🗑️'
            },
            content: [
                ['div', { id: 'debugContent', class: 'debug-content' }, [
                    ['div', { id: 'debugLogs', class: 'debug-logs' }, [
                        ['div', { class: 'no-logs' }, ['No function calls yet...']]
                    ]]
                ]]
            ]
        });

        document.querySelector('.container')?.appendChild(panel);
        document.querySelector('.container')?.appendChild(maximizeBtn);

        this.setupToggleListeners('toggleDebugPanel', 'maximizeDebugBtn');

        return this;
    }
}

