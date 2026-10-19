import {
  PhotoCategory,
  ValidationRule,
  ValidationResult
} from '../types';

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

interface OcrWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

interface OcrResult {
  text: string;
  confidence: number;
  words: OcrWord[];
  failed: boolean;
}

interface SerialRegion {
  text: string;
  box: BBox;
  confidence: number;
  source: 'label' | 'candidate';
}

interface SharpnessAssessment {
  passed: boolean;
  details: string;
}

// Ambang awal untuk diuji menggunakan foto lapangan.
// Skor ketajaman merupakan heuristik, bukan ukuran blur universal.
const SETTINGS = {
  signboard: {
    sharpnessPreferred: 25,
    sharpnessMinimum: 8,
    ocrMinimum: 22,
    ocrStrong: 45,
    minimumTextLength: 3
  },

  serial: {
    sharpnessPreferred: 30,
    sharpnessMinimum: 12,
    ocrMinimum: 22,
    ocrStrong: 45,
    edgeMarginRatio: 0.003
  },

  document: {
    sharpnessPreferred: 25,
    sharpnessMinimum: 10,
    ocrMinimum: 20,
    ocrStrong: 45,
    minimumTextLength: 8
  },

  personProduct: {
    sharpnessMinimum: 15,
    personConfidence: 0.45,
    productConfidence: 0.35,
    maximumOverlap: 25
  }
};

// Hanya aturan berikut yang menentukan hasil akhir.
// Aturan lain merupakan informasi/saran dan tidak masuk overallScore.
const REQUIRED_RULES: Record<PhotoCategory, string[]> = {
  'person-product': [
    'not-blurry',
    'person-detected',
    'product-detected'
  ],

  'signboard': [
    'not-blurry',
    'signboard-text-readable'
  ],

  'serial-number': [
    'not-blurry',
    'ocr-readable',
    'text-not-cropped'
  ],

  'bast-document': [
    'not-blurry',
    'text-readable'
  ]
};

let objectModelPromise:
  Promise<cocoSsd.ObjectDetection> | null = null;

let ocrWorkerPromise: Promise<any> | null = null;
let ocrQueue: Promise<void> = Promise.resolve();

function getObjectModel(): Promise<cocoSsd.ObjectDetection> {
  if (!objectModelPromise) {
    objectModelPromise = cocoSsd
      .load({ base: 'lite_mobilenet_v2' })
      .catch((error) => {
        objectModelPromise = null;
        throw error;
      });
  }

  return objectModelPromise;
}

function getOcrWorker(): Promise<any> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng').catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }

  return ocrWorkerPromise;
}

