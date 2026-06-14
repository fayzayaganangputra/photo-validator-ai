import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Save, RotateCcw } from 'lucide-react';
import { Header, Button, Card, CardContent, Badge, ProgressBar, ValidationRuleItem } from '../components/ui';
import { CATEGORIES } from '../types';
import { savePhoto } from '../utils/storage';
import { ValidationResult } from '../types';

export const ValidationResultPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const imageData = location.state?.imageData as string;
  const validation = location.state?.validation as ValidationResult;

  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const category = CATEGORIES.find((c) => c.id === categoryId);

  if (!imageData || !validation || !category) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Tidak ada foto untuk verifikasi.
          </h2>
          <p className="text-slate-600 mb-6">
            Mohon ambil foto terlebih dahulu.
          </p>
          <Button onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const handleRetake = () => {
    navigate(`/capture/${categoryId}`);
  };

  // 
  const handleSave = async () => {
  setIsSaving(true);

  try {
    // simpan ke galeri aplikasi
    await savePhoto(imageData, validation.category, validation);

    // simpan ke perangkat
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `${validation.category}-${Date.now()}.jpg`;
    link.click();

    setSaved(true);

    setTimeout(() => {
      navigate('/gallery');
    }, 1500);

  } catch (error) {
    console.error('Failed to save photo:', error);
  } finally {
    setIsSaving(false);
  }
};

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const toggleRule = (ruleId: string) => {
    setExpandedRule((prev) => (prev === ruleId ? null : ruleId));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header title="Hasil Validasi" showBack />

      <div className="max-w-lg mx-auto">
        <div className="relative">
          <img
            src={imageData}
            alt="Captured"
            className="w-full aspect-[3/4] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <Badge variant={validation.passed ? 'success' : 'danger'} size="sm">
              {category.name}
            </Badge>
          </div>
        </div>

        <div className="p-4 -mt-6 relative z-10">
          <Card className={`${getScoreBackground(validation.overallScore)} border-2`}>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {validation.passed ? (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="w-7 h-7 text-red-600" />
                    </div>
                  )}
                  <div>
                    <h2 className={`text-xl font-bold ${getScoreColor(validation.overallScore)}`}>
                      {validation.passed ? 'Valid' : 'Tidak Valid'}
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
                <span className="text-lg text-slate-500">/ 100</span>
                <div className="flex-1">
                  <ProgressBar value={validation.overallScore} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Detail Validasi
            </h3>
            <div className="space-y-2">
              {validation.rules.map((rule) => (
                <ValidationRuleItem
                  key={rule.id}
                  rule={rule}
                  expanded={expandedRule === rule.id}
                  onToggle={() => toggleRule(rule.id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={handleRetake}
              fullWidth
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Ambil Ulang Foto
            </Button>

            {validation.passed && (
              <Button
                onClick={handleSave}
                fullWidth
                loading={isSaving}
                disabled={saved}
                icon={saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              >
                {saved ? 'Saved!' : 'Simpan ke Perangkat'}
              </Button>
            )}
          </div>

          {!validation.passed && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Catatan:</strong> Validasi foto gagal. Mohon ambil foto ulang dengan memenuhi semua persyaratan untuk hasil terbaik.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
