import {
  addClassicWatermark,
} from './watermarkClassic';

import {
  addTimemarkWatermark,
} from './watermarkTimemark';

export type WatermarkStyle =
  | 'classic'
  | 'timemark';

export interface WatermarkOptions {
  style?: WatermarkStyle;

  appName: string;
  categoryName?: string;

  date: string;
  time: string;
  locationText: string;

  latitude?: number | string;
  longitude?: number | string;

  verificationText?: string;
  verificationCode?: string;
}

export async function addWatermarkToImage(
  imageData: string,
  options: WatermarkOptions
): Promise<string> {
  const style =
    options.style ??
    'timemark';

  if (
    style ===
    'classic'
  ) {
    return addClassicWatermark(
      imageData,
      options
    );
  }

  return addTimemarkWatermark(
    imageData,
    options
  );
}