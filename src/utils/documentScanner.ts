export type ScanFilter =
  | 'original'
  | 'enhance';

export interface Point {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface DocumentScanOptions {
  filter?: ScanFilter;
  jpegQuality?: number;
  minOutputSize?: number;
  maxOutputSize?: number;
}

export interface AutoDetectOptions {
  sampleSize?: number;
  edgeThreshold?: number;
  padding?: number;
}

const DEFAULT_JPEG_QUALITY = 0.94;
const DEFAULT_MIN_OUTPUT_SIZE = 320;
const DEFAULT_MAX_OUTPUT_SIZE = 2400;

/**
 * Membatasi nilai agar selalu berada di antara min dan max.
 */
export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    Math.max(value, min),
    max
  );
}

/**
 * Posisi default 4 sudut dalam koordinat normalized 0..1.
 */
export function getDefaultCorners(): CornerPoints {
  return {
    topLeft: {
      x: 0.08,
      y: 0.08,
    },
    topRight: {
      x: 0.92,
      y: 0.08,
    },
    bottomRight: {
      x: 0.92,
      y: 0.92,
    },
    bottomLeft: {
      x: 0.08,
      y: 0.92,
    },
  };
}

/**
 * Pastikan semua sudut tetap berada di area gambar.
 */
export function normalizeCorners(
  corners: CornerPoints
): CornerPoints {
  return {
    topLeft: {
      x: clamp(corners.topLeft.x, 0, 1),
      y: clamp(corners.topLeft.y, 0, 1),
    },
    topRight: {
      x: clamp(corners.topRight.x, 0, 1),
      y: clamp(corners.topRight.y, 0, 1),
    },
    bottomRight: {
      x: clamp(corners.bottomRight.x, 0, 1),
      y: clamp(corners.bottomRight.y, 0, 1),
    },
    bottomLeft: {
      x: clamp(corners.bottomLeft.x, 0, 1),
      y: clamp(corners.bottomLeft.y, 0, 1),
    },
  };
}

/**
 * Jarak Euclidean antar titik.
 */
export function getDistance(
  first: Point,
  second: Point
): number {
  const dx =
    second.x - first.x;

  const dy =
    second.y - first.y;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}

/**
 * Cek sederhana apakah susunan 4 titik cukup valid.
 */
export function isValidCornerLayout(
  corners: CornerPoints
): boolean {
  const normalized =
    normalizeCorners(corners);

  const topWidth =
    getDistance(
      normalized.topLeft,
      normalized.topRight
    );

  const bottomWidth =
    getDistance(
      normalized.bottomLeft,
      normalized.bottomRight
    );

  const leftHeight =
    getDistance(
      normalized.topLeft,
      normalized.bottomLeft
    );

  const rightHeight =
    getDistance(
      normalized.topRight,
      normalized.bottomRight
    );

  const minimumSide =
    0.08;

  return (
    topWidth > minimumSide &&
    bottomWidth > minimumSide &&
    leftHeight > minimumSide &&
    rightHeight > minimumSide
  );
}

/**
 * Load data URL menjadi HTMLImageElement.
 */
export function loadImageFromDataUrl(
  imageData: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            'Gagal memuat gambar untuk proses document scanner.'
          )
        );
      };

      image.src =
        imageData;
    }
  );
}

/**
 * Mapping bilinear dari quad 4 sudut ke rectangle.
 * Ringan dan bisa berjalan offline tanpa OpenCV.
 */
function bilinearInterpolation(
  topLeft: Point,
  topRight: Point,
  bottomRight: Point,
  bottomLeft: Point,
  u: number,
  v: number
): Point {
  const topX =
    topLeft.x +
    (
      topRight.x -
      topLeft.x
    ) *
      u;

  const topY =
    topLeft.y +
    (
      topRight.y -
      topLeft.y
    ) *
      u;

  const bottomX =
    bottomLeft.x +
    (
      bottomRight.x -
      bottomLeft.x
    ) *
      u;

  const bottomY =
    bottomLeft.y +
    (
      bottomRight.y -
      bottomLeft.y
    ) *
      u;

  return {
    x:
      topX +
      (
        bottomX -
        topX
      ) *
        v,

    y:
      topY +
      (
        bottomY -
        topY
      ) *
        v,
  };
}

