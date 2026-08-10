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
  LocateFixed,
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

interface Coordinates {
  latitude: number;
  longitude: number;
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

  const [yearString, monthString, dayString] = dateParts;

  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return dateValue;
  }

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

  const dayNames = [
    'Minggu',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
  ];

  const monthName = monthNames[month - 1];

  if (!monthName) {
    return dateValue;
  }

  // Dibuat dengan constructor lokal agar tanggal tidak bergeser karena timezone.
  const localDate = new Date(year, month - 1, day);
  const dayName = dayNames[localDate.getDay()];

  return `${dayName}, ${day} ${monthName} ${year}`;
};

const formatCoordinatePreview = (
  coordinates: Coordinates | null
): string => {
  if (!coordinates) {
    return 'Koordinat belum diambil';
  }

  const latDirection =
    coordinates.latitude < 0 ? 'S' : 'N';

  const lngDirection =
    coordinates.longitude < 0 ? 'W' : 'E';

  return `${Math.abs(coordinates.latitude).toFixed(6)}°${latDirection}, ${Math.abs(
    coordinates.longitude
  ).toFixed(6)}°${lngDirection}`;
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

  const [coordinates, setCoordinates] =
    useState<Coordinates | null>(null);

  const [isGettingLocation, setIsGettingLocation] =
    useState(false);

  const [locationError, setLocationError] =
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

  const handleGetCurrentLocation = (): void => {
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError(
        'Perangkat atau browser ini tidak mendukung GPS/geolocation.'
      );
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationError('');
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);

        let message =
          'Lokasi GPS tidak dapat diambil. Pastikan izin lokasi aktif.';

        if (error.code === error.PERMISSION_DENIED) {
          message =
            'Izin lokasi ditolak. Aktifkan izin lokasi untuk PWA/browser lalu coba lagi.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message =
            'Posisi GPS tidak tersedia saat ini. Coba pindah ke area dengan sinyal lokasi lebih baik.';
        } else if (error.code === error.TIMEOUT) {
          message =
            'Pengambilan lokasi terlalu lama. Silakan coba lagi.';
        }

        setLocationError(message);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
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
        coordinates,
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
      console.log('Koordinat:', coordinates);

      const watermarkedImage =
        await addWatermarkToImage(imageData, {
          appName: 'SEANANTA',
          categoryName: category.name,
          date: formattedDate,
          time: watermarkTime,
          locationText: watermarkLocation.trim(),
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          verificationText:
            'SEANANTA menjamin keaslian waktu',
        });

      console.log(
        'Watermark berhasil dibuat:',
        Boolean(watermarkedImage)
      );

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

      console.log(
        'Download foto dijalankan:',
        fileName
      );

      console.log(
        '===== PROSES WATERMARK SELESAI ====='
      );

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

          {/* Form watermark */}
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
                        Data berikut akan ditempel permanen pada
                        foto setelah validasi berhasil.
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

                    {/* Alamat/lokasi */}
                    <div>
                      <label
                        htmlFor="watermark-location"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Alamat / Lokasi
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
                          rows={4}
                          maxLength={300}
                          placeholder="Contoh: Workshop PT ABC, Kalasan, Sleman, Daerah Istimewa Yogyakarta"
                          className="w-full resize-none rounded-xl border border-slate-300 bg-white pl-11 pr-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div className="flex justify-between mt-1.5 gap-3">
                        <p className="text-xs text-slate-500">
                          Alamat panjang akan otomatis menjadi beberapa baris pada watermark.
                        </p>

                        <p className="text-xs text-slate-400 flex-shrink-0">
                          {watermarkLocation.length}/300
                        </p>
                      </div>
                    </div>

                    {/* Koordinat GPS */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Koordinat GPS
                      </label>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <LocateFixed className="w-4 h-4 text-emerald-700" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 break-words">
                              {formatCoordinatePreview(
                                coordinates
                              )}
                            </p>

                            <p className="text-xs text-slate-500 mt-1">
                              Koordinat bersifat opsional. Jika diambil,
                              koordinat akan tampil di bawah alamat pada watermark.
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Button
                            variant="outline"
                            fullWidth
                            onClick={
                              handleGetCurrentLocation
                            }
                            disabled={
                              isGettingLocation ||
                              isSaving
                            }
                            icon={
                              <LocateFixed className="w-4 h-4" />
                            }
                          >
                            {isGettingLocation
                              ? 'Mengambil Lokasi GPS...'
                              : coordinates
                                ? 'Perbarui Lokasi GPS'
                                : 'Ambil Lokasi GPS'}
                          </Button>
                        </div>
                      </div>

                      {locationError && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs text-amber-800">
                            {locationError}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview watermark baru */}
                  <div className="mt-5 overflow-hidden rounded-2xl bg-slate-800 p-4 text-white shadow-inner">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-lg bg-white px-3 py-1.5">
                        <p className="text-3xl leading-none font-extrabold tracking-tight text-blue-900">
                          {watermarkTime || '--:--'}
                        </p>
                      </div>

                      <div className="text-right leading-tight">
                        <p className="font-bold text-amber-400">
                          SEANANTA
                        </p>
                        <p className="text-xs text-white/70 mt-1">
                          Foto terverifikasi
                        </p>
                      </div>
                    </div>

                    <div className="relative mt-4 pl-4">
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-amber-400" />

                      <p className="font-bold text-base">
                        {formatDateToIndonesian(
                          watermarkDate
                        ) || 'Tanggal belum diisi'}
                      </p>

                      <p className="text-sm mt-3 whitespace-pre-wrap break-words leading-relaxed">
                        {watermarkLocation.trim() ||
                          'Lokasi belum diisi'}
                      </p>

                      <p className="text-sm mt-3">
                        {formatCoordinatePreview(
                          coordinates
                        )}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-white/70">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-xs">
                        SEANANTA menjamin keaslian waktu
                      </p>
                    </div>
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