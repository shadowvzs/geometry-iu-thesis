import { Panel } from '../Panel.mjs';

const normalizeNumber = (value) => {
    const floatValue = parseFloat(value);
    let parsedValue = isNaN(floatValue) ? null : floatValue;
    if (!parsedValue) { return null; }
    const isInteger = Number.isInteger(parsedValue);
    const normalizedValue = isInteger ? parsedValue : parseFloat(floatValue.toFixed(1));
    return {
        value: normalizedValue,
        isInteger
    };
}

export class ResultPanel extends Panel {
    constructor(messagingHub) {
        super(messagingHub);
        this.messagingHub = messagingHub;
        this.angle = null;
        this.solvedAngle = null;
    }

    initialize() {
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

        document.querySelector('.container').appendChild(panel);
        document.querySelector('.container').appendChild(maximizeBtn);

        this.finalResultForElement = panel.querySelector('.final-result-for');
        this.inputElement = panel.querySelector('.result-input');
        this.submitButtonElement = panel.querySelector('.verify-result-btn');
        this.setupToggleListeners('toggleDefinitionsPanel', 'maximizeDefinitionsBtn');

        this.submitButtonElement.onclick = this.verifyResult;


        return this;
    }

    verifyResult = () => {
        const { value } = this.inputElement;
        const given = normalizeNumber(value);
        const expected = normalizeNumber(this.solvedAngle.value);

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
     * Update definitions panel with definitions data
     * @param {Array} definitions - Array of definitions
     */
    updatePanel = (angle, solvedAngle) => {
        this.angle = angle;
        this.solvedAngle = solvedAngle;
        this.finalResultForElement.textContent = `${angle.name} = `;
    }
}
