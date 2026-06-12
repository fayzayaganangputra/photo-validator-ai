import React from 'react';
import { ArrowLeft, Home, Image, LucideIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  actions,
  className = ''
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <header className={`sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 ${className}`}>
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};

interface BottomNavProps {
  activeRoute?: string;
}

export const BottomNav: React.FC<BottomNavProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: { path: string; label: string; icon: LucideIcon }[] = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/gallery', label: 'Gallery', icon: Image }
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                active
                  ? 'text-teal-600 bg-teal-50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
};
