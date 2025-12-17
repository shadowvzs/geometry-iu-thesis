import { createElement, createSelect } from "@/utils/domHelper";
import type { Angle, AngleEditRequestData, Rect } from "@/types";
import { Messages, MessagingHub } from "@/MessagingHub";


const createPopoverContent = ({ left, top }: Pick<Rect, 'left' | 'top'>) => {
    
    const container = createElement('div', { class: 'angle-editor-container' }) as HTMLElement;
    container.style.left = left + 'px';
    container.style.top = top + 'px';
    
    // Create input fields
    const nameField = createElement('input', {
        type: 'text',
        id: 'angleNameInput',
        placeholder: 'Angle name'
    }) as HTMLInputElement;
      
    const labelField = createElement('input', {
        type: 'text',
        id: 'angleLabelInput',
        placeholder: 'Greek letter label'
    }) as HTMLInputElement;
  
    const valueField = createElement('input', {
        type: 'text',
        id: 'angleValueInput',
        style: 'flex: 1;'
    }) as HTMLInputElement;
    
    const checkboxElement = createElement('input', {
        type: 'checkbox',
        title: 'Select as target angle'
    }) as HTMLInputElement;
    const targetAngle = createElement('label', { class: 'target-angle-label' }, [
        checkboxElement,
        ' Target'
    ]);
    
    // Create value row container with flex
    const valueRow = createElement('div', {
        style: 'display: flex; flex-direction: row; gap: 32px; align-items: center;'
    }, [valueField, targetAngle]);
    
    const radiusField = createElement('input', {
        type: 'number',
        id: 'angleRadiusInput',
        min: '10',
        max: '100',
        step: '5'
    }) as HTMLInputElement;

    // Greek letters
    const greekLetters = [
        { letter: 'α', name: 'alpha' },
        { letter: 'β', name: 'beta' },
        { letter: 'γ', name: 'gamma' },
        { letter: 'δ', name: 'delta' },
        { letter: 'ε', name: 'epsilon' },
        { letter: 'ζ', name: 'zeta' },
        { letter: 'η', name: 'eta' },
        { letter: 'θ', name: 'theta' },
        { letter: 'ι', name: 'iota' },
        { letter: 'κ', name: 'kappa' },
        { letter: 'λ', name: 'lambda' },
        { letter: 'μ', name: 'mu' },
        { letter: 'ν', name: 'nu' },
        { letter: 'ξ', name: 'xi' },
        { letter: 'ο', name: 'omicron' },
        { letter: 'π', name: 'pi' },
        { letter: 'ρ', name: 'rho' },
        { letter: 'σ', name: 'sigma' },
        { letter: 'τ', name: 'tau' },
        { letter: 'υ', name: 'upsilon' },
        { letter: 'φ', name: 'phi' },
        { letter: 'χ', name: 'chi' },
        { letter: 'ψ', name: 'psi' },
        { letter: 'ω', name: 'omega' }
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
    const selectField = createSelect([], { id: 'angleSelect' });
    container.appendChild(createElement('div', { class: 'angle-input-header' }, [
        'Edit Angle',
        selectField
    ]));
    container.appendChild(createElement('label', {}, ['Name:', nameField]));
    container.appendChild(createElement('label', {}, ['Label (Greek letter):', labelField]));
    container.appendChild(greekContainer);
    container.appendChild(createElement('label', {}, ['Value (degrees):', valueRow]));
    container.appendChild(createElement('label', {}, ['Radius (px):', radiusField]));
    const closeAngleBtn = createElement('button', { id: 'closeAngle' }, ['Close']);
    const deleteAngleBtn = createElement('button', { id: 'deleteAngle', style: 'background-color: #dc3545;' }, ['Delete']);
    container.appendChild(createElement('div', { class: 'angle-input-buttons' }, [
        closeAngleBtn,
        deleteAngleBtn
    ]));
    
    return {
        container,
        nameField,
        labelField,
        valueField,
        radiusField,
        selectField,
        checkboxElement,
        greekContainer,
        closeAngleBtn,
        deleteAngleBtn,
    };
}

type AngleEditorElements = ReturnType<typeof createPopoverContent>;

export const updateAngleEditor = ({
    nameField,
    labelField,
    valueField,
    radiusField,
    selectField,
    checkboxElement,
}: AngleEditorElements, angle: Angle) => {
    radiusField.value = String(angle.radius || 30);
    nameField.value = angle.name || '';
    labelField.value = angle.label || '';
    valueField.value = angle.value?.toString() || '';
    valueField.placeholder = `${angle.calculatedValue?.toFixed(1)}°`;

    // Update select options
    [...selectField.options].forEach(opt => {
        if (opt.value === angle.name) {
            opt.selected = true;
        }
    });

    checkboxElement.checked = angle.target || false;
}

let currentAngle: Angle;
export const ShowAngleEditorPopover = ({ angle, angles = [angle] }: AngleEditRequestData, { left, top }: Rect, messagingHub: MessagingHub): void => {
    if (currentAngle && currentAngle.groupElement) {
        currentAngle.groupElement.classList.remove('selected');
    }

    // clean up the UI: remove any existing input dialogs
    document.querySelectorAll('.angle-editor-container').forEach(el => el.remove());

    // preparation: get the position to show the dialog
    const textElement = angle.groupElement?.querySelector('text');
    const textX = textElement ? parseFloat(textElement.getAttribute('x') || '100') : 100;
    const textY = textElement ? parseFloat(textElement.getAttribute('y') || '100') : 100;
    
    // create and setup the ui (with temporary position)
    const elements = createPopoverContent({ left: 0, top: 0 });
    
    // Mount temporarily hidden to get dimensions
    elements.container.style.visibility = 'hidden';
    document.body.appendChild(elements.container);
    
    const popoverRect = elements.container.getBoundingClientRect();
    const popoverHeight = popoverRect.height;
    const popoverWidth = popoverRect.width;
    
    // Calculate position with bounds checking
    let finalLeft = left + textX;
    let finalTop = top + textY;
    
    const padding = 10;
    
    // Check right edge
    if (finalLeft + popoverWidth > window.innerWidth) {
        finalLeft = window.innerWidth - popoverWidth - padding;
    }
    
    // Check left edge
    if (finalLeft < padding) {
        finalLeft = padding;
    }
    
    // Check bottom edge
    if (finalTop + popoverHeight > window.innerHeight) {
        finalTop = window.innerHeight - popoverHeight - padding;
    }
    
    // Check top edge
    if (finalTop < padding) {
        finalTop = padding;
    }
    
    // Apply corrected position and show
    elements.container.style.left = finalLeft + 'px';
    elements.container.style.top = finalTop + 'px';
    elements.container.style.visibility = 'visible';
    angles.forEach(ang => {
        elements.selectField.appendChild(createElement('option', { value: ang.name }, [ang.name]));
    });

    // allow user to change the current angle
    const setAngle = (ang: Angle) => {
        if (currentAngle && currentAngle.groupElement) {
            currentAngle.groupElement.classList.remove('selected');
        }
        currentAngle = ang;
        ang.groupElement?.classList.add('selected');
        updateAngleEditor(elements, currentAngle);
    };
    
    elements.selectField.onchange = (ev: Event) => {
        const target = ev.target as HTMLSelectElement;
        const selectedName = target.value;
        const selectedAngle = angles.find(ang => ang.name === selectedName);
        if (selectedAngle) {
            setAngle(selectedAngle);
        }
    }

    // Question mark button handler
    elements.checkboxElement.addEventListener('input', () => {
        currentAngle.target = elements.checkboxElement.checked;
        currentAngle.groupElement?.classList.toggle('target-angle');
        autoSave();
    });
    
    // Auto-save function
    const autoSave = (): void => {
        const inputValue = parseFloat(elements.valueField.value.trim()); 
        const name = elements.nameField.value;
        const label = elements.labelField.value;
        const value = isNaN(inputValue) ? null : inputValue;
        const radius = parseFloat(elements.radiusField.value);
        
        messagingHub.emit(Messages.ANGLE_UPDATED, {
            angle: currentAngle,
            name,
            label,
            value,
            radius
        });
    };
    
    // Event delegation for Greek letter buttons
    elements.greekContainer.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.greek-letter-btn') as HTMLButtonElement;
        if (btn) {
            e.preventDefault();
            const letter = btn.dataset.letter;
            if (letter) {
                elements.labelField.value = letter;
                autoSave();
                elements.labelField.focus();
            }
        }
    });
    
    // Auto-save on input change
    elements.nameField.addEventListener('input', autoSave);
    elements.labelField.addEventListener('input', autoSave);
    elements.valueField.addEventListener('input', autoSave);
    elements.radiusField.addEventListener('input', autoSave);
    
    elements.valueField.focus();
    elements.valueField.select();
    
    elements.deleteAngleBtn.addEventListener('click', () => {
        messagingHub.emit(Messages.ANGLE_DELETE_REQUESTED, currentAngle);
        elements.container.remove();
    });
    
    elements.valueField.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.container.remove();
        }
    });

    const onClose = () => {
        document.querySelectorAll('.angle-editor-container').forEach(el => el.remove());
        elements.container.remove();
        if (currentAngle && currentAngle.groupElement) {
            currentAngle.groupElement.classList.remove('selected');
        }
    }

    elements.closeAngleBtn.addEventListener('click', onClose);

    // // Close on outside click
    // setTimeout(() => {
    //     document.addEventListener('click', function closeInput(e) {
    //         if (!elements.container.contains(e.target as Node)) {
    //             onClose();
    //             document.removeEventListener('click', closeInput);
    //         }
    //     });
    // }, 100);

    // Container already mounted during bounds calculation
    setAngle(angle);
}