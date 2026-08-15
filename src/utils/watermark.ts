export interface WatermarkOptions {
  appName: string;
  categoryName?: string;
  date: string;
  time: string;
  locationText: string;

  latitude?: number | string;
  longitude?: number | string;

  verificationText?: string;
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

      const width = canvas.width;
      const height = canvas.height;

      const referenceSize = Math.min(
        width,
        height
      );

      // =====================================================
      // UKURAN RESPONSIVE
      // =====================================================
      const marginLeft = Math.max(
        20,
        Math.round(width * 0.025)
      );

      const marginRight = Math.max(
        20,
        Math.round(width * 0.025)
      );

      const marginBottom = Math.max(
        24,
        Math.round(height * 0.03)
      );

      const mainFontSize = Math.max(
        18,
        Math.round(referenceSize * 0.03)
      );

      const dateFontSize = Math.max(
        19,
        Math.round(referenceSize * 0.031)
      );

      const coordinateFontSize = Math.max(
        17,
        Math.round(referenceSize * 0.028)
      );

      const verificationFontSize = Math.max(
        15,
        Math.round(referenceSize * 0.024)
      );

      const timeFontSize = Math.max(
        38,
        Math.round(referenceSize * 0.068)
      );

      const brandFontSize = Math.max(
        22,
        Math.round(referenceSize * 0.04)
      );

      const brandSubFontSize = Math.max(
        14,
        Math.round(referenceSize * 0.021)
      );

      const lineHeight = Math.round(
        mainFontSize * 1.3
      );

      const textOffsetFromLine = Math.max(
        14,
        Math.round(referenceSize * 0.024)
      );

      const maxTextWidth =
        width -
        marginLeft -
        marginRight -
        textOffsetFromLine;

      // =====================================================
      // DATA
      // =====================================================
      const appName =
        options.appName?.trim() ||
        'Timemark';

      const date =
        options.date?.trim() || '';

      const time =
        options.time?.trim() || '';

      const locationText =
        options.locationText?.trim() || '';

      const verificationText =
        options.verificationText?.trim() ||
        `${appName} menjamin keaslian waktu`;

      const coordinates =
        formatCoordinates(
          options.latitude,
          options.longitude
        );

      ctx.save();

      // =====================================================
      // ALAMAT MULTILINE
      // =====================================================
      ctx.font =
        `400 ${mainFontSize}px Arial, Helvetica, sans-serif`;

      const locationLines = wrapText(
        ctx,
        locationText,
        maxTextWidth
      );

      // =====================================================
      // UKURAN KOTAK JAM
      // =====================================================
      ctx.font =
        `800 ${timeFontSize}px Arial, Helvetica, sans-serif`;

      const measuredTimeWidth =
        ctx.measureText(
          time || '00:00'
        ).width;

      const timeHorizontalPadding =
        Math.round(
          timeFontSize * 0.32
        );

      const timeVerticalPadding =
        Math.round(
          timeFontSize * 0.18
        );

      const timeBoxWidth =
        measuredTimeWidth +
        timeHorizontalPadding * 2;

      const timeBoxHeight =
        timeFontSize +
        timeVerticalPadding * 2;

      const timeBoxRadius =
        Math.max(
          12,
          Math.round(
            timeBoxHeight * 0.16
          )
        );

      // =====================================================
      // JARAK ANTAR BAGIAN
      // =====================================================
      const gapAfterTime =
        Math.round(
          referenceSize * 0.02
        );

      const gapAfterDate =
        Math.round(
          referenceSize * 0.018
        );

      const gapAfterLocation =
        Math.round(
          referenceSize * 0.02
        );

      const gapBeforeVerification =
        Math.round(
          referenceSize * 0.025
        );

      const dateHeight =
        Math.round(
          dateFontSize * 1.25
        );

      const locationHeight =
        locationLines.length *
        lineHeight;

      const coordinateHeight =
        coordinates
          ? Math.round(
              coordinateFontSize * 1.3
            )
          : 0;

      const verificationHeight =
        Math.round(
          verificationFontSize * 1.35
        );

      const contentHeight =
        timeBoxHeight +
        gapAfterTime +
        dateHeight +
        gapAfterDate +
        locationHeight +
        gapAfterLocation +
        coordinateHeight +
        gapBeforeVerification +
        verificationHeight;

      let startY =
        height -
        marginBottom -
        contentHeight;

      const minimumTop =
        Math.round(
          height * 0.12
        );

      if (startY < minimumTop) {
        startY = minimumTop;
      }

      // =====================================================
      // KOTAK JAM
      // =====================================================
      const timeBoxX =
        marginLeft;

      const timeBoxY =
        startY;

      ctx.save();

      drawRoundedRect(
        ctx,
        timeBoxX,
        timeBoxY,
        timeBoxWidth,
        timeBoxHeight,
        timeBoxRadius
      );

      ctx.fillStyle =
        'rgba(255,255,255,0.97)';

      ctx.fill();

      ctx.strokeStyle =
        'rgba(255,255,255,0.78)';

      ctx.lineWidth =
        Math.max(
          1,
          Math.round(
            referenceSize * 0.0015
          )
        );

      ctx.stroke();

      // =====================================================
      // JAM GRADIENT
      // =====================================================
      const timeGradient =
        ctx.createLinearGradient(
          0,
          timeBoxY,
          0,
          timeBoxY + timeBoxHeight
        );

      timeGradient.addColorStop(
        0,
        '#0B67D1'
      );

      timeGradient.addColorStop(
        0.42,
        '#064B9E'
      );

      timeGradient.addColorStop(
        0.72,
        '#062B5A'
      );

      timeGradient.addColorStop(
        1,
        '#061426'
      );

      ctx.fillStyle =
        timeGradient;

      ctx.font =
        `800 ${timeFontSize}px Arial, Helvetica, sans-serif`;

      ctx.textAlign =
        'center';

      ctx.textBaseline =
        'middle';

      // Tidak menggunakan shadow pada angka
      ctx.shadowColor =
        'transparent';

      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // =====================================================
      // OFFSET OPTIK
      // Angka diturunkan sedikit agar terlihat benar-benar center
      // =====================================================
      const timeVerticalOffset =
        Math.max(
          2,
          Math.round(
            timeBoxHeight * 0.045
          )
        );

      ctx.fillText(
        time || '--:--',
        timeBoxX +
          timeBoxWidth / 2,
        timeBoxY +
          timeBoxHeight / 2 +
          timeVerticalOffset
      );

      ctx.restore();

      // =====================================================
      // KONTEN SETELAH JAM
      // =====================================================
      let currentY =
        timeBoxY +
        timeBoxHeight +
        gapAfterTime;

      const yellowLineX =
        marginLeft;

      const textX =
        marginLeft +
        textOffsetFromLine;

      // =====================================================
      // GARIS KUNING
      // =====================================================
      const yellowLineTop =
        currentY -
        Math.round(
          dateFontSize * 0.08
        );

      const yellowLineBottom =
        currentY +
        dateHeight +
        gapAfterDate +
        locationHeight +
        gapAfterLocation +
        coordinateHeight -
        Math.round(
          mainFontSize * 0.15
        );

      ctx.save();

      ctx.beginPath();

      ctx.strokeStyle =
        '#FFC72C';

      ctx.lineWidth =
        Math.max(
          4,
          Math.round(
            referenceSize * 0.006
          )
        );

      ctx.lineCap =
        'butt';

      ctx.moveTo(
        yellowLineX,
        yellowLineTop
      );

      ctx.lineTo(
        yellowLineX,
        yellowLineBottom
      );

      ctx.stroke();

      ctx.restore();

      // =====================================================
      // SHADOW TEKS PUTIH
      // =====================================================
      ctx.shadowColor =
        'rgba(0,0,0,0.68)';

      ctx.shadowBlur =
        Math.max(
          2,
          Math.round(
            referenceSize * 0.004
          )
        );

      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.textAlign =
        'left';

      ctx.textBaseline =
        'top';

      // =====================================================
      // TANGGAL
      // =====================================================
      ctx.fillStyle =
        '#FFFFFF';

      ctx.font =
        `700 ${dateFontSize}px Arial, Helvetica, sans-serif`;

      ctx.fillText(
        date,
        textX,
        currentY,
        maxTextWidth
      );

      currentY +=
        dateHeight +
        gapAfterDate;

      // =====================================================
      // ALAMAT
      // =====================================================
      ctx.font =
        `400 ${mainFontSize}px Arial, Helvetica, sans-serif`;

      locationLines.forEach(
        (line) => {
          ctx.fillText(
            line,
            textX,
            currentY,
            maxTextWidth
          );

          currentY +=
            lineHeight;
        }
      );

      currentY +=
        gapAfterLocation;

      // =====================================================
      // KOORDINAT
      // =====================================================
      if (coordinates) {
        ctx.font =
          `400 ${coordinateFontSize}px Arial, Helvetica, sans-serif`;

        ctx.fillText(
          coordinates,
          textX,
          currentY,
          maxTextWidth
        );

        currentY +=
          Math.round(
            coordinateFontSize * 1.3
          );
      }

      currentY +=
        gapBeforeVerification;

      // =====================================================
      // VERIFICATION TEXT
      // =====================================================
      ctx.shadowColor =
        'rgba(0,0,0,0.48)';

      ctx.font =
        `400 ${verificationFontSize}px Arial, Helvetica, sans-serif`;

      ctx.fillStyle =
        'rgba(255,255,255,0.86)';

      const shieldSize =
        Math.round(
          verificationFontSize * 1.18
        );

      drawShieldIcon(
        ctx,
        marginLeft,
        currentY,
        shieldSize
      );

      ctx.fillText(
        verificationText,
        marginLeft +
          shieldSize +
          Math.round(
            referenceSize * 0.012
          ),
        currentY,
        width -
          marginLeft -
          marginRight -
          shieldSize
      );

      // =====================================================
      // LOGO TIMEMARK KANAN ATAS
      // =====================================================
      drawTimeMarkBrand(
        ctx,
        width,
        referenceSize,
        brandFontSize,
        brandSubFontSize
      );

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

// =====================================================
// WRAP TEXT
// =====================================================
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) {
    return [];
  }

  const words =
    text
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ');

  const lines: string[] =
    [];

  let currentLine =
    '';

  words.forEach(
    (word) => {
      const testLine =
        currentLine.length > 0
          ? `${currentLine} ${word}`
          : word;

      const measuredWidth =
        ctx.measureText(
          testLine
        ).width;

      if (
        measuredWidth <=
          maxWidth ||
        currentLine.length ===
          0
      ) {
        currentLine =
          testLine;
      } else {
        lines.push(
          currentLine
        );

        currentLine =
          word;
      }
    }
  );

  if (currentLine) {
    lines.push(
      currentLine
    );
  }

  return lines;
}

