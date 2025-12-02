import { createElement } from "../utils/domHelper.mjs";
import { getNewPointName, degreesToRadians } from "../utils/mathHelper.mjs";
import { Messages } from "../MessagingHub.mjs";

export class Canvas {
    constructor(messagingHub) {
        this.messagingHub = messagingHub;
    }

    setupSubscriptions = () => {
        this.messagingHub.subscribe(Messages.POINT_MENU_REQUESTED, (point) => {
            this.showPointMenu(point);
        });
        
        this.messagingHub.subscribe(Messages.ANGLE_EDIT_REQUESTED, (angleData) => {
            this.showAngleEditor(angleData);
        });
        
        this.messagingHub.subscribe(Messages.EDGE_EDIT_REQUESTED, (edgeObj) => {
            this.showEdgeEditor(edgeObj);
        });
        
        this.messagingHub.subscribe(Messages.LOAD_REQUESTED, () => {
            this.showLoadDialog();
        });
    }

    initialize = () => {
        // Create canvas container
        this.container = createElement('div', { class: 'canvas-container' }, [
            ['svg', { id: 'geometryCanvas', width: '100%', height: '100%' }, [
                ['defs', {}, [
                    ['marker', { id: 'arrowhead', markerWidth: '10', markerHeight: '10', refX: '9', refY: '3', orient: 'auto' }, [
                        ['polygon', { points: '0 0, 10 3, 0 6', fill: '#666' }]
                    ]]
                ]]
            ]]
        ]);

        this.svg = this.container.querySelector('#geometryCanvas');
                
        // Subscribe to UI requests
        this.setupSubscriptions();

        return this.container;
    }

