import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  Check,
  RotateCcw,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';

import {
  Header,
  Button,
} from '../components/ui';

import {
  CATEGORIES,
  PhotoCategory,
} from '../types';

import {
  validatePhoto,
} from '../utils/validation';

import {
  type ScanFilter,
  type Point,
  type CornerPoints,
  clamp,
  getDefaultCorners,
  createPerspectiveCrop,
  getScanFilterLabel,
} from '../utils/documentScanner';

interface ScanLocationState {
  imageData?: string;
}

interface ImageSize {
  width: number;
  height: number;
}

interface DisplayedImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const DocumentScanPage: React.FC =
  () => {
    const {
      categoryId,
    } =
      useParams<{
        categoryId: string;
      }>();

    const navigate =
      useNavigate();

    const location =
      useLocation();

    const locationState =
      location.state as
        | ScanLocationState
        | null;

    const imageData =
      locationState?.imageData;

    const imageRef =
      useRef<HTMLImageElement>(
        null
      );

    const previewContainerRef =
      useRef<HTMLDivElement>(
        null
      );

    const [
      imageSize,
      setImageSize,
    ] =
      useState<ImageSize | null>(
        null
      );

    const [
      displayedImageRect,
      setDisplayedImageRect,
    ] =
      useState<DisplayedImageRect | null>(
        null
      );

    const [
      corners,
      setCorners,
    ] =
      useState<CornerPoints>(
        getDefaultCorners()
      );

    const [
      activeCorner,
      setActiveCorner,
    ] =
      useState<
        keyof CornerPoints | null
      >(null);

    const [
      filter,
      setFilter,
    ] =
      useState<ScanFilter>(
        'enhance'
      );

    const [
      isProcessing,
      setIsProcessing,
    ] =
      useState(false);

    const [
      processingError,
      setProcessingError,
    ] =
      useState('');

    const category =
      useMemo(
        () =>
          CATEGORIES.find(
            (item) =>
              item.id ===
              categoryId
          ),
        [categoryId]
      );

    const calculateDisplayedImageRect =
      (): void => {
        const container =
          previewContainerRef.current;

        const image =
          imageRef.current;

        if (
          !container ||
          !image ||
          !image.naturalWidth ||
          !image.naturalHeight
        ) {
          setDisplayedImageRect(
            null
          );

          return;
        }

        const containerRect =
          container.getBoundingClientRect();

        const containerWidth =
          containerRect.width;

        const containerHeight =
          containerRect.height;

        if (
          containerWidth <= 0 ||
          containerHeight <= 0
        ) {
          setDisplayedImageRect(
            null
          );

          return;
        }

        const imageAspect =
          image.naturalWidth /
          image.naturalHeight;

        const containerAspect =
          containerWidth /
          containerHeight;

        let width =
          containerWidth;

        let height =
          containerHeight;

        let left =
          0;

        let top =
          0;

        /*
         * Meniru persis CSS object-contain:
         * - landscape lebih lebar -> letterbox atas/bawah
         * - portrait lebih tinggi  -> letterbox kiri/kanan
         */
        if (
          imageAspect >
          containerAspect
        ) {
          width =
            containerWidth;

          height =
            width /
            imageAspect;

          top =
            (
              containerHeight -
              height
            ) /
            2;
        } else {
          height =
            containerHeight;

          width =
            height *
            imageAspect;

          left =
            (
              containerWidth -
              width
            ) /
            2;
        }

        setDisplayedImageRect({
          left,
          top,
          width,
          height,
        });
      };

    useEffect(() => {
      if (
        !imageSize
      ) {
        return;
      }

      calculateDisplayedImageRect();

      const container =
        previewContainerRef.current;

      if (!container) {
        return;
      }

      const resizeObserver =
        new ResizeObserver(
          () => {
            calculateDisplayedImageRect();
          }
        );

      resizeObserver.observe(
        container
      );

      window.addEventListener(
        'resize',
        calculateDisplayedImageRect
      );

      window.addEventListener(
        'orientationchange',
        calculateDisplayedImageRect
      );

      return () => {
        resizeObserver.disconnect();

        window.removeEventListener(
          'resize',
          calculateDisplayedImageRect
        );

        window.removeEventListener(
          'orientationchange',
          calculateDisplayedImageRect
        );
      };
    }, [
      imageSize,
    ]);

    useEffect(() => {
      if (
        !activeCorner
      ) {
        return;
      }

      const handlePointerMove = (
        event: PointerEvent
      ) => {
        const container =
          previewContainerRef.current;

        if (!container) {
          return;
        }

        const imageRect =
          displayedImageRect;

        if (!imageRect) {
          return;
        }

        const rect =
          container.getBoundingClientRect();

        const pointerX =
          event.clientX -
          rect.left -
          imageRect.left;

        const pointerY =
          event.clientY -
          rect.top -
          imageRect.top;

        const normalizedX =
          clamp(
            pointerX /
              imageRect.width,
            0,
            1
          );

        const normalizedY =
          clamp(
            pointerY /
              imageRect.height,
            0,
            1
          );

        setCorners(
          (previous) => ({
            ...previous,

            [activeCorner]: {
              x:
                normalizedX,

              y:
                normalizedY,
            },
          })
        );
      };

      const handlePointerUp =
        () => {
          setActiveCorner(
            null
          );
        };

      window.addEventListener(
        'pointermove',
        handlePointerMove
      );

      window.addEventListener(
        'pointerup',
        handlePointerUp
      );

      window.addEventListener(
        'pointercancel',
        handlePointerUp
      );

      return () => {
        window.removeEventListener(
          'pointermove',
          handlePointerMove
        );

        window.removeEventListener(
          'pointerup',
          handlePointerUp
        );

        window.removeEventListener(
          'pointercancel',
          handlePointerUp
        );
      };
    }, [
      activeCorner,
      displayedImageRect,
    ]);

    if (
      !imageData ||
      !category ||
      !categoryId
    ) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-sm text-center">
            <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />

            <h2 className="text-xl font-semibold text-white">
              Foto tidak tersedia
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Silakan ambil foto
              kembali sebelum masuk
              ke mode scan dokumen.
            </p>

            <Button
              className="mt-5"
              onClick={() =>
                navigate(
                  `/capture/${categoryId}`
                )
              }
            >
              Kembali ke Kamera
            </Button>
          </div>
        </div>
      );
    }

    const handleImageLoad =
      (): void => {
        const image =
          imageRef.current;

        if (!image) {
          return;
        }

        setImageSize({
          width:
            image.naturalWidth,
          height:
            image.naturalHeight,
        });

        window.requestAnimationFrame(
          () => {
            calculateDisplayedImageRect();
          }
        );
      };

    const resetCorners =
      (): void => {
        setCorners(
          getDefaultCorners()
        );

        setProcessingError('');
      };

    const handleRetake =
      (): void => {
        navigate(
          `/capture/${categoryId}`,
          {
            replace: true,
          }
        );
      };

    const handleUseResult =
      async (): Promise<void> => {
        const image =
          imageRef.current;

        if (!image) {
          setProcessingError(
            'Foto belum siap diproses.'
          );

          return;
        }

        setIsProcessing(
          true
        );

        setProcessingError(
          ''
        );

        try {
          const scannedImage =
            createPerspectiveCrop(
              image,
              corners,
              { filter }
            );

          const validationResult =
            await validatePhoto(
              scannedImage,
              categoryId as PhotoCategory
            );

          navigate(
            `/result/${categoryId}`,
            {
              state: {
                imageData:
                  scannedImage,

                validation:
                  validationResult,
              },
            }
          );
        } catch (error) {
          console.error(
            'Document scan error:',
            error
          );

          setProcessingError(
            'Gagal memproses hasil scan. Silakan atur ulang sudut lalu coba lagi.'
          );
        } finally {
          setIsProcessing(
            false
          );
        }
      };

    const cornerEntries: Array<{
      key:
        keyof CornerPoints;

      point:
        Point;
    }> = [
      {
        key:
          'topLeft',

        point:
          corners.topLeft,
      },

      {
        key:
          'topRight',

        point:
          corners.topRight,
      },

      {
        key:
          'bottomRight',

        point:
          corners.bottomRight,
      },

      {
        key:
          'bottomLeft',

        point:
          corners.bottomLeft,
      },
    ];

    const polygonPoints =
      [
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ]
        .map(
          (point) =>
            `${point.x * 100},${point.y * 100}`
        )
        .join(' ');

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Header
          title="Scan Dokumen"
          showBack
          className="bg-white border-slate-200"
        />

        <div className="flex-1 flex flex-col">
          <div className="px-4 pt-4">
            <div className="max-w-lg mx-auto">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {category.name}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Geser 4 titik ke
                    setiap sudut dokumen.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    resetCorners
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />

                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 pb-4">
            <div className="max-w-lg mx-auto h-full">
              <div
                ref={
                  previewContainerRef
                }
                className="relative w-full min-h-[430px] max-h-[68vh] overflow-hidden rounded-2xl bg-black select-none touch-none"
              >
                <img
                  ref={imageRef}
                  src={imageData}
                  alt="Preview scan dokumen"
                  draggable={false}
                  onLoad={
                    handleImageLoad
                  }
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                {imageSize &&
                  displayedImageRect && (
                    <div
                      className="absolute z-20 pointer-events-none"
                      style={{
                        left:
                          displayedImageRect.left,
                        top:
                          displayedImageRect.top,
                        width:
                          displayedImageRect.width,
                        height:
                          displayedImageRect.height,
                      }}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        <polygon
                          points={
                            polygonPoints
                          }
                          fill="rgba(13,148,136,0.08)"
                          stroke="rgba(45,212,191,0.95)"
                          strokeWidth="0.55"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {cornerEntries.map(
                        ({
                          key,
                          point,
                        }) => (
                          <button
                            key={
                              key
                            }
                            type="button"
                            aria-label={`Geser titik ${key}`}
                            onPointerDown={(
                              event
                            ) => {
                              event.preventDefault();

                              setActiveCorner(
                                key
                              );
                            }}
                            className={`absolute z-30 w-8 h-8 -ml-4 -mt-4 rounded-full border-[3px] border-white shadow-lg transition-transform pointer-events-auto touch-none ${
                              activeCorner ===
                              key
                                ? 'bg-teal-400 scale-125'
                                : 'bg-teal-500'
                            }`}
                            style={{
                              left:
                                `${point.x * 100}%`,

                              top:
                                `${point.y * 100}%`,
                            }}
                          >
                            <span className="absolute inset-[7px] rounded-full bg-white" />
                          </button>
                        )
                      )}
                    </div>
                  )}

                {!imageSize && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-full border-4 border-slate-600 border-t-teal-400 animate-spin mx-auto" />

                      <p className="text-sm text-slate-300 mt-3">
                        Memuat foto...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-slate-500 mt-3">
                Pastikan seluruh dokumen berada
                di dalam garis hijau. Titik crop mengikuti
                area foto sebenarnya, termasuk foto dari galeri.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border-t border-slate-800">
            <div className="max-w-lg mx-auto p-4">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal className="w-4 h-4 text-slate-400" />

                <p className="text-sm font-medium text-slate-200">
                  Filter
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    'original',
                    'enhance',
                  ] as ScanFilter[]
                ).map(
                  (
                    filterOption
                  ) => {
                    const active =
                      filter ===
                      filterOption;

                    return (
                      <button
                        key={
                          filterOption
                        }
                        type="button"
                        onClick={() =>
                          setFilter(
                            filterOption
                          )
                        }
                        className={`rounded-xl border px-2 py-2.5 text-xs font-medium transition ${
                          active
                            ? 'border-teal-400 bg-teal-500/15 text-teal-300'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {getScanFilterLabel(
                          filterOption
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {filter === 'enhance'
                  ? 'Enhance otomatis mencerahkan foto gelap, meningkatkan kontras, dan mempertajam teks tanpa menghilangkan warna.'
                  : 'Original mempertahankan hasil scan tanpa peningkatan brightness, kontras, atau ketajaman.'}
              </p>

              {processingError && (
                <div className="mt-3 rounded-xl border border-red-900/60 bg-red-950/40 p-3">
                  <p className="text-sm text-red-300">
                    {
                      processingError
                    }
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button
                  variant="outline"
                  fullWidth
                  disabled={
                    isProcessing
                  }
                  onClick={
                    handleRetake
                  }
                >
                  Foto Ulang
                </Button>

                <Button
                  fullWidth
                  loading={
                    isProcessing
                  }
                  disabled={
                    !imageSize ||
                    isProcessing
                  }
                  onClick={
                    handleUseResult
                  }
                  icon={
                    <Check className="w-4 h-4" />
                  }
                >
                  Gunakan Hasil
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };