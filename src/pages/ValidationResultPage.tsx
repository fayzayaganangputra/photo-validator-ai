import React, { useState } from 'react';
import {
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Save,
  RotateCcw,
  Calendar,
  Clock,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';

import {
  Header,
  Button,
  Card,
  CardContent,
  Badge,
  ProgressBar,
  ValidationRuleItem,
} from '../components/ui';

import {
  CATEGORIES,
  ValidationResult,
} from '../types';

import { savePhoto } from '../utils/storage';
import { addWatermarkToImage } from '../utils/watermark';

interface ValidationLocationState {
  imageData?: string;
  validation?: ValidationResult;
}

const getCurrentDateInput = (): string => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCurrentTimeInput = (): string => {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const formatDateToIndonesian = (dateValue: string): string => {
  if (!dateValue) {
    return '';
  }

  const dateParts = dateValue.split('-');

  if (dateParts.length !== 3) {
    return dateValue;
  }

  const [year, month, day] = dateParts;

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const monthIndex = Number(month) - 1;
  const monthName = monthNames[monthIndex];

  if (!monthName) {
    return dateValue;
  }

  return `${Number(day)} ${monthName} ${year}`;
};

export const ValidationResultPage: React.FC = () => {
  const { categoryId } = useParams<{
    categoryId: string;
  }>();

  const routerLocation = useLocation();
  const navigate = useNavigate();

  const locationState =
    routerLocation.state as ValidationLocationState | null;

  const imageData = locationState?.imageData;
  const validation = locationState?.validation;

  const [expandedRule, setExpandedRule] =
    useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [watermarkDate, setWatermarkDate] = useState(
    getCurrentDateInput()
  );

  const [watermarkTime, setWatermarkTime] = useState(
    getCurrentTimeInput()
  );

  const [watermarkLocation, setWatermarkLocation] =
    useState('');

  const [formError, setFormError] = useState('');
  const [saveError, setSaveError] = useState('');

  const category = CATEGORIES.find(
    (item) => item.id === categoryId
  );

  if (!imageData || !validation || !category) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />

          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Tidak ada foto untuk diverifikasi
          </h2>

          <p className="text-slate-600 mb-6">
            Silakan ambil foto terlebih dahulu.
          </p>

          <Button onClick={() => navigate('/')}>
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    );
  }

  const handleRetake = (): void => {
    navigate(`/capture/${categoryId}`, {
      replace: true,
    });
  };

  const validateWatermarkForm = (): boolean => {
    if (!watermarkDate) {
      setFormError('Tanggal watermark wajib diisi.');
      return false;
    }

    if (!watermarkTime) {
      setFormError('Jam watermark wajib diisi.');
      return false;
    }

    if (!watermarkLocation.trim()) {
      setFormError('Lokasi watermark wajib diisi.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleSave = async (): Promise<void> => {
  if (isSaving || saved) {
    return;
  }

  if (!validateWatermarkForm()) {
    console.warn('Form watermark belum lengkap', {
      watermarkDate,
      watermarkTime,
      watermarkLocation,
    });

    return;
  }

  setIsSaving(true);
  setSaveError('');

  try {
    const formattedDate =
      formatDateToIndonesian(watermarkDate);

    console.log('===== PROSES WATERMARK DIMULAI =====');
    console.log('Foto asli tersedia:', Boolean(imageData));
    console.log('Panjang data foto asli:', imageData.length);
    console.log('Kategori:', category.name);
    console.log('Tanggal input:', watermarkDate);
    console.log('Tanggal hasil format:', formattedDate);
    console.log('Jam:', watermarkTime);
    console.log('Lokasi:', watermarkLocation.trim());

    const watermarkedImage =
      await addWatermarkToImage(imageData, {
        appName: 'SEANANTA',
        categoryName: category.name,
        date: formattedDate,
        time: `${watermarkTime} WIB`,
        locationText: watermarkLocation.trim(),
      });

    console.log('Watermark berhasil dibuat:', Boolean(watermarkedImage));
    console.log(
      'Panjang data foto setelah watermark:',
      watermarkedImage.length
    );
    console.log(
      'Foto asli dan watermark berbeda:',
      imageData !== watermarkedImage
    );

    await savePhoto(
      watermarkedImage,
      validation.category,
      validation
    );

    console.log(
      'Foto berhasil disimpan ke galeri lokal aplikasi'
    );

    const link = document.createElement('a');

    const safeCategoryName = validation.category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const fileName =
      `${safeCategoryName || 'foto'}-${Date.now()}.jpg`;

    link.href = watermarkedImage;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Download foto dijalankan:', fileName);
    console.log('===== PROSES WATERMARK SELESAI =====');

    setSaved(true);

    window.setTimeout(() => {
      navigate('/gallery', {
        replace: true,
      });
    }, 1500);
  } catch (error) {
    console.error(
      '===== PROSES WATERMARK GAGAL =====',
      error
    );

    setSaveError(
      'Foto gagal disimpan. Silakan periksa data watermark dan coba kembali.'
    );
  } finally {
    setIsSaving(false);
  }
};

  const getScoreColor = (score: number): string => {
    if (score >= 80) {
      return 'text-emerald-600';
    }

    if (score >= 60) {
      return 'text-amber-600';
    }

    return 'text-red-600';
  };

  const getScoreBackground = (
    score: number
  ): string => {
    if (score >= 80) {
      return 'bg-emerald-50 border-emerald-200';
    }

    if (score >= 60) {
      return 'bg-amber-50 border-amber-200';
    }

    return 'bg-red-50 border-red-200';
  };

  const toggleRule = (ruleId: string): void => {
    setExpandedRule((previousRule) =>
      previousRule === ruleId ? null : ruleId
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header
        title="Hasil Validasi"
        showBack
      />

      <div className="max-w-lg mx-auto">
        {/* Preview foto asli */}
        <div className="relative bg-black flex items-center justify-center">
          <img
            src={imageData}
            alt="Hasil foto validasi"
            className="w-full h-auto max-h-[70vh] object-contain"
          />

          <div className="absolute top-4 left-4">
            <Badge
              variant={
                validation.passed
                  ? 'success'
                  : 'danger'
              }
              size="sm"
            >
              {category.name}
            </Badge>
          </div>
        </div>

        <div className="p-4 -mt-1 relative z-10">
          {/* Ringkasan hasil validasi */}
          <Card
            className={`${getScoreBackground(
              validation.overallScore
            )} border-2`}
          >
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {validation.passed ? (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-7 h-7 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <XCircle className="w-7 h-7 text-red-600" />
                    </div>
                  )}

                  <div>
                    <h2
                      className={`text-xl font-bold ${getScoreColor(
                        validation.overallScore
                      )}`}
                    >
                      {validation.passed
                        ? 'Valid'
                        : 'Tidak Valid'}
                    </h2>

                    <p className="text-slate-600">
                      {validation.passed
                        ? 'Foto memenuhi semua persyaratan'
                        : 'Beberapa persyaratan tidak terpenuhi'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-slate-900">
                  {validation.overallScore}
                </span>

                <span className="text-lg text-slate-500">
                  / 100
                </span>

                <div className="flex-1">
                  <ProgressBar
                    value={validation.overallScore}
                    size="lg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detail aturan validasi */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Detail Validasi
            </h3>

            <div className="space-y-2">
              {validation.rules.map((rule) => (
                <ValidationRuleItem
                  key={rule.id}
                  rule={rule}
                  expanded={
                    expandedRule === rule.id
                  }
                  onToggle={() =>
                    toggleRule(rule.id)
                  }
                />
              ))}
            </div>
          </div>

          {/* Form watermark manual */}
          {validation.passed && (
            <div className="mt-6">
              <Card>
                <CardContent className="py-5">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Informasi Watermark
                      </h3>

                      <p className="text-sm text-slate-600 mt-1">
                        Atur tanggal, jam, dan lokasi
                        yang akan ditempel permanen pada
                        foto saat disimpan.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Tanggal */}
                    <div>
                      <label
                        htmlFor="watermark-date"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Tanggal
                      </label>

                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />

                        <input
                          id="watermark-date"
                          type="date"
                          value={watermarkDate}
                          onChange={(event) => {
                            setWatermarkDate(
                              event.target.value
                            );
                            setFormError('');
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    {/* Jam */}
                    <div>
                      <label
                        htmlFor="watermark-time"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Jam
                      </label>

                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />

                        <input
                          id="watermark-time"
                          type="time"
                          value={watermarkTime}
                          onChange={(event) => {
                            setWatermarkTime(
                              event.target.value
                            );
                            setFormError('');
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    {/* Lokasi manual */}
                    <div>
                      <label
                        htmlFor="watermark-location"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Lokasi
                      </label>

                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />

                        <textarea
                          id="watermark-location"
                          value={watermarkLocation}
                          onChange={(event) => {
                            setWatermarkLocation(
                              event.target.value
                            );
                            setFormError('');
                          }}
                          rows={3}
                          maxLength={150}
                          placeholder="Contoh: Workshop PT ABC, Kalasan, Sleman"
                          className="w-full resize-none rounded-xl border border-slate-300 bg-white pl-11 pr-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div className="flex justify-between mt-1.5">
                        <p className="text-xs text-slate-500">
                          Lokasi dapat diisi secara manual.
                        </p>

                        <p className="text-xs text-slate-400">
                          {watermarkLocation.length}/150
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contoh watermark */}
                  <div className="mt-5 rounded-xl bg-slate-900 p-4 text-white">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                      Pratinjau teks watermark
                    </p>

                    <p className="font-bold">
                      SEANANTA
                    </p>

                    <p className="text-sm mt-1">
                    {formatDateToIndonesian(
                      watermarkDate
                     ) || 'Tanggal belum diisi'}
                      {' '}
                      {watermarkTime
                    ? `${watermarkTime} WIB`
                    : 'Jam belum diisi'}
                   </p>

                    <p className="text-sm mt-1 break-words">
                      {watermarkLocation.trim() ||
                        'Lokasi belum diisi'}
                    </p>
                  </div>

                  {formError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">
                        {formError}
                      </p>
                    </div>
                  )}

                  {saveError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">
                        {saveError}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tombol aksi */}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={handleRetake}
              fullWidth
              disabled={isSaving}
              icon={
                <RotateCcw className="w-4 h-4" />
              }
            >
              Ambil Ulang Foto
            </Button>

            {validation.passed && (
              <Button
                onClick={handleSave}
                fullWidth
                loading={isSaving}
                disabled={saved || isSaving}
                icon={
                  saved ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )
                }
              >
                {saved
                  ? 'Foto Berhasil Disimpan'
                  : 'Beri Watermark dan Simpan'}
              </Button>
            )}
          </div>

          {!validation.passed && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Catatan:</strong> Validasi
                foto gagal. Silakan ambil foto ulang
                dengan memenuhi semua persyaratan
                sebelum menyimpannya.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};