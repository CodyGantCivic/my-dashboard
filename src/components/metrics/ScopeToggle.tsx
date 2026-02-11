import React from 'react';
import type { TimeScope } from '../../types/metrics';

interface ScopeToggleProps {
  currentScope: TimeScope;
  onScopeChange: (scope: TimeScope) => void;
}

export const ScopeToggle: React.FC<ScopeToggleProps> = ({
  currentScope,
  onScopeChange,
}) => {
  const scopes: TimeScope[] = ['weekly', 'monthly', 'yearly'];
  const scopeLabels: Record<TimeScope, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: '12px',
        width: 'fit-content',
      }}
    >
      {scopes.map((scope) => (
        <button
          key={scope}
          onClick={() => onScopeChange(scope)}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: currentScope === scope ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor:
              currentScope === scope
                ? 'var(--color-primary)'
                : 'transparent',
            color:
              currentScope === scope
                ? 'var(--color-background)'
                : 'var(--color-text-secondary)',
          }}
        >
          {scopeLabels[scope]}
        </button>
      ))}
    </div>
  );
};
