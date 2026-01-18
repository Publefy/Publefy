'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { googleAuthService, GoogleCallbackResponse } from '@/services/api/google-auth-service';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface GoogleAuthButtonProps {
  onSuccess?: (user: any, token: string) => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccess,
  onError,
  className = '',
  children,
  variant = 'outline',
  size = 'default'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  // Проверяем callback при загрузке компонента
  useEffect(() => {
    const handleGoogleCallback = async () => {
      const callbackParams = googleAuthService.checkForGoogleCallback();
      
      if (callbackParams) {
        setIsProcessingCallback(true);
        
        try {
          console.log('🔄 Обрабатываем Google OAuth callback...');
          const response: GoogleCallbackResponse = await googleAuthService.handleGoogleCallback(
            callbackParams.code,
            callbackParams.state
          );

          if (response.success && response.token) {
            // Сохраняем токен
            googleAuthService.saveToken(response.token);
            
            // Очищаем URL от параметров OAuth
            googleAuthService.clearOAuthParams();
            
            // Показываем успешное сообщение
            toast.success('Успешный вход через Google!', {
              description: `Добро пожаловать, ${response.user?.name || 'Пользователь'}!`
            });

            // Вызываем callback успеха
            if (onSuccess && response.user) {
              onSuccess(response.user, response.token);
            }
          } else {
            throw new Error(response.message || 'Ошибка аутентификации');
          }
        } catch (error: any) {
          console.error('❌ Ошибка при обработке Google OAuth callback:', error);
          
          const errorMessage = error.message || 'Произошла ошибка при входе через Google';
          toast.error('Ошибка входа', {
            description: errorMessage
          });

          if (onError) {
            onError(errorMessage);
          }
        } finally {
          setIsProcessingCallback(false);
        }
      }
    };

    handleGoogleCallback();
  }, [onSuccess, onError]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 Инициируем Google OAuth через API...');
      await googleAuthService.initiateGoogleAuthAndRedirect();
    } catch (error: any) {
      console.error('❌ Ошибка при инициировании Google OAuth:', error);
      
      let errorMessage = error.message || 'Произошла ошибка при инициировании входа через Google';
      
      // Специальные сообщения для разных типов ошибок
      if (error.message.includes('Сервер недоступен')) {
        errorMessage = 'API сервер недоступен. Попробуйте позже.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'Ошибка CORS. Обратитесь к администратору.';
      }
      
      toast.error('Ошибка входа', {
        description: errorMessage
      });

      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Показываем индикатор загрузки при обработке callback
  if (isProcessingCallback) {
    return (
      <Button
        disabled
        variant={variant}
        size={size}
        className={`w-full ${className}`}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Обработка входа...
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleGoogleLogin}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={`w-full ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Перенаправление...
        </>
      ) : (
        children || (
          <>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Войти через Google
          </>
        )
      )}
    </Button>
  );
};

export default GoogleAuthButton;
