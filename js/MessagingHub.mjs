// MessagingHub - Observable/Subscriber Pattern
// Provides complete separation between UI and application logic

export class MessagingHub {
    constructor() {
        this.subscribers = new Map();
    }

    /**
     * Subscribe to a message type
     * @param {string} messageType - The type of message to listen for
     * @param {Function} callback - The function to call when message is received
     * @returns {Function} Unsubscribe function
     */
    subscribe(messageType, callback) {
        if (!this.subscribers.has(messageType)) {
            this.subscribers.set(messageType, []);
        }

        this.subscribers.get(messageType).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(messageType);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Emit a message to all subscribers
     * @param {string} messageType - The type of message to emit
     * @param {*} data - Data to pass to subscribers
     */
    emit(messageType, data = null) {
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
     * @param {string} messageType - The type of message to listen for
     * @param {Function} callback - The function to call when message is received
     */
    once(messageType, callback) {
        const unsubscribe = this.subscribe(messageType, (data) => {
            callback(data);
            unsubscribe();
        });
    }

    /**
     * Remove all subscribers for a message type
     * @param {string} messageType - The type of message to clear
     */
    clear(messageType) {
        if (messageType) {
            this.subscribers.delete(messageType);
        } else {
            this.subscribers.clear();
        }
    }

    /**
     * Get count of subscribers for a message type
     * @param {string} messageType - The type of message
     * @returns {number} Number of subscribers
     */
    getSubscriberCount(messageType) {
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
    POINT_NOTES_MENU_REQUESTED: 'point:notesMenuRequested',
    POINT_NOTES_UPDATED: 'point:notesUpdated',
    POINT_ANGLES_DIALOG_REQUESTED: 'point:anglesDialogRequested',

    // Edge Events
    EDGE_CREATED: 'edge:created',
    EDGE_DELETED: 'edge:deleted',
    EDGE_DELETE_REQUESTED: 'edge:deleteRequested',
    EDGE_EDIT_REQUESTED: 'edge:editRequested',
    EDGE_UPDATED: 'edge:updated',

    // Angle Events
    ANGLE_CREATED: 'angle:created',
    ANGLE_DELETED: 'angle:deleted',
    ANGLE_DELETE_REQUESTED: 'angle:deleteRequested',
    ANGLE_EDIT_REQUESTED: 'angle:editRequested',
    ANGLE_UPDATED: 'angle:updated',
    ANGLE_BISECTOR_REQUESTED: 'angle:bisectorRequested',
    ANGLE_SOLVE_REQUESTED: 'angle:solveRequested',
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
    DATA_LOAD_REQUESTED: 'ui:dataLoadRequested',

    // Definition Events
    DEFINITION_ADDED: 'definition:added',
    DEFINITION_EDITED: 'definition:edited',
    DEFINITION_DELETED: 'definition:deleted',
};
