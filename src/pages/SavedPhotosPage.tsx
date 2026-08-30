import React, {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Image,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Clock,
} from 'lucide-react';

import {
  Header,
  Card,
  Badge,
  Button,
  BottomNav,
} from '../components/ui';

import {
  SavedPhoto,
  CATEGORIES,
} from '../types';

import {
  getAllPhotos,
  deletePhoto,
} from '../utils/storage';

export const SavedPhotosPage: React.FC = () => {
  const navigate = useNavigate();

  const [
    photos,
    setPhotos,
  ] = useState<SavedPhoto[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    selectedPhoto,
    setSelectedPhoto,
  ] = useState<SavedPhoto | null>(
    null
  );

  const [
    deleting,
    setDeleting,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadPhotos();
  }, []);

  /*
   * Mencegah halaman utama ikut scroll
   * ketika modal detail foto sedang terbuka.
   */
  useEffect(() => {
    if (!selectedPhoto) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [selectedPhoto]);

  const loadPhotos =
    async (): Promise<void> => {
      try {
        const savedPhotos =
          await getAllPhotos();

        setPhotos(
          savedPhotos
        );
      } catch (
        error
      ) {
        console.error(
          'Foto gagal dimuat:',
          error
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const handleDelete =
    async (
      id: string
    ): Promise<void> => {
      setDeleting(
        id
      );

      try {
        await deletePhoto(
          id
        );

        setPhotos(
          (
            previous
          ) =>
            previous.filter(
              (
                photo
              ) =>
                photo.id !==
                id
            )
        );

        setSelectedPhoto(
          null
        );
      } catch (
        error
      ) {
        console.error(
          'Gagal menghapus foto:',
          error
        );
      } finally {
        setDeleting(
          null
        );
      }
    };

  const formatDate =
    (
      date:
        | Date
        | string
    ): string => {
      const parsedDate =
        new Date(
          date
        );

      return parsedDate.toLocaleDateString(
        'id-ID',
        {
          day:
            '2-digit',

          month:
            'short',

          year:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit',
        }
      );
    };

  const getCategoryName =
    (
      category: string
    ): string => {
      return (
        CATEGORIES.find(
          (
            item
          ) =>
            item.id ===
            category
        )?.name ||
        category
      );
    };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header
        title="Foto Tersimpan"
        actions={
          photos.length >
          0 ? (
            <span className="text-sm text-slate-500">
              {
                photos.length
              }{' '}
              {photos.length ===
              1
                ? 'foto'
                : 'foto'}
            </span>
          ) : undefined
        }
      />

      <div className="max-w-lg mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <div
              className="
                w-12
                h-12
                border-4
                border-slate-200
                border-t-teal-500
                rounded-full
                animate-spin
                mx-auto
                mb-4
              "
            />

            <p className="text-slate-500">
              Memuat foto...
            </p>
          </div>
        ) : photos.length ===
          0 ? (
          <div className="text-center py-16">
            <div
              className="
                w-20
                h-20
                rounded-full
                bg-slate-100
                flex
                items-center
                justify-center
                mx-auto
                mb-6
              "
            >
              <Image className="w-10 h-10 text-slate-400" />
            </div>

            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Tidak Ada Foto yang
              Disimpan
            </h3>

            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Foto yang Anda validasi
              dan simpan akan muncul di
              sini. Foto tersimpan
              secara lokal di perangkat
              Anda.
            </p>

            <Button
              onClick={() =>
                navigate('/')
              }
            >
              Ambil Foto
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {photos.map(
              (
                photo
              ) => (
                <Card
                  key={
                    photo.id
                  }
                  hoverable
                  onClick={() =>
                    setSelectedPhoto(
                      photo
                    )
                  }
                  className="overflow-hidden cursor-pointer"
                >
                  <div className="flex gap-4">
                    <div
                      className="
                        relative
                        w-28
                        h-28
                        flex-shrink-0
                        bg-black
                      "
                    >
                      <img
                        src={
                          photo.imageData
                        }
                        alt="Foto tersimpan"
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                      <div className="absolute bottom-2 left-2">
                        {photo
                          .validation
                          .passed ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <XCircle className="w-4 h-4 text-white" />
                        )}
                      </div>

                      <div
                        className="
                          absolute
                          top-0
                          right-0
                          bg-black/50
                          px-1.5
                          py-0.5
                          rounded-bl-lg
                        "
                      >
                        <span className="text-white text-xs font-medium">
                          {
                            photo
                              .validation
                              .overallScore
                          }
                        </span>
                      </div>
                    </div>

                    <div className="py-3 pr-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            photo
                              .validation
                              .passed
                              ? 'success'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {photo
                            .validation
                            .passed
                            ? 'Valid'
                            : 'Tidak Valid'}
                        </Badge>
                      </div>

                      <p className="font-medium text-slate-900 text-sm mb-1">
                        {getCategoryName(
                          photo.category
                        )}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3 flex-shrink-0" />

                        <span>
                          {formatDate(
                            photo.savedAt
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center pr-3">
                      <Eye className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </Card>
              )
            )}
          </div>
        )}
      </div>

      {/* MODAL DETAIL FOTO */}
      {selectedPhoto && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            bg-black/80
            flex
            items-center
            justify-center
            p-3
            sm:p-4
            overflow-hidden
          "
          onClick={() =>
            setSelectedPhoto(
              null
            )
          }
        >
          <div
            className="
              bg-white
              rounded-2xl
              w-full
              max-w-md
              h-[92dvh]
              sm:h-auto
              sm:max-h-[90dvh]
              flex
              flex-col
              overflow-hidden
              shadow-2xl
            "
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            {/* PREVIEW FOTO */}
            <div className="relative flex-shrink-0 bg-black">
              <img
                src={
                  selectedPhoto.imageData
                }
                alt="Detail foto"
                className="
                  w-full
                  max-h-[40dvh]
                  object-contain
                  bg-black
                "
              />

              {/* CLOSE ICON */}
              <button
                type="button"
                aria-label="Tutup"
                onClick={() =>
                  setSelectedPhoto(
                    null
                  )
                }
                className="
                  absolute
                  top-3
                  right-3
                  z-20
                  w-10
                  h-10
                  rounded-full
                  bg-black/60
                  backdrop-blur-sm
                  flex
                  items-center
                  justify-center
                  active:scale-95
                  transition-transform
                "
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>

              {/* STATUS */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center">
                <Badge
                  variant={
                    selectedPhoto
                      .validation
                      .passed
                      ? 'success'
                      : 'danger'
                  }
                >
                  {selectedPhoto
                    .validation
                    .passed
                    ? 'Valid'
                    : 'Tidak Valid'}{' '}
                  -{' '}
                  {
                    selectedPhoto
                      .validation
                      .overallScore
                  }
                  %
                </Badge>
              </div>
            </div>

            {/* CONTENT SCROLLABLE */}
            <div
              className="
                flex-1
                min-h-0
                overflow-y-auto
                overscroll-contain
                p-4
              "
              style={{
                WebkitOverflowScrolling:
                  'touch',
              }}
            >
              <h3 className="font-semibold text-slate-900 mb-2">
                {getCategoryName(
                  selectedPhoto.category
                )}
              </h3>

              <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
                <Clock className="w-4 h-4" />

                <span>
                  {formatDate(
                    selectedPhoto.savedAt
                  )}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-slate-800 mb-3">
                Detail Validasi
              </h4>

              <div className="space-y-2">
                {selectedPhoto.validation.rules.map(
                  (
                    rule
                  ) => (
                    <div
                      key={
                        rule.id
                      }
                      className="
                        flex
                        items-start
                        gap-3
                        p-3
                        bg-slate-50
                        rounded-xl
                        border
                        border-slate-100
                      "
                    >
                      <div className="pt-0.5">
                        {rule.passed ? (
                          <CheckCircle
                            className="
                              w-5
                              h-5
                              text-emerald-500
                              flex-shrink-0
                            "
                          />
                        ) : (
                          <XCircle
                            className="
                              w-5
                              h-5
                              text-red-500
                              flex-shrink-0
                            "
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {
                            rule.name
                          }
                        </p>

                        <p className="text-xs text-slate-500 mt-1 break-words leading-relaxed">
                          {rule.details ||
                            rule.description}
                        </p>
                      </div>

                      <span
                        className={`text-sm font-semibold flex-shrink-0 ${
                          rule.score >=
                          80
                            ? 'text-emerald-600'
                            : rule.score >=
                                60
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {Math.round(
                          rule.score
                        )}
                        %
                      </span>
                    </div>
                  )
                )}
              </div>

              {/*
               * Spacer kecil supaya item terakhir
               * tidak terlalu menempel ke footer.
               */}
              <div className="h-2" />
            </div>

            {/* FOOTER FIXED */}
            <div
              className="
                flex-shrink-0
                border-t
                border-slate-200
                bg-white
                p-4
              "
              style={{
                paddingBottom:
                  'calc(1rem + env(safe-area-inset-bottom))',
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="danger"
                  onClick={() =>
                    handleDelete(
                      selectedPhoto.id
                    )
                  }
                  loading={
                    deleting ===
                    selectedPhoto.id
                  }
                  disabled={
                    deleting !==
                    null
                  }
                  fullWidth
                  icon={
                    <Trash2 className="w-4 h-4" />
                  }
                >
                  Hapus
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    setSelectedPhoto(
                      null
                    )
                  }
                  disabled={
                    deleting !==
                    null
                  }
                  fullWidth
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};