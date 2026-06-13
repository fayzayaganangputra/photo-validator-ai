import { PhotoCategory, ValidationRule, ValidationResult } from '../types';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { createWorker } from 'tesseract.js';

type BBox = [number, number, number, number];

interface ImageAnalysis {
  width: number;
  height: number;
  blurScore: number;
  brightness: number;
  contrast: number;
  mainBox: BBox | null;
  centerScore: number;
  cropped: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
}

interface OcrResult {
  text: string;
  confidence: number;
  words: any[];
}

let objectModelPromise: Promise<cocoSsd.ObjectDetection> | null = null;
let ocrWorkerPromise: Promise<any> | null = null;

function getObjectModel(): Promise<cocoSsd.ObjectDetection> {
  if (!objectModelPromise) {
    objectModelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
  }
  return objectModelPromise;
}

async function getOcrWorker(): Promise<any> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng');
  }
  return ocrWorkerPromise;
}

export async function analyzeImage(imageData: string): Promise<ImageAnalysis> {
  const image = await loadImage(imageData);
  const { canvas, ctx } = imageToCanvas(image, 1280);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const gray = toGray(data, canvas.width, canvas.height);
  const blurScore = calculateBlurScore(gray, canvas.width, canvas.height);
  const brightness = calculateBrightness(gray);
  const contrast = calculateContrast(gray);
  const mainBox = detectMainBox(gray, canvas.width, canvas.height);
  const centerScore = mainBox ? calculateCenteringScore(mainBox, canvas.width, canvas.height) : 0;
  const cropped = mainBox ? touchesEdge(mainBox, canvas.width, canvas.height, 0.035) : true;

  return {
    width: canvas.width,
    height: canvas.height,
    blurScore,
    brightness,
    contrast,
    mainBox,
    centerScore,
    cropped,
    canvas,
    ctx,
    image
  };
}

export async function validatePhoto(
  imageData: string,
  category: PhotoCategory
): Promise<ValidationResult> {
  const analysis = await analyzeImage(imageData);

  switch (category) {
    case 'person-product':
      return validatePersonProduct(analysis);
    case 'signboard':
      return validateSignboard(analysis);
    case 'serial-number':
      return validateSerialNumber(analysis);
    case 'bast-document':
      return validateBastDocument(analysis);
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

async function validatePersonProduct(analysis: ImageAnalysis): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];

  addRule(
    rules,
    'not-blurry',
    'Image Not Blurry',
    'Image must be sharp and clear',
    analysis.blurScore >= 35,
    Math.min(100, analysis.blurScore * 2.5),
    `Blur score: ${analysis.blurScore.toFixed(1)}. Minimum recommended: 35.`
  );

  addRule(
    rules,
    'main-object-detected',
    'Main Object Detected',
    'Main subject must be visible',
    !!analysis.mainBox,
    analysis.mainBox ? 90 : 20,
    analysis.mainBox ? 'Main visual area detected.' : 'Main subject area is not clear.'
  );

  addRule(
    rules,
    'object-centered',
    'Object Centered',
    'Product should be in center area',
    analysis.centerScore >= 70,
    analysis.centerScore,
    `Centering score: ${analysis.centerScore}/100.`
  );

  addRule(
    rules,
    'object-not-cropped',
    'Product Fully Visible',
    'Product must not be cropped at the edge',
    !analysis.cropped,
    analysis.cropped ? 45 : 95,
    analysis.cropped ? 'Object is too close to image border.' : 'Object does not touch image border.'
  );

  try {
    const detections = await detectObjectsFromCanvas(analysis.canvas);
    const persons = detections.filter((d: any) => d.class === 'person' && d.score >= 0.45);
    const products = detections.filter((d: any) => d.class !== 'person' && d.score >= 0.35);

    addRule(
      rules,
      'person-detected',
      'Person Detected',
      'Person must be visible in image',
      persons.length > 0,
      persons.length > 0 ? 100 : 30,
      persons.length > 0 ? `${persons.length} person(s) detected.` : 'No person detected by AI model.'
    );

    addRule(
      rules,
      'product-detected',
      'Product/Object Detected',
      'Product or object must be visible',
      products.length > 0,
      products.length > 0 ? 90 : 35,
      products.length > 0
        ? `Object detected: ${products.slice(0, 3).map((p: any) => p.class).join(', ')}.`
        : 'No non-person object detected.'
    );

    if (persons.length > 0 && products.length > 0) {
      const productBox = largestDetectionBox(products.map((p: any) => p.bbox as BBox));
      const maxOverlap = Math.max(...persons.map((p: any) => overlapPercent(productBox, p.bbox as BBox)));

      addRule(
        rules,
        'product-not-covered',
        'Product Not Covered by Person',
        'Person must not cover the product',
        maxOverlap <= 25,
        Math.max(0, 100 - maxOverlap * 3),
        `Estimated person-product overlap: ${maxOverlap.toFixed(1)}%. Maximum allowed: 25%.`
      );

      const aiCenterScore = bboxCenterScore(productBox, analysis.width, analysis.height);

      addRule(
        rules,
        'product-center-ai',
        'Product Center by AI Box',
        'Product bounding box should be centered',
        aiCenterScore >= 70,
        aiCenterScore,
        `AI product center score: ${aiCenterScore}/100.`
      );

      const aiEdge = touchesEdge(productBox, analysis.width, analysis.height, 0.025);

      addRule(
        rules,
        'product-not-edge-ai',
        'AI Product Box Not Cropped',
        'Product box must not touch frame edge',
        !aiEdge,
        aiEdge ? 45 : 95,
        'AI bounding box edge check completed.'
      );
    }
  } catch (error) {
    addRule(
      rules,
      'ai-object-detection',
      'AI Object Detection',
      'TensorFlow.js model should load and detect objects',
      false,
      30,
      'AI model failed to load. Open once with internet so the PWA can cache the model.'
    );
  }

  return buildResult(rules, 'person-product');
}

