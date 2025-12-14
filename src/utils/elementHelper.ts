import type { Point } from '../types';
import { extendLine } from './mathHelper';
import { createElement } from './domHelper';

export const CREATOR_ONLY_CLASS = 'creator-only';

export const renderEdge = (point1: Point, point2: Point, hide = false): HTMLElement => {
    const classes = ['line', 'edge'];
    const group = createElement('g', {
        class: hide ? ['edge-container', CREATOR_ONLY_CLASS] : ['edge-container']
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

    return group as HTMLElement;
};

interface RenderCircleParams {
    id: string;
    centerX: number;
    centerY: number;
    radius: number;
    centerPoint: string;
    hide?: boolean;
}

export const renderCircle = ({ id, centerX, centerY, radius, centerPoint, hide }: RenderCircleParams): HTMLElement => {
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

    return circleElement as HTMLElement;
};

interface RenderPointGroupParams {
    id: string;
    hide?: boolean;
    x: number;
    y: number;
}

export const renderPointGroup = ({ id, hide, x, y }: RenderPointGroupParams, mode: 'creator' | 'solver', scale: number = 1): HTMLElement => {
    const classes = ['point-group'];
    if (hide) classes.push(CREATOR_ONLY_CLASS);
    const group = createElement('g', {
        class: classes
    });

    const circle = createElement('circle', {
        class: 'point-circle',
        cx: x,
        cy: y,
        r: 8 * scale
    });
    
    const text = createElement('text', {
        class: 'point-label',
        x: x,
        y: y - 15
    }, [id]);

    group.setAttribute('data-pointId', id);
    circle.setAttribute('data-pointId', id);
    text.setAttribute('data-pointId', id);
    if (mode === 'solver') {
        text.style.display ='none';
    }

    group.appendChild(circle);
    group.appendChild(text);

    return group as HTMLElement;
};

const isPointElement = (htmlElement: Element): boolean => {
    const { tagName, classList } = htmlElement;
    return (
        (tagName === 'circle' && classList.contains('point-circle')) ||
        (tagName === 'g' && classList.contains('point-group'))
    );
};

const isAngleElement = (htmlElement: Element): boolean => {
    const { tagName, classList } = htmlElement;
    return (
        (tagName === 'path' && classList.contains('angle-arc')) ||
        (tagName === 'text' && classList.contains('angle-text')) ||
        (tagName === 'g' && classList.contains('angle-group'))
    );
};

interface SvgElementData {
    elementName: string;
    data: string | string[] | null;
}

export const getSvgElementData = (htmlElement: Element): SvgElementData => {
    const { tagName, classList } = htmlElement;

    let elementName = '';
    let data: string | string[] | null = null;
    if (tagName === 'line' && classList.contains('edge')) {
        elementName = 'edge';
        const edgePoints = htmlElement.getAttribute('data-edge-points');
        data = edgePoints ? edgePoints.split('-') : null;
    } else if (tagName === 'circle' && classList.contains('circle-shape')) {
        elementName = 'circle';
        data = htmlElement.getAttribute('data-circle-id');
    } else if (isPointElement(htmlElement)) {
        elementName = 'point';
        data = htmlElement.getAttribute('data-pointId');
    } else if (isAngleElement(htmlElement)) {
        elementName = 'angle';
        const elem = classList.contains('angle-group') ? htmlElement : htmlElement.closest('g.angle-group');
        data = elem ? elem.getAttribute('data-angle-id') : null;
    } else if (tagName === 'svg') {
        elementName = 'canvas';
    }

    return { elementName, data };
};