export async function analyzeImage(
  imageData: string
): Promise<ImageAnalysis> {
  const image = await loadImage(imageData);

  // Tidak memperbesar foto kecil.
  // Batas ini mempertahankan lebih banyak detail teks dibanding 1280.
  const { canvas, ctx } = imageToCanvas(image, 1600);

  const pixels = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const gray = toGray(
    pixels.data,
    canvas.width,
    canvas.height
  );

  const blurScore = calculateBlurScore(
    gray,
    canvas.width,
    canvas.height
  );

  const brightness = calculateBrightness(gray);
  const contrast = calculateContrast(gray);

  const mainBox = detectMainBox(
    gray,
    canvas.width,
    canvas.height
  );

  const centerScore = mainBox
    ? bboxCenterScore(mainBox, canvas.width, canvas.height)
    : 0;

  const cropped = mainBox
    ? touchesEdge(mainBox, canvas.width, canvas.height, 0.015)
    : false;

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

async function validatePersonProduct(
  analysis: ImageAnalysis
): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];

  addRule(
    rules,
    'not-blurry',
    'Ketajaman Foto',
    'Foto harus cukup tajam untuk melihat orang dan produk.',
    analysis.blurScore >= SETTINGS.personProduct.sharpnessMinimum,
    sharpnessScore(
      analysis.blurScore,
      SETTINGS.personProduct.sharpnessMinimum
    ),
    `Skor ketajaman: ${analysis.blurScore.toFixed(1)}. Minimum: ${
      SETTINGS.personProduct.sharpnessMinimum
    }.`
  );

  addAdvisory(
    rules,
    'object-centered',
    'Saran Posisi Produk',
    'Usahakan produk terlihat jelas. Posisi tidak harus tepat di tengah.',
    analysis.centerScore >= 60,
    analysis.centerScore,
    `Skor posisi area visual: ${analysis.centerScore}/100.`
  );

  addAdvisory(
    rules,
    'object-not-cropped',
    'Saran Jarak dari Tepi',
    'Pastikan bagian penting produk terlihat.',
    !!analysis.mainBox && !analysis.cropped,
    analysis.mainBox ? (analysis.cropped ? 45 : 95) : 20,
    !analysis.mainBox
      ? 'Area visual belum dapat dipastikan.'
      : analysis.cropped
        ? 'Ada area visual dekat tepi foto. Periksa keutuhan produk.'
        : 'Area visual memiliki jarak dari tepi foto.'
  );

  try {
    const model = await getObjectModel();
    const detections = await model.detect(analysis.canvas);

    const persons = detections.filter(
      (item) =>
        item.class === 'person' &&
        item.score >= SETTINGS.personProduct.personConfidence
    );

    const products = detections.filter(
      (item) =>
        item.class !== 'person' &&
        item.score >= SETTINGS.personProduct.productConfidence
    );

    addRule(
      rules,
      'person-detected',
      'Orang Terdeteksi',
      'Orang harus terlihat dalam foto.',
      persons.length > 0,
      persons.length > 0 ? 95 : 20,
      persons.length > 0
        ? `${persons.length} orang terdeteksi.`
        : 'AI belum mengenali orang. Pastikan orang terlihat cukup besar dan jelas.'
    );

    addRule(
      rules,
      'product-detected',
      'Produk/Objek Terdeteksi',
      'Produk atau objek harus terlihat dalam foto.',
      products.length > 0,
      products.length > 0 ? 90 : 20,
      products.length > 0
        ? `Objek terdeteksi: ${products
            .slice(0, 3)
            .map((item) => item.class)
            .join(', ')}.`
        : 'AI belum mengenali objek selain orang. Foto perlu diperiksa; model hanya mengenali kategori objek tertentu.'
    );

    if (products.length > 0) {
      const productBox = largestDetectionBox(
        products.map((item) => item.bbox as BBox)
      );

      const productCenter = bboxCenterScore(
        productBox,
        analysis.width,
        analysis.height
      );

      addAdvisory(
        rules,
        'product-center-ai',
        'Saran Posisi Produk (AI)',
        'Produk sebaiknya mudah dilihat.',
        productCenter >= 60,
        productCenter,
        `Skor posisi produk: ${productCenter}/100.`
      );

      if (persons.length > 0) {
        const maximumOverlap = Math.max(
          ...persons.map((person) =>
            overlapPercent(
              productBox,
              person.bbox as BBox
            )
          )
        );

        addAdvisory(
          rules,
          'product-not-covered',
          'Perkiraan Produk Tertutup Orang',
          'Periksa apakah bagian penting produk tertutup.',
          maximumOverlap <=
            SETTINGS.personProduct.maximumOverlap,
          Math.max(0, 100 - maximumOverlap),
          `Tumpang tindih kotak deteksi: ${maximumOverlap.toFixed(
            1
          )}%. Ini bukan pengukuran pasti bagian produk yang tertutup.`
        );
      }
    }
  } catch (error) {
    console.error('Deteksi objek gagal:', error);

    addRule(
      rules,
      'person-detected',
      'Orang Terdeteksi',
      'Orang harus terlihat dalam foto.',
      false,
      0,
      'Belum dapat dinilai karena model AI gagal dijalankan. Coba kembali; ini bukan bukti foto salah.'
    );

    addRule(
      rules,
      'product-detected',
      'Produk/Objek Terdeteksi',
      'Produk harus terlihat dalam foto.',
      false,
      0,
      'Belum dapat dinilai karena model AI gagal dijalankan.'
    );
  }

  return buildResult(rules, 'person-product');
}

async function validateSignboard(
  analysis: ImageAnalysis
): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];
  const config = SETTINGS.signboard;

  const ocr = await runOcrSafe(analysis.canvas);
  const text = cleanText(ocr.text);
  const characterCount = countAlphaNumeric(text);

  const readable =
    !ocr.failed &&
    ocr.confidence >= config.ocrMinimum &&
    characterCount >= config.minimumTextLength;

  const sharpness = assessTextSharpness(
    analysis.blurScore,
    config.sharpnessPreferred,
    config.sharpnessMinimum,
    readable && ocr.confidence >= config.ocrStrong
  );

  addRule(
    rules,
    'not-blurry',
    'Ketajaman Foto',
    'Foto harus cukup tajam agar tulisan dapat diperiksa.',
    sharpness.passed,
    sharpness.passed
      ? Math.max(
          65,
          sharpnessScore(
            analysis.blurScore,
            config.sharpnessPreferred
          )
        )
      : sharpnessScore(
          analysis.blurScore,
          config.sharpnessPreferred
        ),
    sharpness.details
  );

  addRule(
    rules,
    'signboard-text-readable',
    'Tulisan Papan Nama Terbaca',
    'Tulisan papan nama harus cukup terbaca.',
    readable,
    ocr.confidence,
    ocr.failed
      ? 'OCR gagal dijalankan. Coba kembali; kualitas foto belum dapat dinilai.'
      : readable
        ? `Teks terbaca: "${truncate(text, 120)}". Keyakinan OCR: ${ocr.confidence.toFixed(
            1
          )}. Pastikan teks tersebut merupakan nama sekolah.`
        : `Tulisan belum dapat dipastikan oleh OCR. Keyakinan: ${ocr.confidence.toFixed(
            1
          )}. Teks: "${truncate(
            text,
            100
          )}". Jika terlihat jelas oleh manusia, foto perlu diperiksa admin.`
  );

  // Posisi atas dan foto dari bawah diperbolehkan.
  // Aturan ini selalu lolos karena hanya informasi komposisi.
  addAdvisory(
    rules,
    'signboard-centered',
    'Posisi Papan Nama',
    'Papan nama boleh berada di atas dan difoto dari bawah.',
    true,
    analysis.centerScore,
    'Posisi di tengah tidak diwajibkan. Prioritaskan nama sekolah terlihat jelas.'
  );

  addAdvisory(
    rules,
    'signboard-not-cropped',
    'Saran Keutuhan Papan Nama',
    'Pastikan seluruh nama sekolah terlihat.',
    !!analysis.mainBox && !analysis.cropped,
    analysis.mainBox ? (analysis.cropped ? 45 : 95) : 20,
    'Pemeriksaan tepi memakai area visual umum dan tidak menentukan kelulusan. Periksa langsung apakah nama sekolah lengkap.'
  );

  addLightingAdvisory(rules, analysis);

  return buildResult(rules, 'signboard');
}

