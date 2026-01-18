'use client';

import { useState, useEffect, useCallback } from 'react';
import { googleAuthService, GoogleCallbackResponse } from '@/services/api/google-auth-service';
import { toast } from 'sonner';

interface UseGoogleAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  token: string | null;
  login: () => void;
  logout: () => void;
  checkAuth: () => boolean;
}

export const useGoogleAuth = (): UseGoogleAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Проверяем аутентификацию при инициализации
  useEffect(() => {
    const checkInitialAuth = () => {
      const currentToken = googleAuthService.getToken();
      if (currentToken) {
        setToken(currentToken);
        setIsAuthenticated(true);
        // Здесь можно добавить запрос для получения данных пользователя
      }
    };

    checkInitialAuth();
  }, []);

  // Обрабатываем Google OAuth callback
  useEffect(() => {
    const handleGoogleCallback = async () => {
      const callbackParams = googleAuthService.checkForGoogleCallback();
      
      if (callbackParams) {
        setIsLoading(true);
        
        try {
          console.log('🔄 Обрабатываем Google OAuth callback...');
          const response: GoogleCallbackResponse = await googleAuthService.handleGoogleCallback(
            callbackParams.code,
            callbackParams.state
          );

          if (response.success && response.token) {
            // Сохраняем токен
            googleAuthService.saveToken(response.token);
            setToken(response.token);
            setIsAuthenticated(true);
            
            if (response.user) {
              setUser(response.user);
            }
            
            // Очищаем URL от параметров OAuth
            googleAuthService.clearOAuthParams();
            
            // Показываем успешное сообщение
            toast.success('Успешный вход через Google!', {
              description: `Добро пожаловать, ${response.user?.name || 'Пользователь'}!`
            });
          } else {
            throw new Error(response.message || 'Ошибка аутентификации');
          }
        } catch (error: any) {
          console.error('❌ Ошибка при обработке Google OAuth callback:', error);
          
          const errorMessage = error.message || 'Произошла ошибка при входе через Google';
          toast.error('Ошибка входа', {
            description: errorMessage
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleGoogleCallback();
  }, []);

  const login = useCallback(async () => {
    try {
      console.log('🚀 Инициируем Google OAuth через API...');
      await googleAuthService.initiateGoogleAuthAndRedirect();
    } catch (error: any) {
      console.error('❌ Ошибка при инициировании Google OAuth:', error);
      
      const errorMessage = error.message || 'Произошла ошибка при инициировании входа через Google';
      toast.error('Ошибка входа', {
        description: errorMessage
      });
    }
  }, []);

  const logout = useCallback(() => {
    try {
      googleAuthService.removeToken();
      setToken(null);
      setIsAuthenticated(false);
      setUser(null);
      
      toast.success('Вы успешно вышли из системы');
    } catch (error: any) {
      console.error('❌ Ошибка при выходе:', error);
      toast.error('Ошибка при выходе из системы');
    }
  }, []);

  const checkAuth = useCallback(() => {
    const currentToken = googleAuthService.getToken();
    const isAuth = currentToken !== null;
    
    setIsAuthenticated(isAuth);
    setToken(currentToken);
    
    return isAuth;
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    token,
    login,
    logout,
    checkAuth
  };
};
