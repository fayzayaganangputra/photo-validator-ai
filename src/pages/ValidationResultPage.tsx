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
import {
  addWatermarkToImage,
  type WatermarkStyle,
} from '../utils/watermark';

interface ValidationLocationState {
  imageData?: string;
  validation?: ValidationResult;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

type AddressMode = 'auto' | 'manual';

interface NominatimReverseResponse {
  display_name?: string;
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


const generateVerificationCodePreview = async (
  imageData: string,
  data: {
    date: string;
    time: string;
    latitude?: number;
    longitude?: number;
    categoryName?: string;
  }
): Promise<string> => {
  const raw = [
    data.date,
    data.time,
    data.latitude ?? '',
    data.longitude ?? '',
    data.categoryName ?? '',
    imageData.slice(-1000),
  ].join('|');

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  if (window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(raw);

    const hashBuffer = await window.crypto.subtle.digest(
      'SHA-256',
      encoded
    );

    const bytes = new Uint8Array(hashBuffer);

    let code = '';

    for (let index = 0; index < 14; index += 1) {
      code += alphabet[
        bytes[index % bytes.length] % alphabet.length
      ];
    }

    return code;
  }

  // Fallback sederhana jika Web Crypto tidak tersedia.
  let hash = 2166136261;

  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let fallbackCode = '';
  let seed = hash >>> 0;

  for (let index = 0; index < 14; index += 1) {
    seed =
      (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    fallbackCode += alphabet[
      seed % alphabet.length
    ];
  }

  return fallbackCode;
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

  const [addressMode, setAddressMode] =
    useState<AddressMode>('manual');

  const [coordinates, setCoordinates] =
    useState<Coordinates | null>(null);

  const [isGettingLocation, setIsGettingLocation] =
    useState(false);

  const [isGeneratingAddress, setIsGeneratingAddress] =
    useState(false);

  const [locationError, setLocationError] =
    useState('');

  const [formError, setFormError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [verificationCode, setVerificationCode] = useState('');

  const [watermarkStyle, setWatermarkStyle] =
    useState<WatermarkStyle>('timemark');

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
    setVerificationCode('');

    navigate(`/capture/${categoryId}`, {
      replace: true,
    });
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            'Perangkat atau browser ini tidak mendukung GPS/geolocation.'
          )
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  const getGeolocationErrorMessage = (
    error: unknown
  ): string => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error
    ) {
      const code = Number(
        (error as { code?: number }).code
      );

      // GeolocationPositionError:
      // 1 = PERMISSION_DENIED
      // 2 = POSITION_UNAVAILABLE
      // 3 = TIMEOUT
      if (code === 1) {
        return 'Izin lokasi ditolak. Aktifkan izin lokasi untuk PWA/browser lalu coba lagi.';
      }

      if (code === 2) {
        return 'Posisi GPS tidak tersedia saat ini. Coba pindah ke area dengan sinyal lokasi lebih baik.';
      }

      if (code === 3) {
        return 'Pengambilan lokasi terlalu lama. Silakan coba lagi.';
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Lokasi GPS tidak dapat diambil. Pastikan izin lokasi aktif.';
  };

  const handleGetCurrentLocation = async (): Promise<void> => {
    if (isGettingLocation || isGeneratingAddress) {
      return;
    }

    setLocationError('');
    setIsGettingLocation(true);

    try {
      const position = await getCurrentPosition();

      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      setLocationError('');
    } catch (error) {
      console.error('Geolocation error:', error);
      setLocationError(
        getGeolocationErrorMessage(error)
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleGenerateAddress = async (): Promise<void> => {
    if (isGeneratingAddress || isGettingLocation) {
      return;
    }

    setAddressMode('auto');
    setLocationError('');
    setFormError('');
    setIsGeneratingAddress(true);

    try {
      const position = await getCurrentPosition();

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      setCoordinates({
        latitude,
        longitude,
      });

      if (!navigator.onLine) {
        setAddressMode('manual');
        setLocationError(
          'Koordinat GPS berhasil diambil, tetapi perangkat sedang offline. Silakan tulis alamat secara manual.'
        );
        return;
      }

      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        addressdetails: '1',
        'accept-language': 'id',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Reverse geocoding gagal (${response.status}).`
        );
      }

      const data =
        (await response.json()) as NominatimReverseResponse;

      const generatedAddress =
        data.display_name?.trim() || '';

      if (!generatedAddress) {
        setAddressMode('manual');
        setLocationError(
          'Alamat otomatis tidak ditemukan. Koordinat GPS tetap tersimpan, silakan tulis alamat secara manual.'
        );
        return;
      }

      setWatermarkLocation(generatedAddress);
      setAddressMode('auto');
      setLocationError('');
    } catch (error) {
      console.error(
        'Generate alamat otomatis gagal:',
        error
      );

      setAddressMode('manual');

      if (error instanceof TypeError) {
        setLocationError(
          'Alamat otomatis gagal diambil. Periksa koneksi internet lalu coba lagi, atau tulis alamat secara manual.'
        );
      } else {
        setLocationError(
          getGeolocationErrorMessage(error)
        );
      }
    } finally {
      setIsGeneratingAddress(false);
    }
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

      let generatedVerificationCode = '';

      if (watermarkStyle === 'timemark') {
        generatedVerificationCode =
          await generateVerificationCodePreview(
            imageData,
            {
              date: formattedDate,
              time: watermarkTime,
              latitude: coordinates?.latitude,
              longitude: coordinates?.longitude,
              categoryName: category.name,
            }
          );

        setVerificationCode(
          generatedVerificationCode
        );

        console.log(
          'Verification code:',
          generatedVerificationCode
        );
      } else {
        setVerificationCode('');
      }

      const watermarkedImage =
        await addWatermarkToImage(imageData, {
          style: watermarkStyle,
          appName:
            watermarkStyle === 'timemark'
              ? 'Timemark'
              : 'SEANANTA',
          categoryName: category.name,
          date: formattedDate,
          time: watermarkTime,
          locationText: watermarkLocation.trim(),
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          verificationCode:
            watermarkStyle === 'timemark'
              ? generatedVerificationCode
              : undefined,
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
                    {/* Pilihan model watermark */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Model Watermark
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setWatermarkStyle('classic');
                            setVerificationCode('');
                            setFormError('');
                          }}
                          disabled={isSaving}
                          className={`rounded-xl border p-3 text-left transition ${
                            watermarkStyle === 'classic'
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                              : 'border-slate-300 bg-white hover:bg-slate-50'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <p
                            className={`text-sm font-semibold ${
                              watermarkStyle === 'classic'
                                ? 'text-blue-700'
                                : 'text-slate-800'
                            }`}
                          >
                            Classic
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            Model pertama, sederhana dan bersih.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setWatermarkStyle('timemark');
                            setFormError('');
                          }}
                          disabled={isSaving}
                          className={`rounded-xl border p-3 text-left transition ${
                            watermarkStyle === 'timemark'
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                              : 'border-slate-300 bg-white hover:bg-slate-50'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <p
                            className={`text-sm font-semibold ${
                              watermarkStyle === 'timemark'
                                ? 'text-blue-700'
                                : 'text-slate-800'
                            }`}
                          >
                            Timemark
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            Jam gradient, alamat, GPS, dan kode verifikasi.
                          </p>
                        </button>
                      </div>
                    </div>

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

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={handleGenerateAddress}
                          disabled={
                            isGeneratingAddress ||
                            isGettingLocation ||
                            isSaving
                          }
                          className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                            addressMode === 'auto'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {isGeneratingAddress
                            ? 'Mencari Alamat...'
                            : 'Generate Otomatis'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAddressMode('manual');
                            setLocationError('');
                          }}
                          disabled={
                            isGeneratingAddress ||
                            isSaving
                          }
                          className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                            addressMode === 'manual'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          Tulis Manual
                        </button>
                      </div>

                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />

                        <textarea
                          id="watermark-location"
                          value={watermarkLocation}
                          onChange={(event) => {
                            setWatermarkLocation(
                              event.target.value
                            );
                            setAddressMode('manual');
                            setFormError('');
                          }}
                          rows={4}
                          maxLength={300}
                          placeholder={
                            addressMode === 'auto'
                              ? 'Tekan Generate Otomatis untuk mencari alamat dari GPS...'
                              : 'Contoh: Workshop PT ABC, Kalasan, Sleman, Daerah Istimewa Yogyakarta'
                          }
                          className="w-full resize-none rounded-xl border border-slate-300 bg-white pl-11 pr-3 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div className="flex justify-between mt-1.5 gap-3">
                        <p className="text-xs text-slate-500">
                          {addressMode === 'auto'
                            ? 'Alamat dibuat dari posisi GPS dan tetap dapat diedit jika kurang tepat.'
                            : 'Isi alamat secara manual. Alamat panjang otomatis menjadi beberapa baris pada watermark.'}
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
                              isGeneratingAddress ||
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

                  {/* Preview watermark */}
                  {watermarkStyle === 'classic' ? (
                    <div className="mt-5 overflow-hidden rounded-2xl bg-slate-800 p-4 text-white shadow-inner">
                      <div className="space-y-1.5">
                        <p className="text-sm font-normal">
                          SEANANTA
                        </p>

                        <p className="text-sm font-normal">
                          {formatDateToIndonesian(
                            watermarkDate
                          ) || 'Tanggal belum diisi'}{' '}
                          {watermarkTime || '--:--'}
                        </p>

                        <p className="text-sm font-normal whitespace-pre-wrap break-words">
                          {watermarkLocation.trim() ||
                            'Lokasi belum diisi'}
                        </p>

                        {coordinates && (
                          <p className="text-sm font-normal">
                            {formatCoordinatePreview(
                              coordinates
                            )}
                          </p>
                        )}
                      </div>

                      <p className="mt-3 text-[11px] text-white/45">
                        Preview model Classic — tanpa background, ikon,
                        shadow, atau kode verifikasi.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 overflow-hidden rounded-2xl bg-slate-800 p-4 text-white shadow-inner">
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-xl bg-white px-3 py-2">
                          <p
                            className="text-3xl leading-none font-extrabold tracking-tight"
                            style={{
                              background:
                                'linear-gradient(to bottom, #0B67D1 0%, #064B9E 42%, #062B5A 72%, #061426 100%)',
                              WebkitBackgroundClip: 'text',
                              backgroundClip: 'text',
                              color: 'transparent',
                              transform: 'translateY(2px)',
                            }}
                          >
                            {watermarkTime || '--:--'}
                          </p>
                        </div>

                        <div className="text-right leading-tight">
                          <p className="font-bold text-lg leading-none">
                            <span className="text-amber-400">
                              Time
                            </span>
                            <span className="text-white">
                              mark
                            </span>
                          </p>

                          <p className="text-xs text-white/90 mt-1">
                            Foto 100% akurat
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
                          Timemark menjamin keaslian waktu
                        </p>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-white/50">
                          Kode verifikasi
                        </p>

                        <div className="mt-1 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-white/70 flex-shrink-0" />

                          <div>
                            <p className="font-mono text-sm tracking-widest text-white">
                              {verificationCode ||
                                'Dibuat otomatis saat foto disimpan'}
                            </p>

                            <p className="text-[11px] text-white/60 mt-0.5">
                              Timemark Verified
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

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
                  : `Beri Watermark ${
                      watermarkStyle === 'timemark'
                        ? 'Timemark'
                        : 'Classic'
                    } dan Simpan`}
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