async function validateSerialNumber(
  analysis: ImageAnalysis
): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];
  const config = SETTINGS.serial;

  const ocr = await runOcrSafe(analysis.canvas);
  const region = findSerialRegion(ocr.words);

  const serialText = region ? cleanText(region.text) : '';
  const confidence = region?.confidence ?? 0;

  const readable =
    !ocr.failed &&
    !!region &&
    confidence >= config.ocrMinimum &&
    countAlphaNumeric(serialText) >= 4;

  // Mengukur ketajaman pada area teks bila tersedia,
  // agar latar belakang tidak mendominasi penilaian.
  const localBlur = region
    ? calculateRegionBlurScore(analysis, region.box)
    : null;

  const blurScore = localBlur ?? analysis.blurScore;

  const sharpness = assessTextSharpness(
    blurScore,
    config.sharpnessPreferred,
    config.sharpnessMinimum,
    readable && confidence >= config.ocrStrong
  );

  const margins = region
    ? getBoxMargins(
        region.box,
        analysis.width,
        analysis.height
      )
    : null;

  const marginX = Math.max(
    2,
    analysis.width * config.edgeMarginRatio
  );

  const marginY = Math.max(
    2,
    analysis.height * config.edgeMarginRatio
  );

  const nearEdge = margins
    ? margins.left <= marginX ||
      margins.right <= marginX ||
      margins.top <= marginY ||
      margins.bottom <= marginY
    : null;

  const centerScore = region
    ? bboxCenterScore(
        region.box,
        analysis.width,
        analysis.height
      )
    : 0;

  addRule(
    rules,
    'not-blurry',
    'Ketajaman Nomor Seri',
    'Karakter nomor seri harus cukup jelas.',
    sharpness.passed,
    sharpness.passed
      ? Math.max(
          65,
          sharpnessScore(blurScore, config.sharpnessPreferred)
        )
      : sharpnessScore(blurScore, config.sharpnessPreferred),
    `${sharpness.details} ${
      localBlur !== null
        ? 'Diukur pada area teks nomor seri.'
        : 'Diukur pada seluruh foto karena area teks belum ditemukan.'
    }`
  );

  addRule(
    rules,
    'ocr-readable',
    'Teks Nomor Seri Terbaca',
    'Nomor seri harus dapat diidentifikasi dari hasil OCR.',
    readable,
    confidence,
    ocr.failed
      ? 'OCR gagal dijalankan. Coba kembali.'
      : region
        ? `Teks: "${truncate(
            serialText,
            100
          )}". Keyakinan OCR: ${confidence.toFixed(1)}. ${
            region.source === 'label'
              ? 'Penanda nomor seri ditemukan.'
              : 'Kandidat tanpa penanda ditemukan; pastikan ini nomor seri yang dimaksud.'
          }`
        : 'Area nomor seri belum dapat dipastikan. Foto lebih dekat, sertakan penanda S/N bila ada, dan pastikan semua karakter terlihat.'
  );

  addRule(
    rules,
    'text-not-cropped',
    'Jarak Nomor Seri dari Tepi',
    'Area teks nomor seri harus memiliki ruang dari tepi foto.',
    nearEdge === false,
    nearEdge === null ? 20 : nearEdge ? 45 : 95,
    !margins
      ? 'Area nomor seri belum ditemukan sehingga jarak dari tepi belum dapat diperiksa.'
      : nearEdge
        ? 'Teks nomor seri sangat dekat dengan tepi dan berisiko terpotong. Berikan sedikit ruang di sekeliling teks.'
        : `Area teks memiliki jarak dari tepi. Kiri ${margins.left.toFixed(
            0
          )} px, kanan ${margins.right.toFixed(
            0
          )} px, atas ${margins.top.toFixed(
            0
          )} px, bawah ${margins.bottom.toFixed(
            0
          )} px. Ini belum membuktikan seluruh karakter nomor seri lengkap.`
  );

  addAdvisory(
    rules,
    'text-centered',
    'Saran Posisi Nomor Seri',
    'Nomor seri tidak harus tepat di tengah.',
    !!region && centerScore >= 50,
    centerScore,
    region
      ? `Skor posisi: ${centerScore}/100. Posisi tidak menentukan kelulusan.`
      : 'Posisi belum dapat dinilai karena area nomor seri belum ditemukan.'
  );

  addAdvisory(
    rules,
    'text-contrast',
    'Saran Kontras Foto',
    'Hindari pantulan cahaya yang menutupi karakter.',
    analysis.contrast >= 14,
    Math.min(100, analysis.contrast * 3),
    `Kontras seluruh foto: ${analysis.contrast.toFixed(
      1
    )}. Nilai ini hanya informasi pendukung.`
  );

  addLightingAdvisory(rules, analysis);

  return buildResult(rules, 'serial-number');
}

