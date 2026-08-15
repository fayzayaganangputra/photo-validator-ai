export interface VerificationCodeData {
  date: string;
  time: string;
  latitude?: number | string;
  longitude?: number | string;
  categoryName?: string;
}

export async function generateVerificationCode(
  imageData: string,
  data: VerificationCodeData
): Promise<string> {
  const raw = [
    data.date,
    data.time,
    data.latitude ?? '',
    data.longitude ?? '',
    data.categoryName ?? '',
    imageData.slice(-1000),
  ].join('|');

  const encoded =
    new TextEncoder().encode(raw);

  const hashBuffer =
    await crypto.subtle.digest(
      'SHA-256',
      encoded
    );

  const bytes =
    new Uint8Array(hashBuffer);

  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let code = '';

  for (let i = 0; i < 14; i++) {
    code += alphabet[
      bytes[i] % alphabet.length
    ];
  }

  return code;
}