/**
 * Menentukan ukuran output agar cukup tajam namun tidak terlalu berat.
 */
function calculateOutputSize(
  topLeft: Point,
  topRight: Point,
  bottomRight: Point,
  bottomLeft: Point,
  minOutputSize: number,
  maxOutputSize: number
): {
  width: number;
  height: number;
} {
  const topWidth =
    getDistance(
      topLeft,
      topRight
    );

  const bottomWidth =
    getDistance(
      bottomLeft,
      bottomRight
    );

  const leftHeight =
    getDistance(
      topLeft,
      bottomLeft
    );

  const rightHeight =
    getDistance(
      topRight,
      bottomRight
    );

  let width =
    Math.max(
      topWidth,
      bottomWidth
    );

  let height =
    Math.max(
      leftHeight,
      rightHeight
    );

  if (
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'Ukuran area scan tidak valid.'
    );
  }

  const scaleUp =
    Math.max(
      minOutputSize / width,
      minOutputSize / height,
      1
    );

  width *=
    scaleUp;

  height *=
    scaleUp;

  const scaleDown =
    Math.min(
      maxOutputSize / width,
      maxOutputSize / height,
      1
    );

  width *=
    scaleDown;

  height *=
    scaleDown;

  return {
    width:
      Math.max(
        1,
        Math.round(width)
      ),

    height:
      Math.max(
        1,
        Math.round(height)
      ),
  };
}

/**
 * Crop + koreksi perspektif ringan.
 * Input corners dalam koordinat normalized 0..1.
 */
