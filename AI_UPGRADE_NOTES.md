# AI Upgrade Notes

Project ini sudah di-upgrade dari validasi berbasis Canvas menjadi validasi dengan integrasi AI browser/offline-first.

## Dependency baru

```bash
npm install @tensorflow/tfjs @tensorflow-models/coco-ssd tesseract.js
```

## Integrasi AI yang ditambahkan

### 1. TensorFlow.js + COCO-SSD
Dipakai untuk kategori **Person + Product**:
- deteksi orang
- deteksi objek/barang umum
- hitung overlap person vs product
- barang dianggap tidak valid jika overlap > 25%

Catatan: COCO-SSD mendeteksi objek umum. Untuk barang/plang spesifik, akurasi terbaik butuh custom model.

### 2. Tesseract.js OCR
Dipakai untuk:
- Serial Number
- BAST Document

Validasi:
- confidence OCR
- panjang teks terbaca
- text readability

### 3. Estimasi cap menimpa tulisan 20%
Dipakai untuk BAST:
- OCR mencari bounding box kata
- sistem mencari pixel seperti cap/stempel pada area text box
- menghitung estimasi overlap cap terhadap text area

Catatan: untuk presisi tinggi, perlu custom stamp segmentation.

## Offline behavior

Aplikasi tetap PWA/offline-first.
Namun model AI perlu dibuka pertama kali dengan internet agar file model dan worker ter-cache.
Setelah itu aplikasi bisa digunakan offline selama browser tidak menghapus cache.

## File yang diubah

- `src/utils/validation.ts`
- `package.json`
- `public/sw.js`
