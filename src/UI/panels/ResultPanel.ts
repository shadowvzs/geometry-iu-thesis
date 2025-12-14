import { Panel } from '../Panel';
import { MessagingHub } from '../../MessagingHub';
import { Angle } from '../../types';

interface NormalizedNumber {
    value: number;
    isInteger: boolean;
}

const normalizeNumber = (value: string | number): NormalizedNumber | null => {
    const floatValue = parseFloat(String(value));
    let parsedValue: number | null = isNaN(floatValue) ? null : floatValue;
    if (!parsedValue) { return null; }
    const isInteger = Number.isInteger(parsedValue);
    const normalizedValue = isInteger ? parsedValue : parseFloat(floatValue.toFixed(1));
    return {
        value: normalizedValue,
        isInteger
    };
}

export class ResultPanel extends Panel {
    private messagingHub: MessagingHub;
    private angle: Angle | null = null;
    private solvedAngle: Angle | null = null;
    private finalResultForElement!: HTMLElement;
    private inputElement!: HTMLInputElement;
    private submitButtonElement!: HTMLButtonElement;

    constructor(messagingHub: MessagingHub) {
        super(messagingHub);
        this.messagingHub = messagingHub;
    }

    initialize(): this {
        const { panel, maximizeBtn } = this.createPanel({
            id: 'resultPanel',
            panelClass: 'result-panel',
            headerTitle: '📚 Result',
            icon: '📚',
            content: [
                ['div', { class: 'result-content' }, [
                    ['div', { class: 'result-instructions' }, [
                        ['p', {}, ['Enter your calculated result for the angle below and click to "Verify" to check your answer.']],
                        ['p', {}, ['The number should have maximum 1 decimal digit (if have more then round to the closest)']]
                    ]],
                    ['div', { class: 'verify-result-section' }, [
                        ['div', { class: 'final-result-for' }, []],
                        ['input', {
                            type: 'number',
                            step: '0.1',
                            id: 'resultInput',
                            placeholder: 'Enter the result...',
                            class: 'result-input'
                        }],
                        ['div', {}, [
                            ['button', { id: 'verifyResultBtn', class: 'verify-result-btn' }, ['Verify']]
                        ]]
                    ]],
                ]]
            ]
        });

        document.querySelector('.container')?.appendChild(panel);
        document.querySelector('.container')?.appendChild(maximizeBtn);

        // Hide panel by default
        panel.classList.add('collapsed');
        const toggleBtn = panel.querySelector('.toggle-result-btn');
        if (toggleBtn) toggleBtn.textContent = '+';

        this.finalResultForElement = panel.querySelector('.final-result-for') as HTMLElement;
        this.inputElement = panel.querySelector('.result-input') as HTMLInputElement;
        this.submitButtonElement = panel.querySelector('.verify-result-btn') as HTMLButtonElement;
        this.setupToggleListeners('toggleResultPanel', 'maximizeResultBtn');

        this.submitButtonElement.onclick = this.verifyResult;

        return this;
    }

    verifyResult = (): void => {
        const { value } = this.inputElement;
        const given = normalizeNumber(value);
        const expected = this.solvedAngle?.value ? normalizeNumber(this.solvedAngle.value) : null;

        if (given === null) { 
            alert('Please enter a valid number');
            return;
        }
        if (expected === null) {
            alert('No expected value to compare against.');
            return;
        }

        if (given.value === expected.value) {
            alert('Correct! 🎉');
        } else {
            if (expected.isInteger) {
                if (Math.floor(given.value) === expected.value) {
                    alert('Almost correct! 😊');
                } else {
                    alert(`Incorrect.`);
                }
            } else {
                // if it is an float then we accept the lower and upper bound
                if (
                    Math.floor(expected.value) > given.value &&
                    Math.ceil(expected.value) < given.value
                ) {
                    alert('Almost correct! 😊');
                } else {
                    alert(`Incorrect.`);
                }            
            }
        }
    }

    /**
     * Update result panel with angle data
     */
    updatePanel = (angle: Angle, solvedAngle: Angle): void => {
        this.angle = angle;
        this.solvedAngle = solvedAngle;
        this.finalResultForElement.textContent = `${angle.name} = `;
    }
}

