// DOM element creation helper utilities
import type { ElementChild, SvgAttributes } from '../types';

/**
 * Create HTML or SVG element with attributes
 * @param tagName - The element tag name (e.g., 'div', 'line', 'circle')
 * @param attributes - Object containing attributes to set on the element
 * @param children - Child elements or strings to append
 * @returns The created element
 */
export function createElement(
    tagName: string,
    attributes: SvgAttributes = {},
    children: ElementChild[] = []
): HTMLElement | SVGElement {
    // SVG elements that need createElementNS
    const svgElements = ['svg', 'line', 'circle', 'path', 'text', 'g', 'rect', 'polygon', 'polyline', 'ellipse', 'marker', 'defs'];

    let element: HTMLElement | SVGElement;
    if (svgElements.includes(tagName.toLowerCase())) {
        element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    } else {
        element = document.createElement(tagName);
    }
    
    // Set attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'class' || key === 'className') {
            // Handle class specially
            if (Array.isArray(value)) {
                element.classList.add(...value);
            } else {
                element.classList.add(...String(value).split(' ').filter(c => c));
            }
        } else {
            element.setAttribute(key, String(value));
        }
    }

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (Array.isArray(child)) {
            element.appendChild(createElement(child[0], child[1], child[2]));
        } else if (child && typeof child === 'object') {
            element.appendChild(child);
        }
    });
    
    return element;
}

export const createSelect = (options: string[], attributes: SvgAttributes = {}): HTMLSelectElement => {
    const optionsElements: ElementChild[] = options.map(opt => ['option', { value: opt }, [opt]]);
    const select = createElement('select', attributes, optionsElements) as HTMLSelectElement;
    return select;
}

export const createSelectOptions = (options: string[], value: string): HTMLElement[] => {
    const optionsElements: HTMLElement[] = options.map(opt => {
        const attributes = { value: opt };
        if (opt === value) {
            Reflect.set(attributes, 'selected', true);
        }
        return createElement(
            'option',
            attributes,
            [opt]
        ) as HTMLElement;
    });
    return optionsElements;
};