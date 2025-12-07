import { Creator } from './Creator.mjs';
import { Solver } from './Solver.mjs';

const TOOL_MODE = {
    CREATOR: 'creator',
    SOLVER: 'solver'
};

// Initialize the tool
if (typeof document !== 'undefined') {
    const params = new URLSearchParams(document.location.search);
    const mode = params.get('mode') || TOOL_MODE.CREATOR;
    if (!Object.values(TOOL_MODE).includes(mode)) {
        alert(`Invalid mode: ${mode}. Defaulting to CREATOR mode.`);
    }
    const initialProblem = params.get('problem') || null;
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add(`${mode}-mode`);
        if (mode === TOOL_MODE.CREATOR) {
            window.tool = new Creator();
        } else {
            window.tool = new Solver(initialProblem);
        }
    });
}
