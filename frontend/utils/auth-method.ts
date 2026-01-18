export type AuthMethod = 'email' | 'google' | 'facebook';

export const AUTH_METHOD_KEY = 'authMethod';

/**
 * Сохраняет способ аутентификации в localStorage
 */
export const saveAuthMethod = (method: AuthMethod): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_METHOD_KEY, method);
    console.log(`💾 Способ аутентификации сохранен: ${method}`);
  }
};

/**
 * Получает способ аутентификации из localStorage
 */
export const getAuthMethod = (): AuthMethod | null => {
  if (typeof window !== 'undefined') {
    const method = localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod;
    return method || null;
  }
  return null;
};

/**
 * Удаляет способ аутентификации из localStorage
 */
export const removeAuthMethod = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_METHOD_KEY);
    console.log('🗑️ Способ аутентификации удален');
  }
};

/**
 * Получает отображаемое название способа аутентификации
 */
export const getAuthMethodDisplayName = (method: AuthMethod): string => {
  switch (method) {
    case 'email':
      return 'Email';
    case 'google':
      return 'Google';
    case 'facebook':
      return 'Facebook';
    default:
      return 'Неизвестно';
  }
};

/**
 * Получает иконку для способа аутентификации
 */
export const getAuthMethodIcon = (method: AuthMethod): string => {
  switch (method) {
    case 'email':
      return '📧';
    case 'google':
      return '🔍';
    case 'facebook':
      return '📘';
    default:
      return '❓';
  }
};
