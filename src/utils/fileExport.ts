const defaultName = 'Untitled-geometry-problem';

export const exportSvgAsSvg = (svgElement: HTMLElement, name: string) => {
    const svg = svgElement.outerHTML;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || defaultName}.svg`;
    a.click();
}

export const exportSvgAsPng = (svgElement: HTMLElement, name: string) => {
    svgToPng(svgElement, svgElement.clientWidth, svgElement.clientHeight, function(pngDataUrl) {
        const downloadLink = document.createElement('a');
        downloadLink.href = pngDataUrl;
        downloadLink.download = `${name || defaultName}.png`;
        downloadLink.click();
      });
}

function svgToPng(svgElement: HTMLElement, width: number, height: number, callback: (pngDataUrl: string) => void) {
    // Get SVG data
    const svgData = new XMLSerializer().serializeToString(svgElement);

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { return console.error('context not found'); }
  
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
  
    // Create image from SVG
    const img = new Image();
  
    img.onload = function() {
      // Clear canvas and draw image
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
  
      // Convert to PNG
      const pngDataUrl = canvas.toDataURL('image/png');
      URL.revokeObjectURL(url);
      callback(pngDataUrl);
    };
  
    // Create blob and object URL
    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8'
    });
  
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
    URL.revokeObjectURL(url);
  }