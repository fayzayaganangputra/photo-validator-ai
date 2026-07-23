export interface WatermarkOptions {
  appName: string;
  categoryName?: string;
  date: string;
  time: string;
  locationText: string;
}

export async function addWatermarkToImage(
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

      // Gambar asli
      ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      /*
       * Tampilan dibuat menyerupai timestamp kamera:
       * - posisi kiri bawah
       * - teks putih
       * - tanpa background
       * - tanpa shadow
       * - tanpa ikon
       * - ukuran seluruh baris sama
       * - font normal
       */
      const referenceSize = Math.min(
        canvas.width,
        canvas.height
      );

      const fontSize = Math.max(
        16,
        Math.round(referenceSize * 0.024)
      );

      const lineHeight = Math.round(fontSize * 1.25);

      const marginLeft = Math.max(
        16,
        Math.round(canvas.width * 0.025)
      );

      const marginBottom = Math.max(
        16,
        Math.round(canvas.height * 0.025)
      );

      const maxTextWidth =
        canvas.width - marginLeft * 2;

      const appName =
        options.appName.trim() || 'SEANANTA';

      const dateAndTime = [
        options.date.trim(),
        options.time.trim(),
      ]
        .filter(Boolean)
        .join(' ');

      const locationText =
        options.locationText.trim();

      const lines = [
        appName,
        dateAndTime,
        locationText,
      ].filter((line) => line.length > 0);

      ctx.save();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Pastikan tidak ada efek apa pun
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      const firstLineY =
        canvas.height -
        marginBottom -
        lineHeight * (lines.length - 1);

      lines.forEach((line, index) => {
        const y =
          firstLineY + index * lineHeight;

        ctx.fillText(
          fitTextToWidth(
            ctx,
            line,
            maxTextWidth
          ),
          marginLeft,
          y,
          maxTextWidth
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

function fitTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const suffix = '...';
  let shortenedText = text;

  while (
    shortenedText.length > 0 &&
    ctx.measureText(
      shortenedText + suffix
    ).width > maxWidth
  ) {
    shortenedText =
      shortenedText.slice(0, -1);
  }

  return shortenedText
    ? shortenedText + suffix
    : suffix;
}