async function validateSignboard(analysis: ImageAnalysis): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];

  const ocr = await runOcrSafe(analysis.canvas);
  const cleaned = cleanText(ocr.text);

  const textReadable = ocr.confidence >= 35 && cleaned.length >= 5;

  const blurPass = textReadable
    ? analysis.blurScore >= 25
    : analysis.blurScore >= 35;

  addRule(
    rules,
    'not-blurry',
    'Image Blur Tolerance',
    'Blur is tolerated as long as signboard text is readable',
    blurPass,
    Math.min(100, analysis.blurScore * 2.5),
    textReadable
      ? `Blur score: ${analysis.blurScore.toFixed(1)}. Text readable, so light blur is tolerated.`
      : `Blur score: ${analysis.blurScore.toFixed(1)}. Text not readable, minimum blur score required: 35.`
  );

  addRule(
    rules,
    'signboard-centered',
    'Signboard Centered',
    'Signboard should be centered',
    analysis.centerScore >= 72,
    analysis.centerScore,
    `Centering score: ${analysis.centerScore}/100.`
  );

  addRule(
    rules,
    'signboard-not-cropped',
    'Signboard Not Cropped',
    'Signboard must not touch image border',
    !analysis.cropped,
    analysis.cropped ? 45 : 95,
    analysis.cropped ? 'Main object too close to border.' : 'Main object has safe margin.'
  );

  addRule(
    rules,
    'signboard-text-readable',
    'Signboard Text Readable',
    'Text on signboard must be readable',
    textReadable,
    Math.min(100, Math.max(0, ocr.confidence)),
    `OCR confidence: ${ocr.confidence.toFixed(1)}. Text: "${truncate(cleaned, 80)}".`
  );

  addRule(
    rules,
    'brightness-ok',
    'Lighting OK',
    'Photo should not be too dark or too bright',
    analysis.brightness >= 35 && analysis.brightness <= 225,
    lightingScore(analysis.brightness),
    `Brightness: ${analysis.brightness.toFixed(1)}.`
  );

  return buildResult(rules, 'signboard');
}

async function validateSerialNumber(analysis: ImageAnalysis): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];

  const ocr = await runOcrSafe(analysis.canvas);
  const cleaned = cleanText(ocr.text);

  const ocrReadable = ocr.confidence >= 40 && cleaned.length >= 4;

  const blurPass = ocrReadable
    ? analysis.blurScore >= 25
    : analysis.blurScore >= 45;

  addRule(
    rules,
    'not-blurry',
    'Image Blur Tolerance',
    'Blur is tolerated as long as the serial number text is readable',
    blurPass,
    Math.min(100, analysis.blurScore * 2.2),
    ocrReadable
      ? `Blur score: ${analysis.blurScore.toFixed(1)}. OCR readable, so light blur is tolerated.`
      : `Blur score: ${analysis.blurScore.toFixed(1)}. OCR not readable, minimum blur score required: 45.`
  );

  addRule(
    rules,
    'text-centered',
    'Text Centered',
    'Serial number area should be centered',
    analysis.centerScore >= 72,
    analysis.centerScore,
    `Centering score: ${analysis.centerScore}/100.`
  );

  addRule(
    rules,
    'text-not-cropped',
    'Text Not Cropped',
    'Serial number must not be cut off',
    !analysis.cropped,
    analysis.cropped ? 45 : 95,
    analysis.cropped ? 'Main text/object too close to border.' : 'Main region has safe margin.'
  );

  addRule(
    rules,
    'ocr-readable',
    'Text Readable by OCR',
    'Serial number text must be readable',
    ocrReadable,
    Math.min(100, Math.max(0, ocr.confidence)),
    `OCR confidence: ${ocr.confidence.toFixed(1)}. Text: "${truncate(cleaned, 60)}".`
  );

  addRule(
    rules,
    'text-contrast',
    'Text Contrast OK',
    'Text should have enough contrast',
    analysis.contrast >= 22,
    Math.min(100, analysis.contrast * 3),
    `Contrast score: ${analysis.contrast.toFixed(1)}.`
  );

  return buildResult(rules, 'serial-number');
}

