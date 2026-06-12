import React from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ValidationRule } from '../../types';

interface ValidationRuleItemProps {
  rule: ValidationRule;
  expanded?: boolean;
  onToggle?: () => void;
}

export const ValidationRuleItem: React.FC<ValidationRuleItemProps> = ({
  rule,
  expanded = false,
  onToggle
}) => {
  const getIcon = () => {
    if (rule.passed) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
    }
    if (rule.score > 50) {
      return <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
    }
    return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
  };

  const scoreColor = rule.score >= 80
    ? 'text-emerald-600'
    : rule.score >= 60
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div
      className={`border border-slate-200 rounded-xl transition-all ${
        expanded ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3"
      >
        {getIcon()}
        <div className="flex-1 text-left">
          <p className={`font-medium ${rule.passed ? 'text-slate-900' : 'text-slate-700'}`}>
            {rule.name}
          </p>
          <p className="text-sm text-slate-500">{rule.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${scoreColor}`}>
            {Math.round(rule.score)}%
          </span>
        </div>
      </button>
      {expanded && rule.details && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-sm text-slate-600 pl-8">{rule.details}</p>
        </div>
      )}
    </div>
  );
};
