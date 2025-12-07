import { Creator } from './Creator';
import { Solver } from './Solver';

declare global {
    interface Window {
        tool: Creator | Solver;
    }
}

const TOOL_MODE = {
    CREATOR: 'creator',
    SOLVER: 'solver'
} as const;

type ToolMode = typeof TOOL_MODE[keyof typeof TOOL_MODE];

// Initialize the tool
if (typeof document !== 'undefined') {
    const params = new URLSearchParams(document.location.search);
    const mode = (params.get('mode') || TOOL_MODE.CREATOR) as ToolMode;
    if (!Object.values(TOOL_MODE).includes(mode as any)) {
        alert(`Invalid mode: ${mode}. Defaulting to CREATOR mode.`);
    }
    const initialProblem = params.get('problem');
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add(`${mode}-mode`);
        if (mode === TOOL_MODE.CREATOR) {
            window.tool = new Creator();
        } else {
            window.tool = new Solver(initialProblem ?? null);
        }
    });
}