async function validateBastDocument(
  analysis: ImageAnalysis
): Promise<ValidationResult> {
  const rules: ValidationRule[] = [];
  const config = SETTINGS.document;

  const ocr = await runOcrSafe(analysis.canvas);
  const text = cleanText(ocr.text);

  const readable =
    !ocr.failed &&
    ocr.confidence >= config.ocrMinimum &&
    countAlphaNumeric(text) >= config.minimumTextLength;

  const sharpness = assessTextSharpness(
    analysis.blurScore,
    config.sharpnessPreferred,
    config.sharpnessMinimum,
    readable && ocr.confidence >= config.ocrStrong
  );

  addRule(
    rules,
    'not-blurry',
    'Ketajaman Dokumen',
    'Tulisan dokumen harus cukup jelas.',
    sharpness.passed,
    sharpness.passed
      ? Math.max(
          65,
          sharpnessScore(
            analysis.blurScore,
            config.sharpnessPreferred
          )
        )
      : sharpnessScore(
          analysis.blurScore,
          config.sharpnessPreferred
        ),
    sharpness.details
  );

  addRule(
    rules,
    'text-readable',
    'Teks Dokumen Terbaca',
    'Teks dokumen harus cukup terbaca.',
    readable,
    ocr.confidence,
    ocr.failed
      ? 'OCR gagal dijalankan. Coba kembali.'
      : `Keyakinan OCR: ${ocr.confidence.toFixed(
          1
        )}. Teks: "${truncate(text, 120)}". ${
          readable
            ? 'Periksa kelengkapan isi, tanda tangan, dan kolom dokumen secara manual.'
            : 'Jika dokumen terlihat jelas oleh manusia, diperlukan pemeriksaan admin.'
        }`
  );

  addAdvisory(
    rules,
    'document-centered',
    'Saran Posisi Dokumen',
    'Dokumen tidak harus tepat di tengah.',
    analysis.centerScore >= 50,
    analysis.centerScore,
    `Skor posisi area visual: ${analysis.centerScore}/100.`
  );

  addAdvisory(
    rules,
    'document-not-cropped',
    'Saran Keutuhan Dokumen',
    'Pastikan bagian penting dokumen terlihat.',
    !!analysis.mainBox && !analysis.cropped,
    analysis.mainBox ? (analysis.cropped ? 45 : 95) : 20,
    'Periksa langsung seluruh sisi dan bagian penting dokumen. Deteksi tepi visual hanya merupakan saran.'
  );

  const stampOverlap = estimateStampOverlapWithText(
    analysis.canvas,
    ocr.words
  );

  addAdvisory(
    rules,
    'stamp-coverage',
    'Perkiraan Warna Stempel pada Teks',
    'Periksa apakah stempel menghalangi tulisan penting.',
    stampOverlap !== null && stampOverlap <= 20,
    stampOverlap === null
      ? 20
      : Math.max(0, 100 - stampOverlap * 3),
    stampOverlap === null
      ? 'Area teks belum cukup untuk memeriksa stempel.'
      : `Perkiraan piksel berwarna seperti stempel pada area teks: ${stampOverlap.toFixed(
          1
        )}%. Tulisan berwarna dapat ikut terhitung; hasil ini tidak menentukan kelulusan.`
  );

  addLightingAdvisory(rules, analysis);

  return buildResult(rules, 'bast-document');
}

