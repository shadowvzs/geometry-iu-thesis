// Debug Logger - Tracks function calls and parameters
import { createElement } from './utils/domHelper';

interface LogEntry {
    timestamp: string;
    functionName: string;
    params: Record<string, unknown>;
    result: unknown;
    id: number;
}

export class DebugLogger {
    private logs: LogEntry[];
    private maxLogs: number;
    private panel: HTMLElement | null;
    private logContainer: HTMLElement | null;
    private clearBtn: HTMLElement | null;
    private isInitialized: boolean;

    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.panel = null;
        this.logContainer = null;
        this.clearBtn = null;
        this.isInitialized = false;
    }

    init(): void {
        if (this.isInitialized) return;
        
        // Create debug panel if it doesn't exist
        this.panel = document.getElementById('debugPanel');
        if (!this.panel) {
            console.warn('Debug panel not found in DOM');
            return;
        }
        
        this.logContainer = document.getElementById('debugLogs');
        this.clearBtn = document.getElementById('clearDebugBtn');
        
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clear());
        }
        
        this.isInitialized = true;
    }

    log(functionName: string, params: Record<string, unknown> = {}, result: unknown = null): void {
        if (!this.isInitialized) this.init();
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry: LogEntry = {
            timestamp,
            functionName,
            params,
            result,
            id: Date.now() + Math.random()
        };
        
        this.logs.unshift(logEntry); // Add to beginning
        
        // Limit log size
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
        
        this.render();
    }

    private render(): void {
        if (!this.logContainer) return;
        
        // Clear existing content
        this.logContainer.innerHTML = '';
        
        this.logs.forEach(log => {
            // Format parameters
            const paramsStr = Object.keys(log.params).length > 0 
                ? Object.entries(log.params)
                    .map(([key, val]) => {
                        let displayVal: string;
                        if (typeof val === 'object' && val !== null) {
                            const obj = val as Record<string, unknown>;
                            if (obj.id) displayVal = `{id: "${obj.id}"}`;
                            else if (obj.x !== undefined && obj.y !== undefined) displayVal = `{x: ${obj.x}, y: ${obj.y}}`;
                            else if (Array.isArray(val)) displayVal = `[${val.length} items]`;
                            else displayVal = '{...}';
                        } else if (typeof val === 'string') {
                            displayVal = `"${val}"`;
                        } else {
                            displayVal = String(val);
                        }
                        return `${key}: ${displayVal}`;
                    })
                    .join(', ')
                : 'no params';
            
            // Build log entry
            const logEntryEl = createElement('div', { class: 'log-entry' }, [
                createElement('div', { class: 'log-time' }, [log.timestamp]),
                createElement('div', { class: 'log-function' }, [`${log.functionName}(${paramsStr})`])
            ]);
            
            // Add result if exists
            if (log.result !== null) {
                const resultText = typeof log.result === 'object' 
                    ? JSON.stringify(log.result).substring(0, 50) 
                    : String(log.result);
                logEntryEl.appendChild(createElement('div', { class: 'log-result' }, [`→ ${resultText}`]));
            }
            
            this.logContainer!.appendChild(logEntryEl);
        });
    }

    clear(): void {
        this.logs = [];
        this.render();
    }
}

// Create singleton instance
export const debugLogger = new DebugLogger();

