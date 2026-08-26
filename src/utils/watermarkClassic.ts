import type { WatermarkOptions } from './watermark';

export async function addClassicWatermark(
  imageData: string,
  options: WatermarkOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');

      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas tidak tersedia.'));
        return;
      }

      // =====================================================
      // GAMBAR ASLI
      // =====================================================
      ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // =====================================================
      // UKURAN RESPONSIF
      // =====================================================
      const referenceSize = Math.min(
        canvas.width,
        canvas.height
      );

      // Sedikit lebih kecil dari versi sebelumnya (0.024)
      const fontSize = Math.max(
        14,
        Math.round(referenceSize * 0.0205)
      );

      const lineHeight = Math.round(
        fontSize * 1.28
      );

      const marginRight = Math.max(
        16,
        Math.round(canvas.width * 0.025)
      );

      const marginBottom = Math.max(
        16,
        Math.round(canvas.height * 0.025)
      );

      /*
       * Batasi lebar watermark agar alamat panjang
       * tidak memenuhi seluruh lebar foto.
       *
       * Maksimal sekitar 55% lebar foto.
       */
      const maxTextWidth = Math.min(
        canvas.width * 0.55,
        canvas.width - marginRight * 2
      );

      const rightX =
        canvas.width - marginRight;

      // =====================================================
      // DATA
      // =====================================================
      const dateAndTime = [
        options.date?.trim(),
        options.time?.trim(),
      ]
        .filter(Boolean)
        .join(' ');

      const locationText =
        options.locationText?.trim() || '';

      const coordinateText =
        formatCoordinates(
          options.latitude,
          options.longitude
        );

      /*
       * SEANANTA / appName sengaja tidak ditampilkan.
       *
       * Susunan:
       * 1. tanggal + jam
       * 2. alamat (otomatis wrap)
       * 3. koordinat
       */
      const lines: string[] = [];

      if (dateAndTime) {
        lines.push(dateAndTime);
      }

      if (locationText) {
        const addressLines = wrapText(
          ctx,
          locationText,
          maxTextWidth,
          fontSize
        );

        lines.push(...addressLines);
      }

      if (coordinateText) {
        lines.push(coordinateText);
      }

      if (lines.length === 0) {
        resolve(
          canvas.toDataURL(
            'image/jpeg',
            0.95
          )
        );

        return;
      }

      // =====================================================
      // STYLE WATERMARK CLASSIC
      // =====================================================
      ctx.save();

      ctx.fillStyle = '#FFFFFF';

      ctx.font =
        `400 ${fontSize}px Arial, Helvetica, sans-serif`;

      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';

      // Tetap tanpa shadow / background / ikon.
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      /*
       * Karena watermark berada di kanan bawah,
       * hitung posisi baris pertama dari bawah.
       */
      const firstLineY =
        canvas.height -
        marginBottom -
        lineHeight * (lines.length - 1);

      lines.forEach((line, index) => {
        const y =
          firstLineY +
          index * lineHeight;

        ctx.fillText(
          line,
          rightX,
          y
        );
      });

      ctx.restore();

      resolve(
        canvas.toDataURL(
          'image/jpeg',
          0.95
        )
      );
    };

    image.onerror = () => {
      reject(
        new Error(
          'Gagal memuat gambar untuk proses watermark.'
        )
      );
    };

    image.src = imageData;
  });
}

/**
 * Format koordinat:
 * -7.795600, 110.369500
 * menjadi:
 * 7.795600°S, 110.369500°E
 */
function formatCoordinates(
  latitude?: number | string,
  longitude?: number | string
): string {
  if (
    latitude === undefined ||
    latitude === null ||
    longitude === undefined ||
    longitude === null
  ) {
    return '';
  }

  const lat =
    typeof latitude === 'string'
      ? Number.parseFloat(latitude)
      : latitude;

  const lng =
    typeof longitude === 'string'
      ? Number.parseFloat(longitude)
      : longitude;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return '';
  }

  const latDirection =
    lat < 0 ? 'S' : 'N';

  const lngDirection =
    lng < 0 ? 'W' : 'E';

  return `${Math.abs(lat).toFixed(6)}°${latDirection}, ${Math.abs(
    lng
  ).toFixed(6)}°${lngDirection}`;
}

/**
 * Memecah alamat menjadi beberapa baris berdasarkan
 * lebar aktual teks pada canvas.
 *
 * Tidak memotong alamat dengan "...".
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  // Pastikan font sudah sama dengan font watermark
  // sebelum melakukan pengukuran.
  ctx.save();

  ctx.font =
    `400 ${fontSize}px Arial, Helvetica, sans-serif`;

  const paragraphs = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const result: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return;
    }

    let currentLine = '';

    words.forEach((word) => {
      const candidate =
        currentLine.length > 0
          ? `${currentLine} ${word}`
          : word;

      if (
        ctx.measureText(candidate).width <=
        maxWidth
      ) {
        currentLine = candidate;
        return;
      }

      if (currentLine) {
        result.push(currentLine);
      }

      /*
       * Jika satu kata sendiri lebih panjang dari area,
       * pecah berdasarkan karakter supaya tidak keluar foto.
       */
      if (
        ctx.measureText(word).width >
        maxWidth
      ) {
        const pieces = breakLongWord(
          ctx,
          word,
          maxWidth
        );

        if (pieces.length > 1) {
          result.push(
            ...pieces.slice(0, -1)
          );

          currentLine =
            pieces[pieces.length - 1];
        } else {
          currentLine =
            pieces[0] || '';
        }
      } else {
        currentLine = word;
      }
    });

    if (currentLine) {
      result.push(currentLine);
    }
  });

  ctx.restore();

  return result;
}

/**
 * Fallback untuk kata/URL sangat panjang tanpa spasi.
 */
function breakLongWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number
): string[] {
  const pieces: string[] = [];

  let current = '';

  for (const character of word) {
    const candidate =
      current + character;

    if (
      current &&
      ctx.measureText(candidate).width >
        maxWidth
    ) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}