function assessTextSharpness(
  blurScore: number,
  preferred: number,
  minimum: number,
  strongOcr: boolean
): SharpnessAssessment {
  if (blurScore >= preferred) {
    return {
      passed: true,
      details: `Skor ketajaman ${blurScore.toFixed(
        1
      )}. Memenuhi target ${preferred}.`
    };
  }

  if (blurScore >= minimum && strongOcr) {
    return {
      passed: true,
      details: `Skor ketajaman ${blurScore.toFixed(
        1
      )} di bawah target ${preferred}, tetapi pembacaan OCR cukup kuat. Diterima dengan toleransi; periksa teks hasil pembacaan.`
    };
  }

  return {
    passed: false,
    details:
      blurScore < minimum
        ? `Skor ketajaman ${blurScore.toFixed(
            1
          )} di bawah batas minimum ${minimum}. Stabilkan HP, bersihkan lensa, dan ambil ulang dengan cahaya cukup.`
        : `Skor ketajaman ${blurScore.toFixed(
            1
          )} di bawah target ${preferred} dan OCR belum cukup kuat untuk toleransi. Dekatkan kamera atau periksa foto secara manual.`
  };
}

function sharpnessScore(
  value: number,
  target: number
): number {
  return Math.min(
    100,
    Math.max(0, (value / Math.max(1, target)) * 85)
  );
}

function addLightingAdvisory(
  rules: ValidationRule[],
  analysis: ImageAnalysis
): void {
  const good =
    analysis.brightness >= 35 &&
    analysis.brightness <= 225;

  addAdvisory(
    rules,
    'brightness-ok',
    'Saran Pencahayaan',
    'Usahakan tulisan tidak tertutup bayangan atau pantulan.',
    good,
    good ? 90 : 40,
    `Kecerahan rata-rata: ${analysis.brightness.toFixed(
      1
    )}/255. ${
      good
        ? 'Pencahayaan rata-rata cukup.'
        : 'Pencahayaan perlu diperhatikan. Jika teks terbaca, nilai ini tidak menggagalkan foto.'
    }`
  );
}

function runOcrSafe(
  canvas: HTMLCanvasElement
): Promise<OcrResult> {
  const task = ocrQueue.then(async (): Promise<OcrResult> => {
    try {
      const worker = await getOcrWorker();

      const result = await worker.recognize(
        canvas,
        {},
        { text: true, blocks: true }
      );

      const data = result.data ?? {};

      return {
        text: String(data.text ?? ''),
        confidence: clamp(
          finiteNumber(data.confidence, 0),
          0,
          100
        ),
        words: extractOcrWords(
          data,
          canvas.width,
          canvas.height
        ),
        failed: false
      };
    } catch (error) {
      console.error('OCR gagal:', error);

      return {
        text: '',
        confidence: 0,
        words: [],
        failed: true
      };
    }
  });

  ocrQueue = task.then(
    () => undefined,
    () => undefined
  );

  return task;
}

function extractOcrWords(
  data: any,
  width: number,
  height: number
): OcrWord[] {
  const words: OcrWord[] = [];
  const seen = new Set<string>();

  function addWord(raw: any): void {
    if (!raw?.bbox) return;

    const text = cleanText(String(raw.text ?? ''));
    if (!text) return;

    const box = normalizeOcrBox(raw.bbox, width, height);
    if (!box) return;

    const [x, y, w, h] = box;
    const key = `${text}:${x}:${y}:${w}:${h}`;

    if (seen.has(key)) return;
    seen.add(key);

    words.push({
      text,
      confidence: clamp(
        finiteNumber(raw.confidence, 0),
        0,
        100
      ),
      bbox: {
        x0: x,
        y0: y,
        x1: x + w,
        y1: y + h
      }
    });
  }

  function walk(node: any): void {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node.words)) {
      node.words.forEach(addWord);
    }

    for (const key of ['blocks', 'paragraphs', 'lines']) {
      if (Array.isArray(node[key])) {
        node[key].forEach(walk);
      }
    }
  }

  walk(data);
  return words;
}

function normalizeOcrBox(
  raw: any,
  width: number,
  height: number
): BBox | null {
  const left = Number(raw.x0 ?? raw.left);
  const top = Number(raw.y0 ?? raw.top);

  const right = Number(
    raw.x1 ?? raw.right ?? left + Number(raw.width)
  );

  const bottom = Number(
    raw.y1 ?? raw.bottom ?? top + Number(raw.height)
  );

  if (![left, top, right, bottom].every(Number.isFinite)) {
    return null;
  }

  const x0 = clamp(left, 0, width);
  const y0 = clamp(top, 0, height);
  const x1 = clamp(right, 0, width);
  const y1 = clamp(bottom, 0, height);

  if (x1 <= x0 || y1 <= y0) return null;

  return [x0, y0, x1 - x0, y1 - y0];
}

