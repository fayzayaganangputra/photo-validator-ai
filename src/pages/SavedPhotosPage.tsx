import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, CheckCircle, XCircle, Trash2, Eye, Clock } from 'lucide-react';
import { Header, Card, Badge, Button, BottomNav } from '../components/ui';
import { SavedPhoto, CATEGORIES } from '../types';
import { getAllPhotos, deletePhoto } from '../utils/storage';

export const SavedPhotosPage: React.FC = () => {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const savedPhotos = await getAllPhotos();
      setPhotos(savedPhotos);
    } catch (error) {
      console.error('Foto gagal dimuat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deletePhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setSelectedPhoto(null);
    } catch (error) {
      console.error('Gagal menghapus foto:', error);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryName = (category: string) => {
    return CATEGORIES.find((c) => c.id === category)?.name || category;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header title="Foto Tersimpan" actions={
        photos.length > 0 && (
          <span className="text-sm text-slate-500">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        )
      } />

      <div className="max-w-lg mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Memuat foto...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <Image className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Tidak Ada Foto yang Disimpan
            </h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Foto yang Anda validasi dan simpan akan muncul di sini. Foto-foto tersebut tersimpan secara lokal di perangkat Anda.
            </p>
            <Button onClick={() => navigate('/')}>
              Ambil Foto
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {photos.map((photo) => (
              <Card
                key={photo.id}
                hoverable
                onClick={() => setSelectedPhoto(photo)}
                className="overflow-hidden"
              >
                <div className="flex gap-4">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <img
                      src={photo.imageData}
                      alt="Saved"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2">
                      {photo.validation.passed ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <XCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="absolute top-0 right-0 bg-black/50 px-1.5 py-0.5 rounded-bl-lg">
                      <span className="text-white text-xs font-medium">
                        {photo.validation.overallScore}
                      </span>
                    </div>
                  </div>
                  <div className="py-3 pr-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={photo.validation.passed ? 'success' : 'danger'}
                        size="sm"
                      >
                        {photo.validation.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                    <p className="font-medium text-slate-900 text-sm mb-1">
                      {getCategoryName(photo.category)}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(photo.savedAt)}
                    </div>
                  </div>
                  <div className="flex items-center pr-3">
                    <Eye className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="relative flex-shrink-0">
              <img
                src={selectedPhoto.imageData}
                alt="Photo"
                className="w-full aspect-[3/4] object-cover"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
              <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                <Badge
                  variant={selectedPhoto.validation.passed ? 'success' : 'danger'}
                >
                  {selectedPhoto.validation.passed ? 'Passed' : 'Failed'} - {selectedPhoto.validation.overallScore}%
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-semibold text-slate-900 mb-2">
                {getCategoryName(selectedPhoto.category)}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {formatDate(selectedPhoto.savedAt)}
              </p>

              <div className="space-y-2">
                {selectedPhoto.validation.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    {rule.passed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {rule.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {rule.details || rule.description}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${
                      rule.score >= 80 ? 'text-emerald-600' :
                      rule.score >= 60 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {Math.round(rule.score)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-3">
              <Button
                variant="danger"
                onClick={() => handleDelete(selectedPhoto.id)}
                loading={deleting === selectedPhoto.id}
                fullWidth
                icon={<Trash2 className="w-4 h-4" />}
              >
                Hapus
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedPhoto(null)}
                fullWidth
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};
