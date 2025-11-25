import { createElement } from "../utils/domHelper.mjs";

export class Panel {
    constructor(app) {
        this.app = app;
        this.panel = null;
        this.maximizeBtn = null;
        this.toggleBtn = null;
        this.isMaximized = false;
    }

    createPanel(config) {
        const { id, panelClass, headerTitle, icon, content } = config;
        
        this.panel = createElement('div', { id, class: panelClass }, [
            ['div', { class: `${panelClass.split('-')[0]}-header` }, [
                ['h3', {}, [headerTitle]],
                ...this.createHeaderButtons(config)
            ]],
            ...content
        ]);

        this.maximizeBtn = createElement('button', {
            id: `maximize${this.capitalizeFirst(id.replace('Panel', ''))}Btn`,
            class: `maximize-btn maximize-${id.replace('Panel', '')}-btn`,
            style: 'display: none;',
            title: `Show ${headerTitle.replace(/^.+ /, '')}`
        }, [icon]);

        return { panel: this.panel, maximizeBtn: this.maximizeBtn };
    }

    createHeaderButtons(config) {
        const buttons = [];
        
        if (config.clearButton) {
            buttons.push(['button', { 
                id: config.clearButton.id, 
                class: config.clearButton.class,
                title: config.clearButton.title 
            }, [config.clearButton.icon]]);
        }

        // Add maximize/minimize button
        buttons.push(['button', { 
            id: `maximize${this.capitalizeFirst(config.id.replace('Panel', ''))}Btn`, 
            class: `maximize-${config.id.replace('Panel', '')}-btn panel-maximize-btn`,
            title: 'Maximize panel' 
        }, ['□']]);

        // Add collapse/expand button
        buttons.push(['button', { 
            id: `toggle${this.capitalizeFirst(config.id.replace('Panel', ''))}Panel`, 
            class: `toggle-${config.id.replace('Panel', '')}-btn` 
        }, ['−']]);

        // Wrap buttons in a div with flex layout
        return [['div', { class: 'panel-header-buttons', style: 'display: flex; flex-direction: row; gap: 6px; align-items: center;' }, buttons]];
    }

    setupToggleListeners(toggleBtnId, maximizeBtnId) {
        this.toggleBtn = document.getElementById(toggleBtnId);
        const headerMaximizeBtn = document.getElementById(maximizeBtnId);
        this.maximizeBtn = document.getElementById(maximizeBtnId.replace('Btn', 'Btn')); // The external button

        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.togglePanel());
        }

        if (headerMaximizeBtn) {
            headerMaximizeBtn.addEventListener('click', () => this.toggleMaximizePanel());
        }

        if (this.maximizeBtn) {
            this.maximizeBtn.addEventListener('click', () => this.maximizePanel());
        }
    }

    toggleMaximizePanel() {
        this.isMaximized = !this.isMaximized;
        
        if (this.isMaximized) {
            this.panel.classList.add('maximized');
            this.panel.classList.remove('collapsed');
            // Set higher z-index for maximized panel
            this.panel.style.zIndex = '2000';
            // Update button icon and title
            const maximizeBtn = this.panel.querySelector('.panel-maximize-btn');
            if (maximizeBtn) {
                maximizeBtn.textContent = '❐';
                maximizeBtn.title = 'Restore panel';
            }
            // Update toggle button
            if (this.toggleBtn) {
                this.toggleBtn.textContent = '−';
            }
        } else {
            this.panel.classList.remove('maximized');
            // Reset z-index to original value
            this.panel.style.zIndex = '';
            // Update button icon and title
            const maximizeBtn = this.panel.querySelector('.panel-maximize-btn');
            if (maximizeBtn) {
                maximizeBtn.textContent = '□';
                maximizeBtn.title = 'Maximize panel';
            }
        }
    }

    togglePanel() {
        const isCollapsed = this.panel.classList.toggle('collapsed');
        this.toggleBtn.textContent = isCollapsed ? '+' : '−';
        // Don't hide the external maximize button anymore
        // this.maximizeBtn.style.display = isCollapsed ? 'block' : 'none';
    }

    maximizePanel() {
        this.panel.classList.remove('collapsed');
        this.toggleBtn.textContent = '−';
        // Don't hide the external maximize button
        // this.maximizeBtn.style.display = 'none';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getPanel() {
        return this.panel;
    }

    getMaximizeButton() {
        return this.maximizeBtn;
    }
}

