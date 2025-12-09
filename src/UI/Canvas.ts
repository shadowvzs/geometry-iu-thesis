import { createElement } from "../utils/domHelper";
import { degreesToRadians } from "../utils/mathHelper";
import { MessagingHub, Messages } from "../MessagingHub";
import { Point, AngleEditRequestData, Rect } from "../types";
import { ShowAngleEditorPopover } from "./popover/EditAngle";

export class Canvas {
    private messagingHub: MessagingHub;
    container!: HTMLElement;
    svg!: HTMLElement;
    svgGroup!: {
        circle: HTMLElement;
        edge: HTMLElement;
        angle: HTMLElement;
        point: HTMLElement;
    };

    constructor(messagingHub: MessagingHub) {
        this.messagingHub = messagingHub;
    }

    setupSubscriptions = (): void => {
        this.messagingHub.subscribe(Messages.POINT_MENU_REQUESTED, (point: Point) => {
            this.showPointMenu(point);
        });
        
        this.messagingHub.subscribe(Messages.ANGLE_EDIT_REQUESTED, (data: AngleEditRequestData) => {
            this.showAngleEditor(data);
        });
        
        this.messagingHub.subscribe(Messages.LOAD_REQUESTED, () => {
            this.showLoadDialog();
        });
    }

    initialize = (): HTMLElement => {
        // Create canvas container
        this.container = createElement('div', { class: 'canvas-container' }, [
            ['svg', { id: 'geometryCanvas', width: '100%', height: '100%' }, [
                ['defs', {}, [
                    ['marker', { id: 'arrowhead', markerWidth: '10', markerHeight: '10', refX: '9', refY: '3', orient: 'auto' }, [
                        ['polygon', { points: '0 0, 10 3, 0 6', fill: '#666' }]
                    ]]
                ]],
                ['g', { class: 'svg-group', ['data-group-id']: 'circle' }, []],
                ['g', { class: 'svg-group', ['data-group-id']: 'edge' }, []],
                ['g', { class: 'svg-group', ['data-group-id']: 'angle' }, []],
                ['g', { class: 'svg-group', ['data-group-id']: 'point' }, []],
            ]]
        ]) as HTMLElement;

        this.svg = this.container.querySelector('#geometryCanvas') as HTMLElement;
        this.svgGroup = {
            circle: this.svg.querySelector('g[data-group-id="circle"].svg-group') as HTMLElement,
            edge: this.svg.querySelector('g[data-group-id="edge"].svg-group') as HTMLElement,
            angle: this.svg.querySelector('g[data-group-id="angle"].svg-group') as HTMLElement,
            point: this.svg.querySelector('g[data-group-id="point"].svg-group') as HTMLElement,
        };

        // Subscribe to UI requests
        this.setupSubscriptions();

        return this.container;
    }

    clearContent = (): void => {
        this.svgGroup.circle.innerHTML = '';
        this.svgGroup.edge.innerHTML = '';
        this.svgGroup.angle.innerHTML = '';
        this.svgGroup.point.innerHTML = '';
    }