// =====================================================
// FORMAT KOORDINAT
// =====================================================
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
    typeof latitude ===
    'string'
      ? Number.parseFloat(
          latitude
        )
      : latitude;

  const lng =
    typeof longitude ===
    'string'
      ? Number.parseFloat(
          longitude
        )
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

  return `${Math.abs(
    lat
  ).toFixed(
    6
  )}°${latDirection}, ${Math.abs(
    lng
  ).toFixed(
    6
  )}°${lngDirection}`;
}

// =====================================================
// ROUNDED RECT
// =====================================================
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r =
    Math.min(
      radius,
      width / 2,
      height / 2
    );

  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x +
      width -
      r,
    y
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r
  );

  ctx.lineTo(
    x + width,
    y +
      height -
      r
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x +
      width -
      r,
    y + height
  );

  ctx.lineTo(
    x + r,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y +
      height -
      r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}

// =====================================================
// SHIELD ICON
// =====================================================
function drawShieldIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.save();

  ctx.strokeStyle =
    'rgba(255,255,255,0.76)';

  ctx.lineWidth =
    Math.max(
      2,
      size * 0.1
    );

  ctx.lineCap =
    'round';

  ctx.lineJoin =
    'round';

  ctx.beginPath();

  ctx.moveTo(
    x +
      size / 2,
    y
  );

  ctx.lineTo(
    x + size,
    y +
      size *
        0.2
  );

  ctx.lineTo(
    x +
      size *
        0.9,
    y +
      size *
        0.7
  );

  ctx.quadraticCurveTo(
    x +
      size / 2,
    y + size,
    x +
      size *
        0.1,
    y +
      size *
        0.7
  );

  ctx.lineTo(
    x,
    y +
      size *
        0.2
  );

  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    x +
      size *
        0.27,
    y +
      size *
        0.48
  );

  ctx.lineTo(
    x +
      size *
        0.44,
    y +
      size *
        0.64
  );

  ctx.lineTo(
    x +
      size *
        0.74,
    y +
      size *
        0.34
  );

  ctx.stroke();

  ctx.restore();
}