function findSerialRegion(
  allWords: OcrWord[]
): SerialRegion | null {
  const words = allWords.filter(
    (word) =>
      word.confidence >= 10 &&
      /[A-Z0-9]/i.test(word.text)
  );

  if (!words.length) return null;

  const lines = groupWordsIntoLines(words);
  const labeled: SerialRegion[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const text = line.map((word) => word.text).join(' ');

    const match = text.match(
      /\b(?:S\s*\/\s*N|S\.?\s*N\.?|SERIAL(?:\s*(?:NO\.?|NUMBER))?|NOMOR\s*SERI|NO\.?\s*SERI)\s*[:#=\-]?\s*/i
    );

    if (!match || match.index === undefined) continue;

    const endOfLabel = match.index + match[0].length;
    const afterLabel = text.slice(endOfLabel).trim();

    if (isPossibleSerialValue(afterLabel, false)) {
      // Ambil kata setelah penanda, termasuk satu kata
      // yang berisi penanda dan nilai sekaligus.
      let offset = 0;
      const valueWords: OcrWord[] = [];

      for (const word of line) {
        const end = offset + word.text.length;

        if (end > endOfLabel) {
          valueWords.push(word);
        }

        offset = end + 1;
      }

      if (valueWords.length) {
        labeled.push(
          makeSerialRegion(
            valueWords,
            'label',
            afterLabel
          )
        );
      }

      continue;
    }

    if (afterLabel) continue;

    const nextLine = lines[index + 1];
    if (!nextLine) continue;

    const labelBox = unionWordBoxes(line);
    const nextBox = unionWordBoxes(nextLine);

    const gap = nextBox[1] - (labelBox[1] + labelBox[3]);

    const overlapX =
      Math.min(
        labelBox[0] + labelBox[2],
        nextBox[0] + nextBox[2]
      ) - Math.max(labelBox[0], nextBox[0]);

    const aligned =
      overlapX > 0 ||
      Math.abs(nextBox[0] - labelBox[0]) <=
        Math.max(labelBox[3], nextBox[3]) * 3;

    const nextText = nextLine
      .map((word) => word.text)
      .join(' ');

    if (
      gap >= -Math.min(labelBox[3], nextBox[3]) * 0.25 &&
      gap <= Math.max(labelBox[3], nextBox[3]) * 2 &&
      aligned &&
      isPossibleSerialValue(nextText, false)
    ) {
      labeled.push(
        makeSerialRegion(nextLine, 'label')
      );
    }
  }

  if (labeled.length === 1) return labeled[0];

  // Jangan menebak jika terdapat beberapa nomor seri.
  if (labeled.length > 1) return null;

  const candidates: SerialRegion[] = [];

  for (const line of lines) {
    const text = line.map((word) => word.text).join(' ');

    if (
      /\b(?:MODEL|TYPE|IMEI|MAC|EAN|UPC|SKU|PART|P\/N|INPUT|OUTPUT|VOLTAGE|DATE)\b/i.test(
        text
      )
    ) {
      continue;
    }

    if (isPossibleSerialValue(text, true)) {
      candidates.push(
        makeSerialRegion(line, 'candidate')
      );
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}

function isPossibleSerialValue(
  text: string,
  requireLettersAndDigits: boolean
): boolean {
  const value = text.trim();

  if (!value || !/^[A-Z0-9\s./:_\-]+$/i.test(value)) {
    return false;
  }

  const compact = value.replace(/[^A-Z0-9]/gi, '');

  if (compact.length < 4 || compact.length > 48) {
    return false;
  }

  if (!/\d/.test(compact)) return false;

  if (
    requireLettersAndDigits &&
    !/[A-Z]/i.test(compact)
  ) {
    return false;
  }

  return true;
}

function makeSerialRegion(
  words: OcrWord[],
  source: SerialRegion['source'],
  textOverride?: string
): SerialRegion {
  let total = 0;
  let count = 0;

  for (const word of words) {
    const weight = Math.max(1, word.text.length);
    total += word.confidence * weight;
    count += weight;
  }

  return {
    text:
      textOverride ??
      words.map((word) => word.text).join(' '),
    box: unionWordBoxes(words),
    confidence: count ? total / count : 0,
    source
  };
}

function groupWordsIntoLines(
  words: OcrWord[]
): OcrWord[][] {
  const sorted = [...words].sort(
    (a, b) =>
      a.bbox.y0 - b.bbox.y0 ||
      a.bbox.x0 - b.bbox.x0
  );

  const lines: OcrWord[][] = [];

  for (const word of sorted) {
    const height = word.bbox.y1 - word.bbox.y0;
    const centerY = (word.bbox.y0 + word.bbox.y1) / 2;

    let bestLine: OcrWord[] | null = null;
    let bestDistance = Infinity;

    for (const line of lines) {
      const box = unionWordBoxes(line);
      const lineCenterY = box[1] + box[3] / 2;

      const overlap =
        Math.min(word.bbox.y1, box[1] + box[3]) -
        Math.max(word.bbox.y0, box[1]);

      const ratio =
        Math.max(0, overlap) /
        Math.max(1, Math.min(height, box[3]));

      const distance = Math.abs(centerY - lineCenterY);

      if (
        ratio >= 0.45 &&
        distance <= Math.max(height, box[3]) * 0.65 &&
        distance < bestDistance
      ) {
        bestLine = line;
        bestDistance = distance;
      }
    }

    if (bestLine) {
      bestLine.push(word);
    } else {
      lines.push([word]);
    }
  }

  for (const line of lines) {
    line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  return lines.sort(
    (a, b) =>
      unionWordBoxes(a)[1] - unionWordBoxes(b)[1]
  );
}

function unionWordBoxes(words: OcrWord[]): BBox {
  const x0 = Math.min(
    ...words.map((word) => word.bbox.x0)
  );

  const y0 = Math.min(
    ...words.map((word) => word.bbox.y0)
  );

  const x1 = Math.max(
    ...words.map((word) => word.bbox.x1)
  );

  const y1 = Math.max(
    ...words.map((word) => word.bbox.y1)
  );

  return [x0, y0, x1 - x0, y1 - y0];
}

function calculateRegionBlurScore(
  analysis: ImageAnalysis,
  box: BBox
): number | null {
  const [x, y, w, h] = box;

  const padding = Math.max(
    4,
    Math.min(w, h) * 0.15
  );

  const left = Math.max(0, Math.floor(x - padding));
  const top = Math.max(0, Math.floor(y - padding));

  const right = Math.min(
    analysis.width,
    Math.ceil(x + w + padding)
  );

  const bottom = Math.min(
    analysis.height,
    Math.ceil(y + h + padding)
  );

  const width = right - left;
  const height = bottom - top;

  if (width < 3 || height < 3) return null;

  const pixels = analysis.ctx.getImageData(
    left,
    top,
    width,
    height
  );

  const gray = toGray(pixels.data, width, height);

  return calculateBlurScore(gray, width, height);
}

function loadImage(
  src: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('Ukuran gambar tidak valid.'));
        return;
      }

      resolve(img);
    };

    img.onerror = () => {
      reject(new Error('Gambar gagal dimuat.'));
    };

    img.src = src;
  });
}

