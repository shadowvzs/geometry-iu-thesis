import { extendLine } from './mathHelper.mjs';
import { createElement } from "./domHelper.mjs";

export const CREATOR_ONLY_CLASS = 'creator-only';
export const renderEdge = (point1, point2, classes = []) => {
    classes.push('line', 'edge');
    const group = createElement('g', {
        class: ['edge-container']
    });
    const extender = extendLine(point1, point2, 1920, 1080);
    const lineHelper = createElement('line', {
        class: [...classes, 'helper'],
        x1: extender.x1,
        y1: extender.y1,
        x2: extender.x2,
        y2: extender.y2
    });
    const line = createElement('line', {
        class: [...classes],
        x1: point1.x,
        y1: point1.y,
        x2: point2.x,
        y2: point2.y
    });
    lineHelper.setAttribute('data-edge-points', `${point1.id}-${point2.id}`);
    line.setAttribute('data-edge-points', `${point1.id}-${point2.id}`);
    group.appendChild(lineHelper);
    group.appendChild(line);

    return group;
}

export const renderCircle = ({ id, centerX, centerY, radius, centerPoint, hide }) => {
    const classes = ['circle-shape'];
    if (hide) classes.push(CREATOR_ONLY_CLASS);

    const circleElement = createElement('circle', {
        class: classes,
        cx: centerX,
        cy: centerY,
        r: radius
    });

    circleElement.setAttribute('data-center-point', centerPoint);
    circleElement.setAttribute('data-circle-id', id);

    return circleElement;
}

export const renderPointGroup = ({ id, hide, x, y}) => {
    const classes = ['point-group'];
    if (hide) classes.push(CREATOR_ONLY_CLASS);
    const group = createElement('g', {
        class: classes
    });

    const circle = createElement('circle', {
        class: 'point-circle',
        cx: x,
        cy: y,
        r: 8
    });
    
    const text = createElement('text', {
        class: 'point-label',
        x: x,
        y: y - 15
    }, [id]);

    group.setAttribute('data-pointId', id);
    circle.setAttribute('data-pointId', id);
    text.setAttribute('data-pointId', id);

    group.appendChild(circle);
    group.appendChild(text);

    return group;
}

const isPointElement = (htmlElement) => {
    const { tagName, classList } = htmlElement;
    return (
        (tagName === 'circle' && classList.contains('point-circle')) ||
        (tagName === 'g' && classList.contains('point-group'))
    );
};

const isAngleElement = (htmlElement) => {
    const { tagName, classList } = htmlElement;
    return (
        (tagName ==='path' && classList.contains('angle-arc')) ||
        (tagName ==='text' && classList.contains('angle-text')) ||
        (tagName ==='g' && classList.contains('angle-group'))
    );
}
export const getSvgElementData = (htmlElement) => {
    const { tagName, classList } = htmlElement;

    let elementName = '';
    let data = null;
    if (tagName === 'line' && classList.contains('edge')) {
        elementName = 'edge';
        data = htmlElement.getAttribute('data-edge-points').split('-');
    } else if (tagName === 'circle' && classList.contains('circle-shape')) {
        elementName = 'circle';
        data = htmlElement.getAttribute('data-circle-id');
    } else if (isPointElement(htmlElement)) {
        elementName = 'point';
        data = htmlElement.getAttribute('data-pointId');
    } else if (isAngleElement(htmlElement)) {
        elementName = 'angle';
        const elem = classList.contains('angle-group') ? htmlElement : htmlElement.closest('g.angle-group');
        data = elem.getAttribute('data-angle-id');    
    } else if (tagName === 'svg') {
        elementName = 'canvas';
    }

    return { elementName, data };
}
