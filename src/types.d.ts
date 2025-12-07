// Global type augmentations

declare global {
    interface Window {
        tool: import('./Creator').Creator | import('./Solver').Solver;
    }
}

export {};