export function createPerspectiveCrop(
  image: HTMLImageElement,
  corners: CornerPoints,
  options: DocumentScanOptions = {}
): string {
  const {
    filter = 'enhance',
    jpegQuality = DEFAULT_JPEG_QUALITY,
    minOutputSize = DEFAULT_MIN_OUTPUT_SIZE,
    maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
  } = options;

  const normalizedCorners =
    normalizeCorners(corners);

  if (
    !isValidCornerLayout(
      normalizedCorners
    )
  ) {
    throw new Error(
      'Area scan terlalu kecil atau susunan titik sudut tidak valid.'
    );
  }

  const sourceWidth =
    image.naturalWidth ||
    image.width;

  const sourceHeight =
    image.naturalHeight ||
    image.height;

  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error(
      'Ukuran gambar sumber tidak valid.'
    );
  }

  const sourceTopLeft: Point = {
    x:
      normalizedCorners.topLeft.x *
      sourceWidth,

    y:
      normalizedCorners.topLeft.y *
      sourceHeight,
  };

  const sourceTopRight: Point = {
    x:
      normalizedCorners.topRight.x *
      sourceWidth,

    y:
      normalizedCorners.topRight.y *
      sourceHeight,
  };

  const sourceBottomRight: Point = {
    x:
      normalizedCorners.bottomRight.x *
      sourceWidth,

    y:
      normalizedCorners.bottomRight.y *
      sourceHeight,
  };

  const sourceBottomLeft: Point = {
    x:
      normalizedCorners.bottomLeft.x *
      sourceWidth,

    y:
      normalizedCorners.bottomLeft.y *
      sourceHeight,
  };

  const outputSize =
    calculateOutputSize(
      sourceTopLeft,
      sourceTopRight,
      sourceBottomRight,
      sourceBottomLeft,
      minOutputSize,
      maxOutputSize
    );

  const sourceCanvas =
    document.createElement(
      'canvas'
    );

  sourceCanvas.width =
    sourceWidth;

  sourceCanvas.height =
    sourceHeight;

  const sourceCtx =
    sourceCanvas.getContext(
      '2d',
      {
        willReadFrequently: true,
      }
    );

  if (!sourceCtx) {
    throw new Error(
      'Canvas sumber tidak tersedia.'
    );
  }

  sourceCtx.drawImage(
    image,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  const sourcePixels =
    sourceCtx.getImageData(
      0,
      0,
      sourceWidth,
      sourceHeight
    );

  const outputCanvas =
    document.createElement(
      'canvas'
    );

  outputCanvas.width =
    outputSize.width;

  outputCanvas.height =
    outputSize.height;

  const outputCtx =
    outputCanvas.getContext(
      '2d',
      {
        willReadFrequently: true,
      }
    );

  if (!outputCtx) {
    throw new Error(
      'Canvas hasil tidak tersedia.'
    );
  }

  const outputImageData =
    outputCtx.createImageData(
      outputSize.width,
      outputSize.height
    );

  const sourceData =
    sourcePixels.data;

  const outputData =
    outputImageData.data;

  for (
    let y = 0;
    y < outputSize.height;
    y += 1
  ) {
    const v =
      outputSize.height <= 1
        ? 0
        : y /
          (
            outputSize.height -
            1
          );

    for (
      let x = 0;
      x < outputSize.width;
      x += 1
    ) {
      const u =
        outputSize.width <= 1
          ? 0
          : x /
            (
              outputSize.width -
              1
            );

      const mapped =
        bilinearInterpolation(
          sourceTopLeft,
          sourceTopRight,
          sourceBottomRight,
          sourceBottomLeft,
          u,
          v
        );

      const sourceX =
        clamp(
          Math.round(
            mapped.x
          ),
          0,
          sourceWidth - 1
        );

      const sourceY =
        clamp(
          Math.round(
            mapped.y
          ),
          0,
          sourceHeight - 1
        );

      const sourceIndex =
        (
          sourceY *
          sourceWidth +
          sourceX
        ) *
        4;

      const outputIndex =
        (
          y *
          outputSize.width +
          x
        ) *
        4;

      outputData[
        outputIndex
      ] =
        sourceData[
          sourceIndex
        ];

      outputData[
        outputIndex + 1
      ] =
        sourceData[
          sourceIndex + 1
        ];

      outputData[
        outputIndex + 2
      ] =
        sourceData[
          sourceIndex + 2
        ];

      outputData[
        outputIndex + 3
      ] =
        sourceData[
          sourceIndex + 3
        ];
    }
  }

  outputCtx.putImageData(
    outputImageData,
    0,
    0
  );

  applyFilterToCanvas(
    outputCanvas,
    filter
  );

  return outputCanvas.toDataURL(
    'image/jpeg',
    clamp(
      jpegQuality,
      0.5,
      1
    )
  );
}

/**
 * Convenience helper jika input masih berupa data URL.
 */
export async function scanDocumentFromDataUrl(
  imageData: string,
  corners: CornerPoints,
  options: DocumentScanOptions = {}
): Promise<string> {
  const image =
    await loadImageFromDataUrl(
      imageData
    );

  return createPerspectiveCrop(
    image,
    corners,
    options
  );
}

/**
 * Filter utama scanner.
 * Hanya ada:
 * - original
 * - enhance
 */
export function applyFilterToCanvas(
  canvas: HTMLCanvasElement,
  filter: ScanFilter
): void {
  if (
    filter === 'original'
  ) {
    return;
  }

  if (
    filter === 'enhance'
  ) {
    applyEnhancePipeline(
      canvas
    );
  }
}

/**
 * Pipeline Enhance:
 * 1. analisis luminance
 * 2. adaptive brightness
 * 3. contrast stretch
 * 4. slight color normalization
 * 5. sharpen ringan
 *
 * Tujuan:
 * - foto gelap jadi lebih terang
 * - teks kecil lebih jelas
 * - warna tetap natural
 * - tetap aman untuk validasi/OCR
 */
