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
      canvas.width = image.width;
      canvas.height = image.height;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas tidak tersedia'));
        return;
      }

      // ===========================
      // Gambar asli
      // ===========================
      ctx.drawImage(image, 0, 0);

      // ===========================
      // Ukuran dinamis
      // ===========================
      const padding = Math.max(24, image.width * 0.025);
      const fontTitle = Math.max(28, image.width * 0.022);
      const fontText = Math.max(22, image.width * 0.017);

      const lineHeight = fontText + 10;

      const lines = [
        options.appName,
        `${options.date} | ${options.time}`,
        options.locationText
      ];

      const boxHeight =
        padding +
        fontTitle +
        18 +
        (lines.length - 1) * lineHeight +
        padding;

      // ===========================
      // Background watermark
      // ===========================
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(
        0,
        image.height - boxHeight,
        image.width,
        boxHeight
      );

      // ===========================
      // Shadow text
      // ===========================
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // ===========================
      // Judul
      // ===========================
      let y = image.height - boxHeight + padding + fontTitle;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontTitle}px Arial`;

      ctx.fillText(
        options.appName,
        padding,
        y
      );

      // ===========================
      // Tanggal & Jam
      // ===========================
      y += lineHeight;

      ctx.font = `${fontText}px Arial`;

      ctx.fillText(
        `${options.date} | ${options.time}`,
        padding,
        y
      );

      // ===========================
      // Lokasi
      // ===========================
      y += lineHeight;

      ctx.fillText(
        options.locationText,
        padding,
        y
      );

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };

    image.onerror = () => {
      reject(new Error('Gagal memuat gambar'));
    };

    image.src = imageData;
  });
}