async function validateBastDocument(analysis: ImageAnalysis): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];

  const ocr = await runOcrSafe(analysis.canvas);
  const cleaned = cleanText(ocr.text);

  const textReadable = ocr.confidence >= 38 && cleaned.length >= 15;

  const blurPass = textReadable
    ? analysis.blurScore >= 25
    : analysis.blurScore >= 42;

  addRule(
    rules,
    'document-centered',
    'Document Centered',
    'BAST document should be centered',
    analysis.centerScore >= 70,
    analysis.centerScore,
    `Centering score: ${analysis.centerScore}/100.`
  );

  addRule(
    rules,
    'document-not-cropped',
    'Document Not Cropped',
    'Document must not be cut off',
    !analysis.cropped,
    analysis.cropped ? 45 : 95,
    analysis.cropped ? 'Document/main region too close to border.' : 'Document/main region has safe margin.'
  );

  addRule(
    rules,
    'not-blurry',
    'Image Blur Tolerance',
    'Blur is tolerated as long as BAST text is readable',
    blurPass,
    Math.min(100, analysis.blurScore * 2.2),
    textReadable
      ? `Blur score: ${analysis.blurScore.toFixed(1)}. OCR readable, so light blur is tolerated.`
      : `Blur score: ${analysis.blurScore.toFixed(1)}. OCR not readable, minimum blur score required: 42.`
  );

  addRule(
    rules,
    'text-readable',
    'Text Readable',
    'BAST text must be readable',
    textReadable,
    Math.min(100, Math.max(0, ocr.confidence)),
    `OCR confidence: ${ocr.confidence.toFixed(1)}. Text preview: "${truncate(cleaned, 80)}".`
  );

  const stampOverlap = estimateStampOverlapWithText(analysis.canvas, ocr.words);

  addRule(
    rules,
    'stamp-coverage',
    'Stamp Coverage Max 20%',
    'Stamp may cover maximum 20% of text area',
    stampOverlap <= 20,
    Math.max(0, 100 - stampOverlap * 3),
    `Estimated stamp/text overlap: ${stampOverlap.toFixed(1)}%. Maximum allowed: 20%.`
  );

  return buildResult(rules, 'bast-document');
}

async function detectObjectsFromCanvas(canvas: HTMLCanvasElement): Promise<any[]> {
  const model = await getObjectModel();
  return model.detect(canvas as any);
}

async function runOcrSafe(canvas: HTMLCanvasElement): Promise<OcrResult> {
  try {
    const worker = await getOcrWorker();
    const result = await worker.recognize(canvas);

    return {
      text: result.data?.text || '',
      confidence: Number(result.data?.confidence || 0),
      words: (result.data as any)?.words || []
    };
  } catch (error) {
    return { text: '', confidence: 0, words: [] };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function imageToCanvas(img: HTMLImageElement, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return { canvas, ctx };
}

function toGray(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2]
    );
  }

  return gray;
}

function calculateBlurScore(gray: Uint8ClampedArray, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;

      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - width] +
        gray[i + width];

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  return Math.min(100, Math.max(0, variance / 15));
}

function calculateBrightness(gray: Uint8ClampedArray): number {
  let sum = 0;

  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
  }

  return sum / gray.length;
}

function calculateContrast(gray: Uint8ClampedArray): number {
  const mean = calculateBrightness(gray);
  let variance = 0;

  for (let i = 0; i < gray.length; i++) {
    variance += Math.pow(gray[i] - mean, 2);
  }

  return (Math.sqrt(variance / gray.length) / 128) * 100;
}

function detectMainBox(gray: Uint8ClampedArray, width: number, height: number): BBox | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const i = y * width + x;

      const edge =
        Math.abs(gray[i + 1] - gray[i - 1]) +
        Math.abs(gray[i + width] - gray[i - width]);

      if (edge > 58) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count++;
      }
    }
  }

  if (count < (width * height) / 4500) return null;

  return [minX, minY, maxX - minX, maxY - minY];
}

function touchesEdge(box: BBox, width: number, height: number, marginRatio: number): boolean {
  const [x, y, w, h] = box;
  const mx = width * marginRatio;
  const my = height * marginRatio;

  return (
    x <= mx ||
    y <= my ||
    x + w >= width - mx ||
    y + h >= height - my
  );
}