// =====================================================
// LOGO TIMEMARK KANAN ATAS
// TIME = KUNING
// MARK = PUTIH
// SUBTITLE = FOTO 100% AKURAT
// =====================================================
function drawTimeMarkBrand(
  ctx: CanvasRenderingContext2D,
  width: number,
  referenceSize: number,
  fontSize: number,
  subFontSize: number
): void {
  const margin =
    Math.max(
      18,
      Math.round(
        width * 0.025
      )
    );

  const brandY =
    margin;

  ctx.save();

  ctx.textBaseline =
    'top';

  ctx.shadowColor =
    'rgba(0,0,0,0.45)';

  ctx.shadowBlur =
    Math.max(
      2,
      Math.round(
        referenceSize *
          0.003
      )
    );

  ctx.shadowOffsetX =
    1;

  ctx.shadowOffsetY =
    1;

  ctx.font =
    `700 ${fontSize}px Arial, Helvetica, sans-serif`;

  const timeText =
    'Time';

  const markText =
    'mark';

  const timeWidth =
    ctx.measureText(
      timeText
    ).width;

  const markWidth =
    ctx.measureText(
      markText
    ).width;

  const totalWidth =
    timeWidth +
    markWidth;

  const brandStartX =
    width -
    margin -
    totalWidth;

  ctx.textAlign =
    'left';

  // TIME kuning
  ctx.fillStyle =
    '#FFC72C';

  ctx.fillText(
    timeText,
    brandStartX,
    brandY
  );

  // MARK putih
  ctx.fillStyle =
    '#FFFFFF';

  ctx.fillText(
    markText,
    brandStartX +
      timeWidth,
    brandY
  );

  // Subtitle
  ctx.font =
    `400 ${subFontSize}px Arial, Helvetica, sans-serif`;

  ctx.fillStyle =
    'rgba(255,255,255,0.92)';

  ctx.textAlign =
    'right';

  ctx.fillText(
    'Foto 100% akurat',
    width -
      margin,
    brandY +
      Math.round(
        fontSize * 1.18
      )
  );

  ctx.restore();
}