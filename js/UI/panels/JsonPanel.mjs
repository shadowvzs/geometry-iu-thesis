import { Panel } from '../Panel.mjs';

export class JsonPanel extends Panel {
    constructor(app) {
        super(app);
    }

    initialize() {
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

        document.querySelector('.container').appendChild(panel);
        document.querySelector('.container').appendChild(maximizeBtn);

        this.setupToggleListeners('toggleJsonPanel', 'maximizeJsonBtn');

        return this;
    }
}