function calculateCenteringScore(box: BBox, width: number, height: number): number {
  return bboxCenterScore(box, width, height);
}

function bboxCenterScore(box: BBox, width: number, height: number): number {
  const [x, y, w, h] = box;

  const cx = x + w / 2;
  const cy = y + h / 2;

  const dx = Math.abs(cx - width / 2) / (width / 2);
  const dy = Math.abs(cy - height / 2) / (height / 2);

  const distance = Math.sqrt(dx * dx + dy * dy) / Math.sqrt(2);

  return Math.round(Math.max(0, 100 - distance * 100));
}

function largestDetectionBox(boxes: BBox[]): BBox {
  return [...boxes].sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
}

function overlapPercent(a: BBox, b: BBox): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;

  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);

  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = aw * ah;

  return areaA ? (inter / areaA) * 100 : 0;
}

function estimateStampOverlapWithText(canvas: HTMLCanvasElement, words: any[]): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  const validWords = (words || []).filter(
    (word: any) => (word.confidence ?? 0) > 25 && word.bbox
  );

  if (!validWords.length) return 35;

  let textPixels = 0;
  let stampLikePixels = 0;

  for (const word of validWords) {
    const bbox = word.bbox as any;

    const left = Number(bbox.x0 ?? bbox.left ?? 0);
    const top = Number(bbox.y0 ?? bbox.top ?? 0);

    const right = Number(
      bbox.x1 ??
      bbox.right ??
      ((bbox.left ?? bbox.x0 ?? 0) + (bbox.width ?? 0))
    );

    const bottom = Number(
      bbox.y1 ??
      bbox.bottom ??
      ((bbox.top ?? bbox.y0 ?? 0) + (bbox.height ?? 0))
    );

    const x0 = Math.max(0, Math.floor(left));
    const y0 = Math.max(0, Math.floor(top));
    const x1 = Math.min(canvas.width, Math.ceil(right));
    const y1 = Math.min(canvas.height, Math.ceil(bottom));

    if (x1 <= x0 || y1 <= y0) continue;

    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const idx = (y * canvas.width + x) * 4;

        const r = data[idx] ?? 0;
        const g = data[idx + 1] ?? 0;
        const b = data[idx + 2] ?? 0;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;

        const isRedBlueStamp =
          saturation > 45 &&
          (r > 120 || b > 120) &&
          !(r > 230 && g > 230 && b > 230);

        const isDarkOverlay =
          max < 110 &&
          saturation > 20;

        textPixels++;

        if (isRedBlueStamp || isDarkOverlay) {
          stampLikePixels++;
        }
      }
    }
  }

  if (!textPixels) return 35;

  return Math.min(100, (stampLikePixels / textPixels) * 100);
}

function lightingScore(brightness: number): number {
  if (brightness < 35) return 40;
  if (brightness > 225) return 45;
  return 90;
}

function cleanText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, len: number): string {
  return text.length > len ? `${text.slice(0, len)}...` : text;
}

function addRule(
  rules: ValidationRule[],
  id: string,
  name: string,
  description: string,
  passed: boolean,
  score: number,
  details?: string
) {
  rules.push({
    id,
    name,
    description,
    passed,
    score: Math.round(Math.max(0, Math.min(100, score))),
    details
  });
}

// function buildResult(rules: ValidationRule[], category: PhotoCategory): ValidationResult {
//   const totalScore = rules.reduce((sum, r) => sum + r.score, 0) / rules.length;

//   return {
//     overallScore: Math.round(totalScore),
//     passed: rules.every((r) => r.passed),
//     rules,
//     timestamp: new Date(),
//     category
//   };
// }

function buildResult(rules: ValidationRule[], category: PhotoCategory): ValidationResult {
  const totalScore = rules.reduce((sum, r) => sum + r.score, 0) / rules.length;
  const overallScore = Math.round(totalScore);

  const requiredRuleIds: Record<PhotoCategory, string[]> = {
    'person-product': [
      'person-detected',
      'product-detected',
      'product-not-covered'
    ],

    'signboard': [
      'signboard-text-readable',
      'signboard-centered'
    ],

    'serial-number': [
      'ocr-readable',
      'text-centered'
    ],

    'bast-document': [
      'text-readable',
      'document-centered',
      'document-not-cropped',
      'stamp-coverage'
    ]
  };

  const requiredPassed = requiredRuleIds[category].every((id) => {
    const rule = rules.find((r) => r.id === id);
    return rule ? rule.passed : false;
  });

  return {
    overallScore,
    passed: requiredPassed && overallScore >= 70,
    rules,
    timestamp: new Date(),
    category
  };
}