    // Point Menu Popover
    showPointMenu = (point: Point): void => {
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
        }) as HTMLInputElement;
        
        const angleInput = createElement('input', {
            type: 'number',
            id: 'pointAngle',
            value: '0',
            min: '-360',
            max: '360',
            step: '1'
        }) as HTMLInputElement;
        
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
                    'data-angle': dir.angle || '',
                    title: dir.title || ''
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
        ]) as HTMLElement;
        
        // Position menu
        menu.style.left = (svgRect.left + point.x + 20) + 'px';
        menu.style.top = (svgRect.top + point.y - 20) + 'px';
        
        document.body.appendChild(menu);
        
        // Event delegation for direction buttons
        directionsDiv.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.dir-btn') as HTMLButtonElement;
            if (btn) {
                e.preventDefault();
                const angle = btn.getAttribute('data-angle');
                if (angle) {
                    angleInput.value = angle;
                    angleInput.focus();
                }
            }
        });
        
        distanceInput.focus();
        distanceInput.select();
        
        const createPoint = (): void => {
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
            this.messagingHub.emit(Messages.POINT_CREATE_REQUESTED, {
                fromPoint: { id: point.id, x: point.x, y: point.y },
                distance: distance,
                angle: angleDegrees,
                newX: newX,
                newY: newY
            });
            
            menu.remove();
        };
        
        document.getElementById('createPointBtn')!.addEventListener('click', createPoint);
        
        document.getElementById('cancelPointBtn')!.addEventListener('click', () => {
            menu.remove();
            this.messagingHub.emit(Messages.STATUS_UPDATED, 'Point creation cancelled');
        });
        
        // Move button - constrained dragging along selected direction
        document.getElementById('movePointBtn')!.addEventListener('click', () => {
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
            const pointGroup = this.svg.querySelector(`g[data-pointId="${point.id}"]`);
            const pointElement = pointGroup?.querySelector('.point-circle') as SVGCircleElement;
            if (!pointGroup || !pointElement) {
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ Could not find point element');
                return;
            }
            
            pointElement.style.cursor = 'grabbing';
            pointElement.classList.add('dragging');
            
            // Draw a guide line showing the constrained direction
            const guideLength = 2000;
            const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            guideLine.setAttribute('x1', String(originalX - guideLength * dirX));
            guideLine.setAttribute('y1', String(originalY - guideLength * dirY));
            guideLine.setAttribute('x2', String(originalX + guideLength * dirX));
            guideLine.setAttribute('y2', String(originalY + guideLength * dirY));
            guideLine.setAttribute('stroke', '#ff6600');
            guideLine.setAttribute('stroke-width', '1');
            guideLine.setAttribute('stroke-dasharray', '5,5');
            guideLine.setAttribute('opacity', '0.5');
            guideLine.classList.add('move-guide-line');
            this.svg.insertBefore(guideLine, this.svg.firstChild);
            
            const svgRect = this.svg.getBoundingClientRect();
            
            const onMouseMove = (e: MouseEvent): void => {
                const mouseX = e.clientX - svgRect.left;
                const mouseY = e.clientY - svgRect.top;
                
                // Project mouse position onto the direction line
                const dx = mouseX - originalX;
                const dy = mouseY - originalY;
                
                // Project onto direction vector
                const projection = dx * dirX + dy * dirY;
                
                // New position along the constrained direction
                const newX = Math.round(originalX + projection * dirX);
                const newY = Math.round(originalY + projection * dirY);
                
                // Update point position
                point.x = newX;
                point.y = newY;
                
                // Update SVG element
                pointElement.setAttribute('cx', String(newX));
                pointElement.setAttribute('cy', String(newY));
                
                // Update label position during drag
                const label = pointGroup.querySelector('.point-label');
                if (label) {
                    label.setAttribute('x', String(newX));
                    label.setAttribute('y', String(newY - 15));
                }
                
                // Update connected edges
                this.messagingHub.emit(Messages.POINT_DRAGGING, { point });
            };
            
            // Prevent click event from creating a new point during move
            const onClickCapture = (e: Event): void => {
                e.stopPropagation();
                e.preventDefault();
            };
            this.svg.addEventListener('click', onClickCapture, true);
            
            const onMouseUp = (): void => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Remove click blocker after a short delay
                setTimeout(() => {
                    this.svg.removeEventListener('click', onClickCapture, true);
                }, 10);
                
                pointElement.style.cursor = '';
                pointElement.classList.remove('dragging');
                
                // Remove guide line
                guideLine.remove();
                
                // Emit move completed
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
                if (!menu.contains(e.target as Node)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // Angle Edit Popover
    showAngleEditor = (data: AngleEditRequestData): void => {
        const svgRect = this.svg.getBoundingClientRect();
        const pos: Rect = {
            top: svgRect.top, 
            left: svgRect.left,
            width: svgRect.width,
            height: svgRect.height,
            x: svgRect.x,
            y: svgRect.y,
        };
        ShowAngleEditorPopover(data, pos, this.messagingHub);
    }

    // Load JSON Dialog
    showLoadDialog = (): void => {
        document.querySelectorAll('.load-dialog').forEach(el => el.remove());
        
        const dialog = createElement('div', { class: 'load-dialog' }) as HTMLElement;
        
        const textarea = createElement('textarea', {
            id: 'jsonInput',
            placeholder: 'Paste JSON data here...'
        }) as HTMLTextAreaElement;
        
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
        
        document.getElementById('loadConfirm')!.addEventListener('click', () => {
            try {
                const jsonString = textarea.value.trim();
                if (!jsonString) {
                    this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ No data provided');
                    return;
                }
                
                const data = JSON.parse(jsonString);
                this.messagingHub.emit(Messages.DATA_LOAD_REQUESTED, data);
                dialog.remove();
            } catch (err) {
                console.error('Failed to parse JSON:', err);
                this.messagingHub.emit(Messages.STATUS_UPDATED, '❌ Invalid JSON format');
                alert('Invalid JSON format. Please check your input.');
            }
        });
        
        document.getElementById('loadCancel')!.addEventListener('click', () => {
            dialog.remove();
            this.messagingHub.emit(Messages.STATUS_UPDATED, 'Load cancelled');
        });
        
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
                this.messagingHub.emit(Messages.STATUS_UPDATED, 'Load cancelled');
            }
        });
    }
}

