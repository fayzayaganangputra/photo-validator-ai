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
    name: 'Orang + Barang',
    description: 'Foto orang dengan barang',
    icon: 'User',
    rules: [
      'Orang harus terdeteksi',
      'Produk harus terlihat sepenuhnya.',
      'Produk tidak boleh tertutup oleh seseorang.',
      'Produk harus berada di tengah.',
      'Gambar tidak boleh buram.'
    ]
  },
  {
    id: 'signboard',
    name: 'Papan Nama',
    description: 'Foto papan nama atau rambu',
    icon: 'Signpost',
    rules: [
      'Papan nama harus berada di tengah.',
      'Gambar tidak boleh buram.'
    ]
  },
  {
    id: 'serial-number',
    name: 'Nomor Seri',
    description: 'Foto nomor seri produk',
    icon: 'Hash',
    rules: [
      'Teks harus mudah dibaca.',
      'Gambar tidak boleh buram.',
      'Teks harus berada di tengah.',
      'Teks tidak boleh terpotong'
    ]
  },
  {
    id: 'bast-document',
    name: 'BAST Dokumen',
    description: 'Foto dokumen BAST',
    icon: 'FileText',
    rules: [
      'Dokumen harus berada di tengah.',
      'Teks harus mudah dibaca.',
      'Gambar tidak boleh buram.',
      'Stempel dapat menutupi maksimal 20% area teks.'
    ]
  }
];
