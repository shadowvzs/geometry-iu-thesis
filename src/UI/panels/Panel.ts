import { createElement } from "../../utils/domHelper";

interface PanelConfig {
    id: string;
    panelClass: string;
    headerTitle: string;
    icon: string;
    clearButton?: {
        id: string;
        class: string;
        title: string;
        icon: string;
    };
    content: any[];
}

export class Panel {
    protected app: any;
    protected panel: HTMLElement | null = null;
    protected maximizeBtn: HTMLElement | null = null;
    protected toggleBtn: HTMLElement | null = null;
    protected isMaximized: boolean = false;

    constructor(app: any) {
        this.app = app;
    }

    createPanel(config: PanelConfig): { panel: HTMLElement; maximizeBtn: HTMLElement } {
        const { id, panelClass, headerTitle, icon, content } = config;
        
        this.panel = createElement('div', { id, class: panelClass }, [
            ['div', { class: `${panelClass.split('-')[0]}-header` }, [
                ['h3', {}, [headerTitle]],
                ...this.createHeaderButtons(config)
            ]],
            ...content
        ]) as HTMLElement;

        this.maximizeBtn = createElement('button', {
            id: `maximize${this.capitalizeFirst(id.replace('Panel', ''))}Btn`,
            class: `maximize-btn maximize-${id.replace('Panel', '')}-btn`,
            style: 'display: none;',
            title: `Show ${headerTitle.replace(/^.+ /, '')}`
        }, [icon]) as HTMLElement;

        return { panel: this.panel, maximizeBtn: this.maximizeBtn };
    }

    createHeaderButtons(config: PanelConfig): any[] {
        const buttons: any[] = [];
        
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

    setupToggleListeners(toggleBtnId: string, maximizeBtnId: string): void {
        this.toggleBtn = document.getElementById(toggleBtnId);
        const headerMaximizeBtn = document.getElementById(maximizeBtnId);
        this.maximizeBtn = document.getElementById(maximizeBtnId.replace('Btn', 'Btn'));

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

    toggleMaximizePanel(): void {
        if (!this.panel) return;
        
        this.isMaximized = !this.isMaximized;
        
        if (this.isMaximized) {
            this.panel.classList.add('maximized');
            this.panel.classList.remove('collapsed');
            this.panel.style.zIndex = '2000';
            const maximizeBtn = this.panel.querySelector('.panel-maximize-btn');
            if (maximizeBtn) {
                maximizeBtn.textContent = '❐';
                (maximizeBtn as HTMLElement).title = 'Restore panel';
            }
            if (this.toggleBtn) {
                this.toggleBtn.textContent = '−';
            }
        } else {
            this.panel.classList.remove('maximized');
            this.panel.style.zIndex = '';
            const maximizeBtn = this.panel.querySelector('.panel-maximize-btn');
            if (maximizeBtn) {
                maximizeBtn.textContent = '□';
                (maximizeBtn as HTMLElement).title = 'Maximize panel';
            }
        }
    }

    togglePanel(): void {
        if (!this.panel || !this.toggleBtn) return;
        
        const isCollapsed = this.panel.classList.toggle('collapsed');
        this.toggleBtn.textContent = isCollapsed ? '+' : '−';
    }

    maximizePanel(): void {
        if (!this.panel || !this.toggleBtn) return;
        
        this.panel.classList.remove('collapsed');
        this.toggleBtn.textContent = '−';
    }

    capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getPanel(): HTMLElement | null {
        return this.panel;
    }

    getMaximizeButton(): HTMLElement | null {
        return this.maximizeBtn;
    }
}