function imageToCanvas(
  image: HTMLImageElement,
  maxSize: number
) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const scale = Math.min(
    1,
    maxSize / Math.max(width, height)
  );

  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });

  if (!ctx) {
    throw new Error('Canvas 2D tidak tersedia.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return { canvas, ctx };
}

function toGray(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
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

function calculateBlurScore(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): number {
  let sum = 0;
  let sumSquared = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;

      const laplacian =
        -4 * gray[index] +
        gray[index - 1] +
        gray[index + 1] +
        gray[index - width] +
        gray[index + width];

      sum += laplacian;
      sumSquared += laplacian * laplacian;
      count++;
    }
  }

  if (!count) return 0;

  const mean = sum / count;
  const variance = sumSquared / count - mean * mean;

  return clamp(variance / 15, 0, 100);
}

function calculateBrightness(
  gray: Uint8ClampedArray
): number {
  if (!gray.length) return 0;

  let total = 0;

  for (let i = 0; i < gray.length; i++) {
    total += gray[i];
  }

  return total / gray.length;
}

function calculateContrast(
  gray: Uint8ClampedArray
): number {
  if (!gray.length) return 0;

  const mean = calculateBrightness(gray);
  let variance = 0;

  for (let i = 0; i < gray.length; i++) {
    variance += Math.pow(gray[i] - mean, 2);
  }

  return (
    (Math.sqrt(variance / gray.length) / 128) * 100
  );
}

function detectMainBox(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): BBox | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const index = y * width + x;

      const edge =
        Math.abs(gray[index + 1] - gray[index - 1]) +
        Math.abs(
          gray[index + width] - gray[index - width]
        );

      if (edge > 58) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count++;
      }
    }
  }

  if (
    count < Math.max(1, (width * height) / 4500) ||
    maxX <= minX ||
    maxY <= minY
  ) {
    return null;
  }

  return [minX, minY, maxX - minX, maxY - minY];
}

function getBoxMargins(
  box: BBox,
  width: number,
  height: number
) {
  const [x, y, w, h] = box;

  return {
    left: x,
    top: y,
    right: width - x - w,
    bottom: height - y - h
  };
}

function touchesEdge(
  box: BBox,
  width: number,
  height: number,
  marginRatio: number
): boolean {
  const margins = getBoxMargins(box, width, height);

  return (
    margins.left <= width * marginRatio ||
    margins.right <= width * marginRatio ||
    margins.top <= height * marginRatio ||
    margins.bottom <= height * marginRatio
  );
}

