import { Panel } from './Panel';
import { MessagingHub } from '../../MessagingHub';

export class JsonPanel extends Panel {
    constructor(messagingHub: MessagingHub) {
        super(messagingHub);
    }

    initialize(): this {
        const { panel, maximizeBtn } = this.createPanel({
            id: 'jsonPanel',
            panelClass: 'json-panel',
            headerTitle: '📊 Data (JSON)',
            icon: '📊',
            content: [
                ['div', { id: 'jsonContent', class: 'json-content' }, [
                    ['pre', { id: 'jsonData' }, ['{}']]
                ]]
            ]
        });

        document.querySelector('.container')?.appendChild(panel);
        document.querySelector('.container')?.appendChild(maximizeBtn);

        this.setupToggleListeners('toggleJsonPanel', 'maximizeJsonBtn');

        return this;
    }
}