function applyEnhancePipeline(
  canvas: HTMLCanvasElement
): void {
  const ctx =
    canvas.getContext(
      '2d',
      {
        willReadFrequently: true,
      }
    );

  if (!ctx) {
    throw new Error(
      'Canvas enhance tidak tersedia.'
    );
  }

  const imageData =
    ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  const data =
    imageData.data;

  const stats =
    analyzeLuminance(
      data
    );

  enhanceBrightnessContrast(
    data,
    stats
  );

  ctx.putImageData(
    imageData,
    0,
    0
  );

  /*
   * Sharpen dilakukan setelah brightness/contrast
   * supaya edge karakter lebih jelas.
   */
  applyLightSharpen(
    canvas,
    0.46
  );
}

/**
 * Statistik luminance agar enhancement adaptif,
 * bukan sekadar menambah brightness tetap.
 */
interface LuminanceStats {
  average: number;
  lowPercentile: number;
  highPercentile: number;
}

function analyzeLuminance(
  data: Uint8ClampedArray
): LuminanceStats {
  const histogram =
    new Uint32Array(
      256
    );

  let sum =
    0;

  let count =
    0;

  for (
    let index = 0;
    index < data.length;
    index += 4
  ) {
    const luminance =
      clamp(
        Math.round(
          data[index] *
            0.299 +
          data[index + 1] *
            0.587 +
          data[index + 2] *
            0.114
        ),
        0,
        255
      );

    histogram[
      luminance
    ] += 1;

    sum +=
      luminance;

    count += 1;
  }

  if (
    count === 0
  ) {
    return {
      average: 128,
      lowPercentile: 20,
      highPercentile: 235,
    };
  }

  const lowTarget =
    count * 0.02;

  const highTarget =
    count * 0.98;

  let cumulative =
    0;

  let lowPercentile =
    0;

  let highPercentile =
    255;

  for (
    let value = 0;
    value < 256;
    value += 1
  ) {
    cumulative +=
      histogram[value];

    if (
      cumulative >=
      lowTarget
    ) {
      lowPercentile =
        value;
      break;
    }
  }

  cumulative =
    0;

  for (
    let value = 0;
    value < 256;
    value += 1
  ) {
    cumulative +=
      histogram[value];

    if (
      cumulative >=
      highTarget
    ) {
      highPercentile =
        value;
      break;
    }
  }

  return {
    average:
      sum / count,

    lowPercentile,

    highPercentile,
  };
}

/**
 * Brightness + contrast adaptif.
 *
 * Foto gelap mendapat lift lebih besar.
 * Foto yang sudah terang hanya sedikit dikoreksi.
 */
function enhanceBrightnessContrast(
  data: Uint8ClampedArray,
  stats: LuminanceStats
): void {
  const average =
    stats.average;

  let brightnessLift =
    0;

  if (
    average < 70
  ) {
    brightnessLift =
      28;
  } else if (
    average < 95
  ) {
    brightnessLift =
      20;
  } else if (
    average < 120
  ) {
    brightnessLift =
      12;
  } else if (
    average < 145
  ) {
    brightnessLift =
      6;
  }

  const sourceLow =
    clamp(
      stats.lowPercentile,
      0,
      80
    );

  const sourceHigh =
    clamp(
      stats.highPercentile,
      150,
      255
    );

  const sourceRange =
    Math.max(
      70,
      sourceHigh -
      sourceLow
    );

  /*
   * Jangan stretch terlalu agresif.
   * Target dibuat agar highlight tetap aman.
   */
  const targetLow =
    10;

  const targetHigh =
    245;

  const targetRange =
    targetHigh -
    targetLow;

  for (
    let index = 0;
    index < data.length;
    index += 4
  ) {
    const r =
      data[index];

    const g =
      data[index + 1];

    const b =
      data[index + 2];

    const luminance =
      r * 0.299 +
      g * 0.587 +
      b * 0.114;

    const stretchedLuminance =
      targetLow +
      (
        luminance -
        sourceLow
      ) /
        sourceRange *
        targetRange;

    const adjustedLuminance =
      clamp(
        stretchedLuminance +
        brightnessLift,
        0,
        255
      );

    /*
     * Preserve warna:
     * chroma tetap dipertahankan, hanya sedikit dinormalisasi.
     */
    const saturationFactor =
      0.92;

    const delta =
      adjustedLuminance -
      luminance;

    const newR =
      luminance +
      (
        r -
        luminance
      ) *
        saturationFactor +
      delta;

    const newG =
      luminance +
      (
        g -
        luminance
      ) *
        saturationFactor +
      delta;

    const newB =
      luminance +
      (
        b -
        luminance
      ) *
        saturationFactor +
      delta;

    data[index] =
      clamp(
        Math.round(
          newR
        ),
        0,
        255
      );

    data[index + 1] =
      clamp(
        Math.round(
          newG
        ),
        0,
        255
      );

    data[index + 2] =
      clamp(
        Math.round(
          newB
        ),
        0,
        255
      );
  }
}

