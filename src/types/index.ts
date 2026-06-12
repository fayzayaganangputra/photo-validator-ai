export type PhotoCategory = 'person-product' | 'signboard' | 'serial-number' | 'bast-document';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  score: number;
  details?: string;
}

export interface ValidationResult {
  overallScore: number;
  passed: boolean;
  rules: ValidationRule[];
  timestamp: Date;
  category: PhotoCategory;
}

export interface SavedPhoto {
  id: string;
  imageData: string;
  category: PhotoCategory;
  validation: ValidationResult;
  savedAt: Date;
}

export interface CategoryConfig {
  id: PhotoCategory;
  name: string;
  description: string;
  icon: string;
  rules: string[];
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'person-product',
    name: 'Person + Product',
    description: 'Photo of person with product',
    icon: 'User',
    rules: [
      'Person must be detected',
      'Product must be fully visible',
      'Product must not be covered by person',
      'Product must be centered',
      'Image must not be blurry'
    ]
  },
  {
    id: 'signboard',
    name: 'Signboard',
    description: 'Photo of signboard or signage',
    icon: 'Signpost',
    rules: [
      'Signboard must be centered',
      'Image must not be blurry'
    ]
  },
  {
    id: 'serial-number',
    name: 'Product Serial Number',
    description: 'Photo of product serial number',
    icon: 'Hash',
    rules: [
      'Text must be readable',
      'Image must not be blurry',
      'Text must be centered',
      'Text must not be cropped'
    ]
  },
  {
    id: 'bast-document',
    name: 'BAST Document',
    description: 'Photo of BAST document',
    icon: 'FileText',
    rules: [
      'Document must be centered',
      'Text must be readable',
      'Image must not be blurry',
      'Stamp may cover max 20% of text area'
    ]
  }
];
