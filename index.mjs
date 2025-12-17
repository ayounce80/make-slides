/**
 * make-slides - Convert React/Vite slide decks to PDF or editable PowerPoint
 * @module make-slides
 */

export { capturePDF } from './lib/capture.mjs';
export { captureEditablePptx } from './lib/editable-pptx.mjs';
export { detectConfig } from './lib/detect.mjs';
export { detectSlideCount, navigateToSlide } from './lib/navigation.mjs';
