import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Signpost, Hash, FileText, ArrowRight, Camera } from 'lucide-react';
import { Card, CardHeader, CardContent, BottomNav } from '../components/ui';
import { CATEGORIES, CategoryConfig } from '../types';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  User,
  Signpost,
  Hash,
  FileText
};

const CategoryCard: React.FC<{
  category: CategoryConfig;
  onSelect: (id: string) => void;
}> = ({ category, onSelect }) => {
  const Icon = iconMap[category.icon] || User;

  const gradientMap: Record<string, string> = {
    'person-product': 'from-teal-500 to-emerald-500',
    'signboard': 'from-blue-500 to-cyan-500',
    'serial-number': 'from-slate-600 to-slate-800',
    'bast-document': 'from-orange-500 to-amber-500'
  };

  return (
    <Card
      hoverable
      onClick={() => onSelect(category.id)}
      className="overflow-hidden"
    >
      <div className="flex items-stretch">
        <div className={`w-2 bg-gradient-to-b ${gradientMap[category.id] || 'from-teal-500 to-emerald-500'}`} />
        <div className="flex-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                <Icon className="w-6 h-6 text-slate-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">
                  {category.name}
                </h3>
                <p className="text-sm text-slate-500">{category.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {category.rules.slice(0, 3).map((rule, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full"
                >
                  {rule}
                </span>
              ))}
              {category.rules.length > 3 && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                  +{category.rules.length - 3}
                </span>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
};

export const CategorySelectionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSelectCategory = (categoryId: string) => {
    navigate(`/capture/${categoryId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
        <img
        src={`${import.meta.env.BASE_URL}seanantha.jfif`}
        alt="SEANANTHA"
        className="w-24 h-24 object-contain"
        />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
          </h1>
          <p className="text-slate-600">
            Pilih kategori untuk memvalidasi foto Anda terhadap persyaratan tertentu
          </p>
        </div>

        <div className="space-y-3">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onSelect={handleSelectCategory}
            />
          ))}
        </div>

        <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-sm text-blue-700">
            <strong>Offline capable:</strong> Aplikasi ini berfungsi secara offline. Foto dan validasi Anda disimpan secara lokal di perangkat Anda.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
