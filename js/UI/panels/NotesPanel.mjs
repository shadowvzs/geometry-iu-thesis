import { Panel } from '../Panel.mjs';
import { createElement } from '../../utils/domHelper.mjs';

export class NotesPanel extends Panel {
    constructor(messagingHub) {
        super(messagingHub);
        this.messagingHub = messagingHub;
    }

    initialize() {
        const { panel, maximizeBtn } = this.createPanel({
            id: 'notesPanel',
            panelClass: 'notes-panel',
            headerTitle: '📝 Notes',
            icon: '📝',
            content: [
                ['div', { id: 'notesList', class: 'notes-list' }, [
                    ['p', { class: 'no-notes' }, ['No notes yet. Add notes to points, edges, or angles.']]
                ]]
            ]
        });

        document.querySelector('.container').appendChild(panel);
        document.querySelector('.container').appendChild(maximizeBtn);

        this.setupToggleListeners('toggleNotesPanel', 'maximizeNotesBtn');

        return this;
    }

    /**
     * Update notes panel with points and angles data
     * @param {Array} points - Array of points with notes
     * @param {Array} angles - Array of angles with notes
     */
    updateNotes(points, angles) {
        const notesList = document.getElementById('notesList');
        
        // Clear existing content
        notesList.innerHTML = '';
        
        let hasNotes = false;

        // Collect all notes from points
        points.forEach(point => {
            if (point.notes && point.notes.trim()) {
                hasNotes = true;
                
                const noteItem = createElement('div', { class: 'note-item point-note' });
                
                const header = createElement('div', { class: 'note-item-header' });
                header.textContent = `🔵 point ${point.id}`;
                
                const content = createElement('div', { class: 'note-item-content' });
                content.textContent = point.notes;
                
                noteItem.appendChild(header);
                noteItem.appendChild(content);
                notesList.appendChild(noteItem);
            }
        });

        // Collect all notes from angles
        angles.forEach(angle => {
            if (angle.notes && angle.notes.trim()) {
                hasNotes = true;
                
                const angleLabel = angle.name || 
                    (angle.neighborPoints && angle.point 
                        ? `∠${angle.neighborPoints[0]}${angle.point}${angle.neighborPoints[1]}`
                        : 'Angle');
                
                const noteItem = createElement('div', { class: 'note-item angle-note' });
                
                const header = createElement('div', { class: 'note-item-header' });
                header.textContent = `📐 ${angleLabel}`;
                
                const content = createElement('div', { class: 'note-item-content' });
                content.textContent = angle.notes;
                
                noteItem.appendChild(header);
                noteItem.appendChild(content);
                notesList.appendChild(noteItem);
            }
        });

        if (!hasNotes) {
            const noNotesMsg = createElement('p', { class: 'no-notes' });
            noNotesMsg.textContent = 'No notes yet. Add notes to points, edges, or angles.';
            notesList.appendChild(noNotesMsg);
        }
    }
}
