// DOM element creation helper utilities

/**
 * Create HTML or SVG element with attributes
 * @param {string} tagName - The element tag name (e.g., 'div', 'line', 'circle')
 * @param {Object} attributes - Object containing attributes to set on the element
 * @returns {Element} The created element
 */

export function createElement(tagName, attributes = {}, children = []) {
    // SVG elements that need createElementNS
    const svgElements = ['svg', 'line', 'circle', 'path', 'text', 'g', 'rect', 'polygon', 'polyline', 'ellipse', 'marker', 'defs'];

    let element;
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
                element.classList.add(...value.split(' ').filter(c => c));
            }
        } else {
            element.setAttribute(key, value);
        }
    }

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (Array.isArray(child)) {
            element.appendChild(createElement(...child));
        } else if (child && typeof child === 'object') {
            element.appendChild(child);
        }
    });
    
    return element;
}
