// Debug Logger - Tracks function calls and parameters
import { createElement } from './utils/domHelper.mjs';

export class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.panel = null;
        this.isInitialized = false;
    }

    init() {
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

    log(functionName, params = {}, result = null) {
        if (!this.isInitialized) this.init();
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
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

    render() {
        if (!this.logContainer) return;
        
        // Clear existing content
        this.logContainer.innerHTML = '';
        
        this.logs.forEach(log => {
            // Format parameters
            const paramsStr = Object.keys(log.params).length > 0 
                ? Object.entries(log.params)
                    .map(([key, val]) => {
                        let displayVal = val;
                        if (typeof val === 'object' && val !== null) {
                            if (val.id) displayVal = `{id: "${val.id}"}`;
                            else if (val.x !== undefined && val.y !== undefined) displayVal = `{x: ${val.x}, y: ${val.y}}`;
                            else if (Array.isArray(val)) displayVal = `[${val.length} items]`;
                            else displayVal = '{...}';
                        } else if (typeof val === 'string') {
                            displayVal = `"${val}"`;
                        }
                        return `${key}: ${displayVal}`;
                    })
                    .join(', ')
                : 'no params';
            
            // Build log entry
            const logEntry = createElement('div', { class: 'log-entry' }, [
                createElement('div', { class: 'log-time' }, [log.timestamp]),
                createElement('div', { class: 'log-function' }, [`${log.functionName}(${paramsStr})`])
            ]);
            
            // Add result if exists
            if (log.result !== null) {
                const resultText = typeof log.result === 'object' 
                    ? JSON.stringify(log.result).substring(0, 50) 
                    : log.result;
                logEntry.appendChild(createElement('div', { class: 'log-result' }, [`→ ${resultText}`]));
            }
            
            this.logContainer.appendChild(logEntry);
        });
    }

    clear() {
        this.logs = [];
        this.render();
    }
}

// Create singleton instance
export const debugLogger = new DebugLogger();