/**
 * Sharpen ringan memakai kernel:
 *
 *   0  -1   0
 *  -1   5  -1
 *   0  -1   0
 *
 * strength dicampur dengan gambar asli agar
 * tidak membuat teks/barcode oversharpen.
 */
function applyLightSharpen(
  canvas: HTMLCanvasElement,
  strength: number
): void {
  const ctx =
    canvas.getContext(
      '2d',
      {
        willReadFrequently: true,
      }
    );

  if (!ctx) {
    return;
  }

  const width =
    canvas.width;

  const height =
    canvas.height;

  if (
    width < 3 ||
    height < 3
  ) {
    return;
  }

  const source =
    ctx.getImageData(
      0,
      0,
      width,
      height
    );

  const output =
    ctx.createImageData(
      width,
      height
    );

  const sourceData =
    source.data;

  const outputData =
    output.data;

  /*
   * Copy border apa adanya.
   */
  outputData.set(
    sourceData
  );

  const mix =
    clamp(
      strength,
      0,
      1
    );

  for (
    let y = 1;
    y < height - 1;
    y += 1
  ) {
    for (
      let x = 1;
      x < width - 1;
      x += 1
    ) {
      const centerIndex =
        (
          y *
          width +
          x
        ) *
        4;

      const leftIndex =
        centerIndex - 4;

      const rightIndex =
        centerIndex + 4;

      const topIndex =
        (
          (
            y - 1
          ) *
          width +
          x
        ) *
        4;

      const bottomIndex =
        (
          (
            y + 1
          ) *
          width +
          x
        ) *
        4;

      for (
        let channel = 0;
        channel < 3;
        channel += 1
      ) {
        const original =
          sourceData[
            centerIndex +
            channel
          ];

        const sharpened =
          original * 5 -
          sourceData[
            leftIndex +
            channel
          ] -
          sourceData[
            rightIndex +
            channel
          ] -
          sourceData[
            topIndex +
            channel
          ] -
          sourceData[
            bottomIndex +
            channel
          ];

        const mixed =
          original *
            (
              1 -
              mix
            ) +
          sharpened *
            mix;

        outputData[
          centerIndex +
          channel
        ] =
          clamp(
            Math.round(
              mixed
            ),
            0,
            255
          );
      }

      outputData[
        centerIndex + 3
      ] =
        sourceData[
          centerIndex + 3
        ];
    }
  }

  ctx.putImageData(
    output,
    0,
    0
  );
}

/**
 * Auto-detect sederhana tanpa OpenCV.
 *
 * Hanya sebagai initial guess.
 * User tetap bisa geser 4 corner secara manual.
 */