    // Point Menu Popover
    showPointMenu = (point) => {
        // Remove any existing point menu dialogs
        document.querySelectorAll('.point-menu-container').forEach(el => el.remove());
        
        // Get SVG bounding rect to position correctly
        const svgRect = this.svg.getBoundingClientRect();
        
        // Inputs section
        const distanceInput = createElement('input', {
            type: 'number',
            id: 'pointDistance',
            value: '100',
            min: '10',
            max: '500',
            step: '10'
        });
        
        const angleInput = createElement('input', {
            type: 'number',
            id: 'pointAngle',
            value: '0',
            min: '-360',
            max: '360',
            step: '1'
        });
        
        const inputsDiv = createElement('div', { class: 'point-menu-inputs' }, [
            createElement('label', {}, ['Distance (px):', distanceInput]),
            createElement('label', {}, ['Angle (degrees):', angleInput])
        ]);
        
        // Directions section
        const directions = [
            { angle: '225', label: 'NW', title: '225° (NW)' },
            { angle: '270', label: 'N', title: '270° (N)' },
            { angle: '315', label: 'NE', title: '315° (NE)' },
            { angle: '180', label: 'W', title: '180° (W)' },
            { angle: null, label: '•', isCenter: true },
            { angle: '0', label: 'E', title: '0° (E)' },
            { angle: '135', label: 'SW', title: '135° (SW)' },
            { angle: '90', label: 'S', title: '90° (S)' },
            { angle: '45', label: 'SE', title: '45° (SE)' }
        ];
        
        const directionChildren = directions.map(dir => 
            dir.isCenter 
                ? createElement('div', { class: 'dir-center' }, [dir.label])
                : createElement('button', { 
                    class: 'dir-btn',
                    'data-angle': dir.angle,
                    title: dir.title
                }, [dir.label])
        );
        
        const directionsDiv = createElement('div', { class: 'point-menu-directions' }, [
            createElement('div', { class: 'direction-label' }, ['Quick Directions:']),
            createElement('div', { class: 'direction-grid' }, directionChildren)
        ]);
        
        // Buttons section
        const buttonsDiv = createElement('div', { class: 'point-menu-buttons' }, [
            createElement('button', { id: 'createPointBtn' }, ['Create']),
            createElement('button', { id: 'movePointBtn' }, ['Move']),
            createElement('button', { id: 'cancelPointBtn' }, ['Cancel'])
        ]);
        
        // Assemble menu
        const menu = createElement('div', { class: 'point-menu-container' }, [
            createElement('div', { class: 'point-menu-header' }, [`Create New Point from ${point.id}`]),
            inputsDiv,
            directionsDiv,
            buttonsDiv
        ]);
        
        // Position menu
        menu.style.left = (svgRect.left + point.x + 20) + 'px';
        menu.style.top = (svgRect.top + point.y - 20) + 'px';
        
        document.body.appendChild(menu);
        
        // Event delegation for direction buttons
        directionsDiv.addEventListener('click', (e) => {
            const btn = e.target.closest('.dir-btn');
            if (btn) {
                e.preventDefault();
                const angle = btn.getAttribute('data-angle');
                angleInput.value = angle;
                angleInput.focus();
            }
        });
        
        distanceInput.focus();
        distanceInput.select();
        
        const createPoint = () => {
            const distance = parseFloat(distanceInput.value);
            const angleDegrees = parseFloat(angleInput.value);
            
            if (isNaN(distance) || isNaN(angleDegrees)) {
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ Invalid distance or angle values');
                return;
            }
            
            // Validate point still exists
            if (!point || !point.id || !point.x || !point.y) {
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ Source point is no longer valid');
                menu.remove();
                return;
            }
            
            // Convert angle from degrees to radians using utility function
            const angleRadians = degreesToRadians(angleDegrees);
            
            // Calculate new point position
            const newX = point.x + distance * Math.cos(angleRadians);
            const newY = point.y + distance * Math.sin(angleRadians);
            
            // Check if new position is within canvas bounds
            const svgRect = this.svg.getBoundingClientRect();
            if (newX < 0 || newX > svgRect.width || newY < 0 || newY > svgRect.height) {
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ New point would be outside canvas bounds');
                return;
            }
            
            // Emit message to create the new point with edge
            // Create a fresh copy of the point data to avoid stale references
            this.messagingHub.emit(Messages.POINT_CREATE_REQUESTED, {
                fromPoint: { id: point.id, x: point.x, y: point.y },
                distance: distance,
                angle: angleDegrees,
                newX: newX,
                newY: newY
            });
            
            menu.remove();
        };
        
        document.getElementById('createPointBtn').addEventListener('click', createPoint);
        
        document.getElementById('cancelPointBtn').addEventListener('click', () => {
            menu.remove();
            this.messagingHub.emit(Messages.STATUS_UPDATED, 'Point creation cancelled');
        });
        
        // Move button - constrained dragging along selected direction
        document.getElementById('movePointBtn').addEventListener('click', () => {
            const angleDegrees = parseFloat(angleInput.value) || 0;
            const angleRadians = degreesToRadians(angleDegrees);
            
            // Direction vector (unit vector along the angle)
            const dirX = Math.cos(angleRadians);
            const dirY = Math.sin(angleRadians);
            
            // Store original position
            const originalX = point.x;
            const originalY = point.y;
            
            menu.remove();
            this.messagingHub.emit(Messages.STATUS_UPDATED, `Moving ${point.id} along ${angleDegrees}° - drag to move, click to finish`);
            
            // Find the point's SVG group and circle element
            const pointGroup = this.svg.querySelector(`g[data-point-id="${point.id}"]`);
            const pointElement = pointGroup?.querySelector('.point-circle');
            if (!pointGroup || !pointElement) {
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ Could not find point element');
                return;
            }
            
            pointElement.style.cursor = 'grabbing';
            pointElement.classList.add('dragging');
            
            // Draw a guide line showing the constrained direction
            const guideLength = 2000;
            const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            guideLine.setAttribute('x1', originalX - guideLength * dirX);
            guideLine.setAttribute('y1', originalY - guideLength * dirY);
            guideLine.setAttribute('x2', originalX + guideLength * dirX);
            guideLine.setAttribute('y2', originalY + guideLength * dirY);
            guideLine.setAttribute('stroke', '#ff6600');
            guideLine.setAttribute('stroke-width', '1');
            guideLine.setAttribute('stroke-dasharray', '5,5');
            guideLine.setAttribute('opacity', '0.5');
            guideLine.classList.add('move-guide-line');
            this.svg.insertBefore(guideLine, this.svg.firstChild);
            
            const svgRect = this.svg.getBoundingClientRect();
            
            const onMouseMove = (e) => {
                const mouseX = e.clientX - svgRect.left;
                const mouseY = e.clientY - svgRect.top;
                
                // Project mouse position onto the direction line
                // Vector from original point to mouse
                const dx = mouseX - originalX;
                const dy = mouseY - originalY;
                
                // Project onto direction vector: (dx,dy) · (dirX,dirY)
                const projection = dx * dirX + dy * dirY;
                
                // New position along the constrained direction
                const newX = Math.round(originalX + projection * dirX);
                const newY = Math.round(originalY + projection * dirY);
                
                // Update point position
                point.x = newX;
                point.y = newY;
                
                // Update SVG element
                pointElement.setAttribute('cx', newX);
                pointElement.setAttribute('cy', newY);
                
                // Update label position during drag (same positioning as create)
                const label = pointGroup.querySelector('.point-label');
                if (label) {
                    label.setAttribute('x', newX);
                    label.setAttribute('y', newY - 15);
                }
                
                // Update connected edges
                this.messagingHub.emit(Messages.POINT_DRAGGING, { point });
            };
            
            // Prevent click event from creating a new point during move
            const onClickCapture = (e) => {
                e.stopPropagation();
                e.preventDefault();
            };
            this.svg.addEventListener('click', onClickCapture, true);
            
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Remove click blocker after a short delay to catch the click event
                setTimeout(() => {
                    this.svg.removeEventListener('click', onClickCapture, true);
                }, 10);
                
                pointElement.style.cursor = '';
                pointElement.classList.remove('dragging');
                
                // Remove guide line
                guideLine.remove();
                
                // Emit move completed to check edge/circle intersections
                this.messagingHub.emit(Messages.POINT_MOVED, { point });
                
                this.messagingHub.emit(Messages.STATUS_UPDATED, `Point ${point.id} moved to (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
                this.messagingHub.emit(Messages.STATE_CHANGED);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        // Handle Enter key
        distanceInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                angleInput.focus();
                angleInput.select();
            }
        });
        
        angleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createPoint();
        });
        
        // Handle Escape key
        menu.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                menu.remove();
                this.messagingHub.emit(Messages.STATUS_UPDATED, 'Point creation cancelled');
            }
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // Angle Edit Popover
    showAngleEditor = (angleData) => {
        // Remove any existing input dialogs
        document.querySelectorAll('.angle-input-container').forEach(el => el.remove());
        
        const input = createElement('div', { class: 'angle-input-container' });
        
        // Get SVG bounding rect to position correctly
        const svgRect = this.svg.getBoundingClientRect();
        
        // Get text element from the group
        const textElement = angleData.groupElement?.querySelector('text');
        const textX = textElement ? parseFloat(textElement.getAttribute('x')) : 100;
        const textY = textElement ? parseFloat(textElement.getAttribute('y')) : 100;
        
        input.style.left = (svgRect.left + textX) + 'px';
        input.style.top = (svgRect.top + textY) + 'px';
        
        // Create input fields first
        const nameField = createElement('input', {
            type: 'text',
            id: 'angleNameInput',
            placeholder: 'Angle name'
        });
        nameField.value = angleData.name || '';
        
        const labelField = createElement('input', {
            type: 'text',
            id: 'angleLabelInput',
            placeholder: 'Greek letter label'
        });
        labelField.value = angleData.label || '';
        
        const valueField = createElement('input', {
            type: 'text',
            id: 'angleValueInput',
            placeholder: `${angleData.calculatedValue.toFixed(1)}°`,
            style: 'flex: 1;'
        });
        valueField.value = angleData.value || '';
        
        // Add question mark button for "to be solved"
        const questionMarkBtn = createElement('button', {
            class: 'greek-letter-btn',
            'data-letter': '?',
            title: 'Mark as unknown (to be solved)',
            style: 'margin: 0;'
        }, ['?']);
        
        // Create value row container with flex
        const valueRow = createElement('div', {
            style: 'display: flex; flex-direction: row; gap: 8px; align-items: center;'
        }, [valueField, questionMarkBtn]);
        
        const radiusField = createElement('input', {
            type: 'number',
            id: 'angleRadiusInput',
            min: '10',
            max: '100',
            step: '5'
        });
        radiusField.value = angleData.radius || 30;
        
        // Greek letters
        const greekLetters = [
            { letter: 'α', name: 'alpha' },
            { letter: 'β', name: 'beta' },
            { letter: 'γ', name: 'gamma' },
            { letter: 'δ', name: 'delta' },
            { letter: 'ε', name: 'epsilon' }
        ];
        
        const greekButtons = greekLetters.map(({ letter, name }) => 
            createElement('button', {
                class: 'greek-letter-btn',
                'data-letter': letter,
                title: name
            }, [letter])
        );
        
        const greekContainer = createElement('div', { class: 'greek-letters-container' }, [
            ...greekButtons
        ]);
        
        // Assemble input dialog
        input.appendChild(createElement('div', { class: 'angle-input-header' }, ['Edit Angle']));
        input.appendChild(createElement('label', {}, ['Name:', nameField]));
        input.appendChild(createElement('label', {}, ['Label (Greek letter):', labelField]));
        input.appendChild(greekContainer);
        input.appendChild(createElement('label', {}, ['Value (degrees):', valueRow]));
        input.appendChild(createElement('label', {}, ['Radius (px):', radiusField]));
        input.appendChild(createElement('div', { class: 'angle-input-buttons' }, [
            createElement('button', { id: 'closeAngle' }, ['Close']),
            createElement('button', { id: 'deleteAngle', style: 'background-color: #dc3545;' }, ['Delete'])
        ]));
        
        document.body.appendChild(input);
        
        // Auto-save function
        const autoSave = () => {
            const name = nameField.value;
            const label = labelField.value;
            const value = valueField.value;
            const radius = parseFloat(radiusField.value);
            
            // Emit angle update message with all the data
            this.messagingHub.emit(Messages.ANGLE_UPDATED, {
                angleData,
                name,
                label,
                value,
                radius
            });
        };
        
        // Event delegation for Greek letter buttons - auto-save on click
        greekContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.greek-letter-btn');
            if (btn) {
                e.preventDefault();
                const letter = btn.dataset.letter;
                labelField.value = letter;
                autoSave();
                labelField.focus();
            }
        });
        
        // Question mark button handler
        questionMarkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            valueField.value = '?';
            autoSave();
            valueField.focus();
        });
        
        // Auto-save on input change
        nameField.addEventListener('input', autoSave);
        labelField.addEventListener('input', autoSave);
        valueField.addEventListener('input', autoSave);
        radiusField.addEventListener('input', autoSave);
        
        valueField.focus();
        valueField.select();
        
        document.getElementById('closeAngle').addEventListener('click', () => {
            input.remove();
        });
        
        document.getElementById('deleteAngle').addEventListener('click', () => {
            // Emit message to delete the angle
            this.messagingHub.emit(Messages.ANGLE_DELETE_REQUESTED, angleData);
            input.remove();
        });
        
        valueField.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.remove();
            }
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeInput(e) {
                if (!input.contains(e.target)) {
                    input.remove();
                    document.removeEventListener('click', closeInput);
                }
            });
        }, 100);
    }

    // Edge Edit Popover
    showEdgeEditor = (edgeObj) => {
        // Remove any existing edge input dialogs
        document.querySelectorAll('.edge-input-container').forEach(el => el.remove());
        
        // Calculate midpoint of edge
        const point1 = edgeObj.point1;
        const point2 = edgeObj.point2;
        
        if (!point1 || !point2) return;
        
        const midX = (point1.x + point2.x) / 2;
        const midY = (point1.y + point2.y) / 2;
        
        // Get SVG bounding rect to position correctly
        const svgRect = this.svg.getBoundingClientRect();
        
        // Assemble input dialog
        const input = createElement('div', { class: 'edge-input-container' }, [
            createElement('div', { class: 'edge-input-header' }, [`Edge ${point1.id}—${point2.id}`]),
            createElement('div', { class: 'edge-input-buttons' }, [
                createElement('button', { id: 'deleteEdge', style: 'background-color: #dc3545;' }, ['Delete']),
                createElement('button', { id: 'cancelEdge' }, ['Cancel'])
            ])
        ]);
        
        // Position input
        input.style.left = (svgRect.left + midX) + 'px';
        input.style.top = (svgRect.top + midY) + 'px';
        
        document.body.appendChild(input);
        
        document.getElementById('deleteEdge').addEventListener('click', () => {
            if (confirm(`Delete edge between ${point1.id} and ${point2.id}?`)) {
                // Emit message to delete edge
                this.messagingHub.emit(Messages.EDGE_DELETE_REQUESTED, edgeObj);
                input.remove();
            }
        });
        
        document.getElementById('cancelEdge').addEventListener('click', () => {
            input.remove();
            this.messagingHub.emit(Messages.STATUS_UPDATED, 'Edge editing cancelled');
        });
        
        // Close on Escape
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.remove();
            }
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeInput(e) {
                if (!input.contains(e.target)) {
                    input.remove();
                    document.removeEventListener('click', closeInput);
                }
            });
        }, 100);
    }

    // Load JSON Dialog
    showLoadDialog = () => {
        // Remove any existing load dialogs
        document.querySelectorAll('.load-dialog').forEach(el => el.remove());
        
        const dialog = createElement('div', { class: 'load-dialog' });
        
        // Textarea
        const textarea = createElement('textarea', {
            id: 'jsonInput',
            placeholder: 'Paste JSON data here...'
        });
        
        // Assemble dialog
        dialog.appendChild(createElement('div', { class: 'load-dialog-content' }, [
            createElement('h3', {}, ['Load Geometry Data']),
            textarea,
            createElement('div', { class: 'load-dialog-buttons' }, [
                createElement('button', { id: 'loadConfirm' }, ['Load']),
                createElement('button', { id: 'loadCancel' }, ['Cancel'])
            ])
        ]));
        
        document.body.appendChild(dialog);
        
        textarea.focus();
        
        document.getElementById('loadConfirm').addEventListener('click', () => {
            try {
                const jsonString = textarea.value.trim();
                if (!jsonString) {
                    this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ No data provided');
                    return;
                }
                
                const data = JSON.parse(jsonString);
                // Emit message to load data
                this.messagingHub.emit(Messages.DATA_LOAD_REQUESTED, data);
                dialog.remove();
            } catch (err) {
                console.error('Failed to parse JSON:', err);
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ Invalid JSON format');
                alert('Invalid JSON format. Please check your input.');
            }
        });
        
        document.getElementById('loadCancel').addEventListener('click', () => {
            dialog.remove();
            this.messagingHub.emit(Messages.STATUS_UPDATED, 'Load cancelled');
        });
        
        // Close on Escape key
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
                this.messagingHub.emit(Messages.STATUS_UPDATED, 'Load cancelled');
            }
        });
    }
}