function bboxCenterScore(
  box: BBox,
  width: number,
  height: number
): number {
  if (width <= 0 || height <= 0) return 0;

  const [x, y, w, h] = box;

  const dx =
    Math.abs(x + w / 2 - width / 2) / (width / 2);

  const dy =
    Math.abs(y + h / 2 - height / 2) / (height / 2);

  const distance =
    Math.sqrt(dx * dx + dy * dy) / Math.sqrt(2);

  return Math.round(clamp(100 - distance * 100, 0, 100));
}

function largestDetectionBox(
  boxes: BBox[]
): BBox {
  return [...boxes].sort(
    (a, b) => b[2] * b[3] - a[2] * a[3]
  )[0];
}

function overlapPercent(a: BBox, b: BBox): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;

  const left = Math.max(ax, bx);
  const top = Math.max(ay, by);
  const right = Math.min(ax + aw, bx + bw);
  const bottom = Math.min(ay + ah, by + bh);

  const intersection =
    Math.max(0, right - left) *
    Math.max(0, bottom - top);

  const area = aw * ah;

  return area > 0 ? (intersection / area) * 100 : 0;
}

function estimateStampOverlapWithText(
  canvas: HTMLCanvasElement,
  words: OcrWord[]
): number | null {
  const validWords = words.filter(
    (word) => word.confidence > 25
  );

  if (!validWords.length) return null;

  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });

  if (!ctx) return null;

  const data = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;

  let sampledPixels = 0;
  let coloredPixels = 0;

  for (const word of validWords) {
    const left = Math.max(0, Math.floor(word.bbox.x0));
    const top = Math.max(0, Math.floor(word.bbox.y0));

    const right = Math.min(
      canvas.width,
      Math.ceil(word.bbox.x1)
    );

    const bottom = Math.min(
      canvas.height,
      Math.ceil(word.bbox.y1)
    );

    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const index = (y * canvas.width + x) * 4;

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        const maximum = Math.max(r, g, b);
        const minimum = Math.min(r, g, b);
        const saturation = maximum - minimum;

        const stampLike =
          (saturation > 45 &&
            (r > 120 || b > 120) &&
            !(r > 230 && g > 230 && b > 230)) ||
          (maximum < 110 && saturation > 20);

        sampledPixels++;

        if (stampLike) coloredPixels++;
      }
    }
  }

  if (!sampledPixels) return null;

  return clamp(
    (coloredPixels / sampledPixels) * 100,
    0,
    100
  );
}

function countAlphaNumeric(text: string): number {
  return (text.match(/[A-Z0-9]/gi) ?? []).length;
}

function cleanText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, length: number): string {
  return text.length > length
    ? `${text.slice(0, length)}...`
    : text;
}

function finiteNumber(
  value: unknown,
  fallback: number
): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function addRule(
  rules: ValidationRule[],
  id: string,
  name: string,
  description: string,
  passed: boolean,
  score: number,
  details?: string
): void {
  rules.push({
    id,
    name,
    description,
    passed,
    score: Math.round(
      clamp(finiteNumber(score, 0), 0, 100)
    ),
    details
  });
}

function addAdvisory(
  rules: ValidationRule[],
  id: string,
  name: string,
  description: string,
  recommendationMet: boolean,
  score: number,
  details: string
): void {
  // Tipe lama hanya memiliki passed boolean.
  // Saran dibuat passed=true agar UI tidak menampilkannya
  // sebagai kegagalan wajib. Kondisinya dijelaskan di details.
  addRule(
    rules,
    id,
    name,
    description,
    true,
    score,
    `${
      recommendationMet
        ? 'Informasi tambahan.'
        : 'Saran perbaikan.'
    } ${details} Tidak menentukan kelulusan.`
  );
}

function buildResult(
  rules: ValidationRule[],
  category: PhotoCategory
): ValidationResult {
  const requiredIds = REQUIRED_RULES[category];

  const requiredRules = requiredIds.map(
    (id) => rules.find((rule) => rule.id === id)
  );

  const allRequiredPresent = requiredRules.every(
    (rule) => rule !== undefined
  );

  const requiredPassed =
    allRequiredPresent &&
    requiredRules.every((rule) => rule?.passed === true);

  // Hanya aturan wajib yang dihitung.
  // Saran posisi, pencahayaan, dan tepi visual umum
  // tidak dapat menurunkan skor akhir.
  const overallScore = Math.round(
    requiredRules.reduce(
      (sum, rule) => sum + (rule?.score ?? 0),
      0
    ) / Math.max(1, requiredIds.length)
  );

  return {
    overallScore,

    // Tidak memakai ambang rata-rata tambahan.
    // Semua aturan wajib sudah memiliki ambangnya sendiri.
    passed: requiredPassed,

    rules,
    timestamp: new Date(),
    category
  };
}