export async function detectDocumentCorners(
  imageData: string,
  options: AutoDetectOptions = {}
): Promise<CornerPoints> {
  const {
    sampleSize = 420,
    edgeThreshold = 42,
    padding = 0.025,
  } = options;

  try {
    const image =
      await loadImageFromDataUrl(
        imageData
      );

    const sourceWidth =
      image.naturalWidth ||
      image.width;

    const sourceHeight =
      image.naturalHeight ||
      image.height;

    if (
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {
      return getDefaultCorners();
    }

    const ratio =
      Math.min(
        1,
        sampleSize /
          Math.max(
            sourceWidth,
            sourceHeight
          )
      );

    const width =
      Math.max(
        40,
        Math.round(
          sourceWidth *
          ratio
        )
      );

    const height =
      Math.max(
        40,
        Math.round(
          sourceHeight *
          ratio
        )
      );

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const ctx =
      canvas.getContext(
        '2d',
        {
          willReadFrequently: true,
        }
      );

    if (!ctx) {
      return getDefaultCorners();
    }

    ctx.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    const pixels =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );

    const grayscale =
      new Float32Array(
        width *
        height
      );

    for (
      let y = 0;
      y < height;
      y += 1
    ) {
      for (
        let x = 0;
        x < width;
        x += 1
      ) {
        const index =
          (
            y *
            width +
            x
          ) *
            4;

        grayscale[
          y *
            width +
          x
        ] =
          pixels.data[index] *
            0.299 +
          pixels.data[
            index + 1
          ] *
            0.587 +
          pixels.data[
            index + 2
          ] *
            0.114;
      }
    }

    let minX =
      width;

    let minY =
      height;

    let maxX =
      0;

    let maxY =
      0;

    let edgeCount =
      0;

    for (
      let y = 1;
      y < height - 1;
      y += 1
    ) {
      for (
        let x = 1;
        x < width - 1;
        x += 1
      ) {
        const current =
          y *
            width +
          x;

        const gx =
          Math.abs(
            grayscale[
              current + 1
            ] -
            grayscale[
              current - 1
            ]
          );

        const gy =
          Math.abs(
            grayscale[
              current + width
            ] -
            grayscale[
              current - width
            ]
          );

        const magnitude =
          gx +
          gy;

        if (
          magnitude >=
          edgeThreshold
        ) {
          minX =
            Math.min(
              minX,
              x
            );

          minY =
            Math.min(
              minY,
              y
            );

          maxX =
            Math.max(
              maxX,
              x
            );

          maxY =
            Math.max(
              maxY,
              y
            );

          edgeCount +=
            1;
        }
      }
    }

    const minimumEdges =
      width *
      height *
      0.003;

    if (
      edgeCount <
        minimumEdges ||
      maxX <= minX ||
      maxY <= minY
    ) {
      return getDefaultCorners();
    }

    const detectedWidth =
      maxX -
      minX;

    const detectedHeight =
      maxY -
      minY;

    if (
      detectedWidth <
        width * 0.25 ||
      detectedHeight <
        height * 0.25
    ) {
      return getDefaultCorners();
    }

    const normalizedPadding =
      clamp(
        padding,
        0,
        0.1
      );

    const left =
      clamp(
        minX / width -
          normalizedPadding,
        0.02,
        0.95
      );

    const top =
      clamp(
        minY / height -
          normalizedPadding,
        0.02,
        0.95
      );

    const right =
      clamp(
        maxX / width +
          normalizedPadding,
        0.05,
        0.98
      );

    const bottom =
      clamp(
        maxY / height +
          normalizedPadding,
        0.05,
        0.98
      );

    const detected: CornerPoints = {
      topLeft: {
        x: left,
        y: top,
      },

      topRight: {
        x: right,
        y: top,
      },

      bottomRight: {
        x: right,
        y: bottom,
      },

      bottomLeft: {
        x: left,
        y: bottom,
      },
    };

    if (
      !isValidCornerLayout(
        detected
      )
    ) {
      return getDefaultCorners();
    }

    return detected;
  } catch (error) {
    console.warn(
      'Auto document detection gagal, menggunakan corner default:',
      error
    );

    return getDefaultCorners();
  }
}

/**
 * Label filter untuk UI.
 */
export function getScanFilterLabel(
  filter: ScanFilter
): string {
  switch (filter) {
    case 'enhance':
      return 'Enhance';

    default:
      return 'Original';
  }
}
