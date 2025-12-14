import { ProblemScaleData, SerializedGeometryData } from "@/types";

export const makeResponsiveToScreenSize = (data: SerializedGeometryData): ProblemScaleData => {
    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    let paddingX = 50, paddingY = 20;
    if (windowWidth < 360) {
        paddingX = 24;
    } else if (windowWidth < 568) {
        paddingX = 32;
    } else if (windowWidth < 768) {
        paddingX = 48;
    }
   
    // getting the min and max x and y for the points
    data.points.forEach(point => {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
    });

    // the diagram/problem width and height with padding
    const width = maxX - minX + paddingX * 2;
    const height = maxY - minY + paddingY * 2;


    // in case the problem is enough small and it will fit in the screen
    if (
        windowWidth >= width &&
        windowHeight >= height &&
        maxX <= (windowWidth - paddingX)
        && minX >= paddingX
    ) {
        return {
            scale: 1,
            canvasWidth: windowWidth,
            canvasHeight: windowHeight
        };
    }

    // in case the width and height should be ok but
    // it is not centralized and it will go outside of the screen
    if (width < windowWidth && (maxX + paddingX) > windowWidth) {
        const diffX = minX - paddingX;
        const diffY = minY - paddingY;

        data.points.forEach(point => {
            point.x -= diffX;
            point.y -= diffY;
        });

        canvasContainer.style.minHeight = `${height}px`;
        return {
            scale: 1,
            canvasWidth: width,
            canvasHeight: height
        };
    }

    // Calculate scale factor (maintain aspect ratio)
    const scaleX = (windowWidth - paddingX * 2) / (maxX - minX);
    const scaleY = (windowHeight - paddingY * 2) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY, 1);

    // Apply scaling if needed
    if (scale < 1) {
        // Calculate center of the diagram
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Scale all points from center
        data.points.forEach(point => {
            point.x = centerX + (point.x - centerX) * scale;
            point.y = centerY + (point.y - centerY) * scale;
        });
        
        // Scale circle radii
        data.circles?.forEach(circle => {
            circle.r *= scale;
        });
        
        // Recalculate bounds after scaling
        minX = centerX + (minX - centerX) * scale;
        minY = centerY + (minY - centerY) * scale;
        maxX = centerX + (maxX - centerX) * scale;
        maxY = centerY + (maxY - centerY) * scale;
    }

    // Reposition to start at padding (applies after scaling or if just mispositioned)
    const needsRepositionX = minX < paddingX || maxX > (windowWidth - paddingX);
    const needsRepositionY = minY < paddingY || maxY > (windowHeight - paddingY);

    if (needsRepositionX || needsRepositionY) {
        const diffX = minX - paddingX;
        const diffY = minY - paddingY;

        data.points.forEach(point => {
            point.x -= diffX;
            point.y -= diffY;
        });
    }

    // Update canvas container height
    const finalHeight = (maxY - minY) + paddingY * 2;

    return {
        scale: scale,
        canvasWidth: windowWidth,
        canvasHeight: finalHeight
    };
}