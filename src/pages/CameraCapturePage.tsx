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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

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
      setError('Unable to access camera. Please grant camera permissions or use Upload Test on laptop.');
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
      setError('Failed to validate image. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !categoryId) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);

    await validateAndNavigate(imageData);
  };

  const handleUploadTest = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !categoryId) return;

    const reader = new FileReader();

    reader.onload = async () => {
      const imageData = reader.result as string;

      setCapturedImage(imageData);
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
          <p className="text-lg">
Kategori tidak valid</p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header title={category.name} showBack className="bg-black border-transparent" />

      <div className="flex-1 relative flex flex-col">
        <div className="flex-1 relative bg-slate-900">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-slate-600 border-t-teal-500 rounded-full animate-spin mb-4" />
                <p className="text-slate-400">Menginisialisasi kamera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-20 p-4">
              <div className="text-center bg-slate-800 rounded-2xl p-6 max-w-sm">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-white mb-4">{error}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => startCamera()}>Coba lagi Kamera</Button>
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
                className="w-full h-full object-cover"
                style={{ opacity: isLoading ? 0 : 1 }}
              /> */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
                style={{ opacity: isLoading ? 0 : 1 }}
              />

              <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                <Badge variant="info">{category.name}</Badge>
              </div>

              <div className="absolute inset-0 pointer-events-none">
                {/* <div className="absolute inset-0 flex items-center justify-center"> */}
                <div className="w-[85%] h-[70%] border-2 border-white/50 rounded-2xl flex items-center justify-center">
                  <div className="w-3/4 h-3/4 border-2 border-white/30 rounded-2xl flex items-center justify-center">
                    <Focus className="w-8 h-8 text-white/30" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="relative w-full h-full">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />

              {isValidating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
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

      <div className="text-center text-xs text-slate-500 pb-4 bg-slate-900">
        {category.rules.length} aturan validasi
      </div>
    </div>
  );
};