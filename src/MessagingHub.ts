// MessagingHub - Observable/Subscriber Pattern
// Provides complete separation between UI and application logic

type MessageCallback<T = unknown> = (data: T) => void;

export class MessagingHub {
    private subscribers: Map<string, MessageCallback[]>;

    constructor() {
        this.subscribers = new Map();
    }

    /**
     * Subscribe to a message type
     * @param messageType - The type of message to listen for
     * @param callback - The function to call when message is received
     * @returns Unsubscribe function
     */
    subscribe<T = unknown>(messageType: string, callback: MessageCallback<T>): () => void {
        if (!this.subscribers.has(messageType)) {
            this.subscribers.set(messageType, []);
        }

        this.subscribers.get(messageType)!.push(callback as MessageCallback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(messageType);
            if (callbacks) {
                const index = callbacks.indexOf(callback as MessageCallback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Emit a message to all subscribers
     * @param messageType - The type of message to emit
     * @param data - Data to pass to subscribers
     */
    emit<T = unknown>(messageType: string, data: T | null = null): void {
        const callbacks = this.subscribers.get(messageType);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in subscriber for "${messageType}":`, error);
                }
            });
        }
    }

    /**
     * Subscribe once - automatically unsubscribe after first message
     * @param messageType - The type of message to listen for
     * @param callback - The function to call when message is received
     */
    once<T = unknown>(messageType: string, callback: MessageCallback<T>): void {
        const unsubscribe = this.subscribe<T>(messageType, (data) => {
            callback(data);
            unsubscribe();
        });
    }

    /**
     * Remove all subscribers for a message type
     * @param messageType - The type of message to clear
     */
    clear(messageType?: string): void {
        if (messageType) {
            this.subscribers.delete(messageType);
        } else {
            this.subscribers.clear();
        }
    }

    /**
     * Get count of subscribers for a message type
     * @param messageType - The type of message
     * @returns Number of subscribers
     */
    getSubscriberCount(messageType: string): number {
        const callbacks = this.subscribers.get(messageType);
        return callbacks ? callbacks.length : 0;
    }
}

// Message Types - Define all available messages
export const Messages = {
    // Toolbar Events
    TOOL_SELECTED: 'tool:selected',
    TOGGLE_NAMES: 'tool:toggleNames',
    SAVE_REQUESTED: 'tool:save',
    LOAD_REQUESTED: 'tool:load',
    UNDO_REQUESTED: 'tool:undo',
    REDO_REQUESTED: 'tool:redo',
    CLEAR_REQUESTED: 'tool:clear',
    UPDATE_PROBLEM_NAME: 'tool:updateProblemName',
    EXPORT_SVG: 'tool:exportSvg',
    
    // Canvas Events
    CANVAS_CLICKED: 'canvas:clicked',
    POINT_CLICKED: 'canvas:pointClicked',
    EDGE_CLICKED: 'canvas:edgeClicked',
    ANGLE_CLICKED: 'canvas:angleClicked',

    // Point Events
    POINT_CREATED: 'point:created',
    POINT_CREATE_REQUESTED: 'point:createRequested',
    POINT_MOVED: 'point:moved',
    POINT_DELETED: 'point:deleted',
    POINT_MENU_REQUESTED: 'point:menuRequested',
    POINT_ANGLES_DIALOG_REQUESTED: 'point:anglesDialogRequested',
    POINT_DRAGGING: 'point:dragging',

    // Edge Events
    EDGE_CREATED: 'edge:created',

    // Angle Events
    ANGLE_CREATED: 'angle:created',
    ANGLE_DELETED: 'angle:deleted',
    ANGLE_DELETE_REQUESTED: 'angle:deleteRequested',
    ANGLE_EDIT_REQUESTED: 'angle:editRequested',
    ANGLE_UPDATED: 'angle:updated',
    ANGLE_BISECTOR_REQUESTED: 'angle:bisectorRequested',
    ANGLE_SOLVE_REQUESTED: 'angle:solveRequested',
    ANGLE_SOLVABILITY_CHECK_REQUESTED: 'angle:solvabilityCheckRequested',
    ANGLE_SOLVABILITY_CHECK_COMPLETED: 'angle:solvabilityCheckCompleted',
    ANGLE_SOLVE_COMPLETED: 'angle:solveCompleted',
    ANGLE_VALUE_CALCULATED: 'angle:valueCalculated',

    // Circle Events
    CIRCLE_CREATED: 'circle:created',
    CIRCLE_DELETED: 'circle:deleted',

    // State Events
    STATE_CHANGED: 'state:changed',
    STATE_RESTORED: 'state:restored',

    // UI Updates
    STATUS_UPDATED: 'ui:statusUpdated',
    STATUS_UPDATE: 'ui:statusUpdate',
    PANEL_UPDATE: 'ui:panelUpdate',
    TOOLBAR_UPDATE: 'ui:toolbarUpdate',
    FEEDBACK_UPDATE: 'ui:feedbackUpdate',
    DATA_LOAD_REQUESTED: 'ui:dataLoadRequested',
    LOAD_TESTDATA_REQUESTED: 'ui:loadTestdataRequested',

    // Definition Events
    DEFINITION_ADDED: 'definition:added',
    DEFINITION_EDITED: 'definition:edited',
    DEFINITION_DELETED: 'definition:deleted',
} as const;

export type MessageType = typeof Messages[keyof typeof Messages];

