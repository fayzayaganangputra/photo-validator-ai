import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, X, FlipHorizontal, Focus, AlertCircle, Upload } from 'lucide-react';
import { Header, Button, Badge } from '../components/ui';
import { CATEGORIES, PhotoCategory } from '../types';
import { validatePhoto } from '../utils/validation';

export const CameraCapturePage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const guideFrameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Tambahan kamera fokus
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  // =====================================================
  // LIVE CENTER DETECTION
  // =====================================================
  type CenterStatus =
    | 'detecting'
    | 'centered'
    | 'move-left'
    | 'move-right'
    | 'move-up'
    | 'move-down'
    | 'move-up-left'
    | 'move-up-right'
    | 'move-down-left'
    | 'move-down-right';

  const [centerStatus, setCenterStatus] =
    useState<CenterStatus>('detecting');

  const [centerConfidence, setCenterConfidence] =
    useState(0);

  const [cameraAspectRatio, setCameraAspectRatio] =
    useState<number>(9 / 16);

  const category = CATEGORIES.find((c) => c.id === categoryId) as {
    id: PhotoCategory;
    name: string;
    icon: string;
    rules: string[];
  } | undefined;

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;
    setStream(null);
  };

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      stopCamera();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Kamera tidak dapat diakses. Izinkan akses kamera atau gunakan Upload Test.');
    } finally {
      setIsLoading(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera]);

  interface SourceCropRect {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  }

  /**
   * Mengubah posisi guide frame yang terlihat di layar
   * menjadi koordinat pixel pada frame kamera asli.
   *
   * Ini memperhitungkan CSS `object-cover`, sehingga:
   * area di dalam kotak hijau = area yang benar-benar dicapture.
   */
  const getGuideSourceRect = useCallback((): SourceCropRect | null => {
    const video = videoRef.current;
    const guide = guideFrameRef.current;

    if (
      !video ||
      !guide ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return null;
    }

    const videoRect =
      video.getBoundingClientRect();

    const guideRect =
      guide.getBoundingClientRect();

    if (
      videoRect.width <= 0 ||
      videoRect.height <= 0 ||
      guideRect.width <= 0 ||
      guideRect.height <= 0
    ) {
      return null;
    }

    const sourceWidth =
      video.videoWidth;

    const sourceHeight =
      video.videoHeight;

    /*
     * Karena preview memakai object-cover,
     * video asli bisa "terpotong" pada sisi tertentu.
     */
    const coverScale =
      Math.max(
        videoRect.width / sourceWidth,
        videoRect.height / sourceHeight
      );

    const renderedWidth =
      sourceWidth * coverScale;

    const renderedHeight =
      sourceHeight * coverScale;

    const renderedOffsetX =
      (videoRect.width - renderedWidth) / 2;

    const renderedOffsetY =
      (videoRect.height - renderedHeight) / 2;

    const guideLeftInVideo =
      guideRect.left - videoRect.left;

    const guideTopInVideo =
      guideRect.top - videoRect.top;

    const sourceLeft =
      (
        guideLeftInVideo -
        renderedOffsetX
      ) /
      coverScale;

    const sourceTop =
      (
        guideTopInVideo -
        renderedOffsetY
      ) /
      coverScale;

    const sourceRight =
      (
        guideLeftInVideo +
        guideRect.width -
        renderedOffsetX
      ) /
      coverScale;

    const sourceBottom =
      (
        guideTopInVideo +
        guideRect.height -
        renderedOffsetY
      ) /
      coverScale;

    const sx =
      Math.max(
        0,
        Math.min(
          sourceWidth - 1,
          sourceLeft
        )
      );

    const sy =
      Math.max(
        0,
        Math.min(
          sourceHeight - 1,
          sourceTop
        )
      );

    const right =
      Math.max(
        sx + 1,
        Math.min(
          sourceWidth,
          sourceRight
        )
      );

    const bottom =
      Math.max(
        sy + 1,
        Math.min(
          sourceHeight,
          sourceBottom
        )
      );

    return {
      sx,
      sy,
      sw:
        right - sx,
      sh:
        bottom - sy,
    };
  }, []);

  const getCenterStatusLabel = (
    status: CenterStatus
  ): string => {
    switch (status) {
      case 'centered':
        return 'Posisi sudah di tengah';

      case 'move-left':
        return 'Geser objek ke kiri';

      case 'move-right':
        return 'Geser objek ke kanan';

      case 'move-up':
        return 'Geser objek ke atas';

      case 'move-down':
        return 'Geser objek ke bawah';

      case 'move-up-left':
        return 'Geser objek ke kiri atas';

      case 'move-up-right':
        return 'Geser objek ke kanan atas';

      case 'move-down-left':
        return 'Geser objek ke kiri bawah';

      case 'move-down-right':
        return 'Geser objek ke kanan bawah';

      default:
        return 'Mendeteksi posisi objek...';
    }
  };

  /**
   * Live center detection ringan untuk PWA.
   *
   * Cara kerja:
   * - mengambil frame video kecil
   * - menghitung kekuatan edge/tekstur
   * - mencari pusat bobot area paling informatif
   * - membandingkan pusat tersebut dengan pusat kamera
   *
   * Ini tidak membutuhkan API/server dan dapat berjalan offline.
   * Hasilnya digunakan sebagai bantuan visual, bukan sebagai
   * pengganti validasi foto utama.
   */
  const analyzeLiveCenter = useCallback(() => {
    const video = videoRef.current;
    const canvas = analysisCanvasRef.current;

    if (
      !video ||
      !canvas ||
      video.readyState < 2 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      setCenterStatus('detecting');
      setCenterConfidence(0);
      return;
    }

    const cropRect =
      getGuideSourceRect();

    if (!cropRect) {
      setCenterStatus('detecting');
      setCenterConfidence(0);
      return;
    }

    const analysisWidth = 240;

    const cropAspect =
      cropRect.sh /
      cropRect.sw;

    const analysisHeight = Math.max(
      135,
      Math.round(
        analysisWidth *
        cropAspect
      )
    );

    canvas.width = analysisWidth;
    canvas.height = analysisHeight;

    const ctx = canvas.getContext(
      '2d',
      {
        willReadFrequently: true,
      }
    );

    if (!ctx) {
      return;
    }

    /*
     * Yang dianalisis hanya isi guide frame,
     * bukan seluruh preview kamera.
     */
    ctx.drawImage(
      video,
      cropRect.sx,
      cropRect.sy,
      cropRect.sw,
      cropRect.sh,
      0,
      0,
      analysisWidth,
      analysisHeight
    );

    const frame = ctx.getImageData(
      0,
      0,
      analysisWidth,
      analysisHeight
    );

    const data = frame.data;

    const luminance =
      new Float32Array(
        analysisWidth *
        analysisHeight
      );

    for (
      let y = 0;
      y < analysisHeight;
      y += 1
    ) {
      for (
        let x = 0;
        x < analysisWidth;
        x += 1
      ) {
        const pixelIndex =
          (
            y *
            analysisWidth +
            x
          ) *
          4;

        luminance[
          y *
          analysisWidth +
          x
        ] =
          data[pixelIndex] * 0.299 +
          data[pixelIndex + 1] * 0.587 +
          data[pixelIndex + 2] * 0.114;
      }
    }

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let activeEdges = 0;

    // Abaikan sedikit area pinggir karena UI/background
    // biasanya menghasilkan edge besar yang menipu detector.
    const minX =
      Math.round(
        analysisWidth * 0.06
      );

    const maxX =
      Math.round(
        analysisWidth * 0.94
      );

    const minY =
      Math.round(
        analysisHeight * 0.06
      );

    const maxY =
      Math.round(
        analysisHeight * 0.94
      );

    for (
      let y = minY;
      y < maxY;
      y += 2
    ) {
      for (
        let x = minX;
        x < maxX;
        x += 2
      ) {
        const index =
          y *
          analysisWidth +
          x;

        const gx =
          Math.abs(
            luminance[
              index + 1
            ] -
            luminance[
              index - 1
            ]
          );

        const gy =
          Math.abs(
            luminance[
              index + analysisWidth
            ] -
            luminance[
              index - analysisWidth
            ]
          );

        const magnitude =
          gx + gy;

        // Hanya edge yang cukup berarti.
        if (
          magnitude < 24
        ) {
          continue;
        }

        /*
         * Batasi bobot agar satu area sangat tajam
         * tidak mendominasi seluruh perhitungan.
         */
        const weight =
          Math.min(
            magnitude,
            120
          );

        totalWeight +=
          weight;

        weightedX +=
          x * weight;

        weightedY +=
          y * weight;

        activeEdges += 1;
      }
    }

    const minimumEdges =
      Math.max(
        25,
        Math.round(
          (
            analysisWidth *
            analysisHeight
          ) /
          900
        )
      );

    if (
      totalWeight <= 0 ||
      activeEdges <
        minimumEdges
    ) {
      setCenterStatus(
        'detecting'
      );

      setCenterConfidence(
        0
      );

      return;
    }

    const subjectX =
      weightedX /
      totalWeight /
      analysisWidth;

    const subjectY =
      weightedY /
      totalWeight /
      analysisHeight;

    const deltaX =
      subjectX - 0.5;

    const deltaY =
      subjectY - 0.5;

    /*
     * Toleransi center.
     * 0.075 = sekitar 7.5% dari dimensi frame.
     */
    const toleranceX =
      0.075;

    const toleranceY =
      0.075;

    const horizontal =
      deltaX <
      -toleranceX
        ? 'right'
        : deltaX >
            toleranceX
          ? 'left'
          : null;

    const vertical =
      deltaY <
      -toleranceY
        ? 'down'
        : deltaY >
            toleranceY
          ? 'up'
          : null;

    let nextStatus: CenterStatus =
      'centered';

    /*
     * Arah instruksi adalah arah perpindahan objek,
     * bukan lokasi objek saat ini.
     */
    if (
      vertical === 'up' &&
      horizontal === 'left'
    ) {
      nextStatus =
        'move-up-left';
    } else if (
      vertical === 'up' &&
      horizontal === 'right'
    ) {
      nextStatus =
        'move-up-right';
    } else if (
      vertical === 'down' &&
      horizontal === 'left'
    ) {
      nextStatus =
        'move-down-left';
    } else if (
      vertical === 'down' &&
      horizontal === 'right'
    ) {
      nextStatus =
        'move-down-right';
    } else if (
      horizontal === 'left'
    ) {
      nextStatus =
        'move-left';
    } else if (
      horizontal === 'right'
    ) {
      nextStatus =
        'move-right';
    } else if (
      vertical === 'up'
    ) {
      nextStatus =
        'move-up';
    } else if (
      vertical === 'down'
    ) {
      nextStatus =
        'move-down';
    }

    const centerDistance =
      Math.sqrt(
        deltaX * deltaX +
        deltaY * deltaY
      );

    const confidence =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (
              1 -
              centerDistance /
                0.45
            ) *
            100
          )
        )
      );

    setCenterStatus(
      nextStatus
    );

    setCenterConfidence(
      confidence
    );
  }, [getGuideSourceRect]);

  useEffect(() => {
    if (
      !stream ||
      isLoading ||
      capturedImage
    ) {
      return;
    }

    // Analisis tidak perlu setiap frame.
    // 450 ms cukup ringan untuk PWA/mobile.
    const intervalId =
      window.setInterval(
        analyzeLiveCenter,
        450
      );

    // Jalankan sekali di awal agar indikator cepat muncul.
    const firstRun =
      window.setTimeout(
        analyzeLiveCenter,
        350
      );

    return () => {
      window.clearInterval(
        intervalId
      );

      window.clearTimeout(
        firstRun
      );
    };
  }, [
    stream,
    isLoading,
    capturedImage,
    analyzeLiveCenter,
  ]);

  const validateAndNavigate = async (imageData: string) => {
    if (!categoryId) return;

    setIsValidating(true);
    setError(null);

    try {
      const validationResult = await validatePhoto(imageData, categoryId as PhotoCategory);

      stopCamera();

      navigate(`/result/${categoryId}`, {
        state: {
          imageData,
          validation: validationResult
        }
      });
    } catch (err) {
      console.error('Validation error:', err);
      setError('Gagal memvalidasi gambar. Silakan coba lagi.');
    } finally {
      setIsValidating(false);
    }
  };

  // tambahan logic fokus kamera
  const handleTapToFocus = async (event: React.MouseEvent<HTMLVideoElement>) => {
  if (!streamRef.current || !videoRef.current) return;

  const rect = videoRef.current.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  setFocusPoint({ x, y });

  setTimeout(() => {
    setFocusPoint(null);
  }, 800);

  try {
    const track = streamRef.current.getVideoTracks()[0];

    if (!track) return;

    const capabilities = track.getCapabilities() as any;

    if (capabilities.focusMode?.includes('continuous')) {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'continuous'
          } as any
        ]
      });
    }

    if (capabilities.pointsOfInterest) {
      await track.applyConstraints({
        advanced: [
          {
            pointsOfInterest: [
              {
                x: x / rect.width,
                y: y / rect.height
              }
            ]
          } as any
        ]
      });
    }
  } catch (error) {
    console.log('Tap focus tidak didukung browser ini:', error);
  }
};

  const handleCapture = async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !categoryId
    ) {
      return;
    }

    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (!ctx) {
      return;
    }

    const cropRect =
      getGuideSourceRect();

    if (!cropRect) {
      setError(
        'Area kamera belum siap. Tunggu sebentar lalu coba foto kembali.'
      );
      return;
    }

    /*
     * WYSIWYG CAPTURE:
     * yang disimpan hanya area yang berada
     * di dalam guide frame pada preview.
     */
    const outputWidth =
      Math.max(
        1,
        Math.round(
          cropRect.sw
        )
      );

    const outputHeight =
      Math.max(
        1,
        Math.round(
          cropRect.sh
        )
      );

    canvas.width =
      outputWidth;

    canvas.height =
      outputHeight;

    ctx.drawImage(
      video,

      cropRect.sx,
      cropRect.sy,
      cropRect.sw,
      cropRect.sh,

      0,
      0,
      outputWidth,
      outputHeight
    );

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.94
      );

    setCapturedImage(
      imageData
    );

    // Untuk kategori dokumen/serial number, masuk ke scanner terlebih dahulu.
    if (
      categoryId ===
        'bast-document' ||
      categoryId ===
        'serial-number'
    ) {
      stopCamera();

      navigate(
        `/scan/${categoryId}`,
        {
          state: {
            imageData
          }
        }
      );

      return;
    }

    await validateAndNavigate(
      imageData
    );
  };

  const handleUploadTest = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !categoryId) return;

    const reader = new FileReader();

    reader.onload = async () => {
      const imageData = reader.result as string;

      setCapturedImage(imageData);

      // Upload test mengikuti alur yang sama dengan hasil kamera.
      if (categoryId === 'bast-document' || categoryId === 'serial-number') {
        stopCamera();

        navigate(`/scan/${categoryId}`, {
          state: {
            imageData
          }
        });

        return;
      }

      await validateAndNavigate(imageData);
    };

    reader.readAsDataURL(file);
  };

  const handleFlip = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleClose = () => {
    stopCamera();
    navigate('/');
  };

  const handleRetake = () => {
    setCapturedImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    startCamera();
  };

  if (!category) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-lg">Kategori tidak valid</p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header title={category.name} showBack className="bg-white border-slate-200" />

      <div className="flex-1 relative flex flex-col bg-black">
        <div
          ref={previewAreaRef}
          className="flex-1 relative bg-black overflow-hidden"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-slate-600 border-t-teal-500 rounded-full animate-spin mb-4" />
                <p className="text-slate-400">Menginisialisasi kamera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-30 p-4 bg-black/80">
              <div className="text-center bg-slate-800 rounded-2xl p-6 max-w-sm">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-white mb-4">{error}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => startCamera()}>Coba Lagi</Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-transparent border-white/30 text-white hover:bg-white/10"
                  >
                    Upload Test
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!capturedImage ? (
            <>
              {/* <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover bg-black"
                style={{ opacity: isLoading ? 0 : 1 }}
              /> */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onClick={handleTapToFocus}
                onLoadedMetadata={() => {
                  const video =
                    videoRef.current;

                  if (
                    video &&
                    video.videoWidth > 0 &&
                    video.videoHeight > 0
                  ) {
                    setCameraAspectRatio(
                      video.videoWidth /
                      video.videoHeight
                    );
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover bg-black"
                style={{ opacity: isLoading ? 0 : 1 }}
              />

              {focusPoint && (
                <div
                  className="absolute z-30 w-16 h-16 border-2 border-yellow-400 rounded-full pointer-events-none animate-ping"
                  style={{
                    left: focusPoint.x - 32,
                    top: focusPoint.y - 32
                  }}
                />
              )}

              <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                <Badge variant="info">{category.name}</Badge>
              </div>

              {/* Live center status */}
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div
                  className={`rounded-full px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-sm border ${
                    centerStatus === 'centered'
                      ? 'bg-emerald-500/90 border-emerald-300 text-white'
                      : centerStatus === 'detecting'
                        ? 'bg-slate-900/75 border-white/20 text-white'
                        : 'bg-amber-500/90 border-amber-200 text-slate-950'
                  }`}
                >
                  {centerStatus === 'centered'
                    ? '✓ '
                    : centerStatus === 'detecting'
                      ? ''
                      : '↔ '}

                  {getCenterStatusLabel(
                    centerStatus
                  )}

                  {centerStatus !== 'detecting' && (
                    <span className="ml-2 text-xs opacity-80">
                      {centerConfidence}%
                    </span>
                  )}
                </div>
              </div>

              <div className="absolute inset-0 z-10 pointer-events-none">
                <div
                  ref={guideFrameRef}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',

                    /*
                     * Frame mengikuti rasio kamera HP.
                     * maxWidth/maxHeight menjaga agar frame
                     * selalu masuk area preview pada berbagai layar.
                     */
                    width: '86%',
                    maxWidth: '86%',
                    maxHeight: '78%',
                    aspectRatio:
                      `${cameraAspectRatio}`,
                  }}
                >
                  <div
                    className={`absolute inset-0 border-2 rounded-3xl transition-colors duration-200 ${
                      centerStatus === 'centered'
                        ? 'border-emerald-400/90'
                        : centerStatus === 'detecting'
                          ? 'border-white/60'
                          : 'border-amber-300/80'
                    }`}
                  />

                  <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/30" />
                  <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/30" />
                  <div className="absolute left-0 right-0 top-1/3 h-px bg-white/30" />
                  <div className="absolute left-0 right-0 top-2/3 h-px bg-white/30" />

                  <Focus
                    className="w-8 h-8 text-white/40 absolute"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </div>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur-sm">
                  Area di dalam kotak = hasil foto
                </div>
              </div>
            </>
          ) : (
            <div className="relative w-full h-full bg-black">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />

              {isValidating && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-600 border-t-teal-500 rounded-full animate-spin mb-4" />
                    <p className="text-white">Memvalidasi...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900 px-4 py-6 pb-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadTest}
          />

          {!capturedImage ? (
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 transition-colors"
                title="Upload Test dari laptop"
              >
                <Upload className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={handleFlip}
                className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Balik kamera"
              >
                <FlipHorizontal className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={handleCapture}
                disabled={!stream || isLoading || isValidating}
                className="w-20 h-20 rounded-full bg-white flex items-center justify-center ring-4 ring-white/30 hover:ring-white/50 transition-all disabled:opacity-50"
                title="Ambil foto"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </button>

              <button
                onClick={handleClose}
                className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Tutup"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleRetake}
                fullWidth
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                Foto Ulang
              </Button>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={analysisCanvasRef} className="hidden" />

      <div className="text-center text-xs text-slate-500 pb-4 bg-slate-900">
        {category.rules.length} aturan validasi
      </div>
    </div>
  );
};