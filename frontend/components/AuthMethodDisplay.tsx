'use client';

import React from 'react';
import { getAuthMethod, getAuthMethodDisplayName, getAuthMethodIcon, type AuthMethod } from '@/utils/auth-method';
import { Badge } from '@/components/ui/badge';

interface AuthMethodDisplayProps {
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const AuthMethodDisplay: React.FC<AuthMethodDisplayProps> = ({
  className = '',
  showIcon = true,
  variant = 'secondary'
}) => {
  const authMethod = getAuthMethod();

  // Не показываем способ аутентификации для Facebook, так как аккаунт автоматически привязывается
  if (!authMethod || authMethod === 'facebook') {
    return null;
  }

  const displayName = getAuthMethodDisplayName(authMethod);
  const icon = getAuthMethodIcon(authMethod);

  return (
    <Badge variant={variant} className={`flex items-center gap-1 ${className}`}>
      {showIcon && <span>{icon}</span>}
      <span>Login via {displayName}</span>
    </Badge>
  );
};

export default AuthMethodDisplay;
