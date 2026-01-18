'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { saveAuthMethod, removeAuthMethod } from '@/utils/auth-method';
import { apiServiceDefault } from '@/services/api/api-service';

export default function FacebookCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleFacebookCallback = async () => {
      try {
        const url = new URL(window.location.href);
        
        // Проверяем параметры ошибки Facebook
        const errorParam = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');
        
        if (errorParam) {
          // Обрабатываем ошибки Facebook
          if (errorParam === 'access_denied' || errorParam === 'user_cancelled') {
            // Пользователь отменил авторизацию
            removeAuthMethod(); // Удаляем способ аутентификации
            setError('Facebook authorization was cancelled');
            setIsProcessing(false);
            return;
          } else {
            // Другие ошибки
            removeAuthMethod();
            setError(`Facebook error: ${errorDescription || errorParam}`);
            setIsProcessing(false);
            return;
          }
        }

        // Проверяем успешный callback
        const accessToken = url.searchParams.get('access_token');
        const userParam = url.searchParams.get('user');
        
        if (accessToken) {
          // Сохраняем токен и данные пользователя
          document.cookie = `userToken=${accessToken}; Path=/; Max-Age=604800; Secure; SameSite=Strict`;
          localStorage.setItem('userToken', accessToken);
          
          let userData = null;
          if (userParam) {
            try {
              userData = JSON.parse(userParam);
              localStorage.setItem('user', JSON.stringify(userData));
            } catch {
              try {
                const decoded = atob(userParam);
                userData = JSON.parse(decoded);
                localStorage.setItem('user', JSON.stringify(userData));
              } catch {
                console.warn('Failed to parse user data');
              }
            }
          }
          
          // Сохраняем способ аутентификации
          saveAuthMethod('facebook');
          
          // Автоматически привязываем Facebook аккаунт
          try {
            if (userData && userData.id) {
              // Создаем профиль Facebook
              const facebookProfile = {
                id: userData.id,
                name: userData.name || userData.first_name + ' ' + userData.last_name,
                username: userData.username || userData.name,
                platform: 'facebook',
                image: userData.picture?.data?.url || '',
                access_token: accessToken,
                fb_id: userData.id
              };
              
              // Отправляем данные на сервер для привязки аккаунта
              await apiServiceDefault.post('/facebook/connect', {
                profile: facebookProfile,
                access_token: accessToken
              });
              
              console.log('✅ Facebook account successfully linked');
            }
          } catch (error: any) {
            // Check if it's a duplicate key error
            const errorMessage = error?.response?.data?.error || error?.message || '';
            const isDuplicateError = errorMessage.includes('E11000') || 
                                     errorMessage.includes('duplicate key') ||
                                     errorMessage.includes('already exists');
            
            if (isDuplicateError) {
              console.log('ℹ️ Facebook account is already connected. This account is ready to use!');
              // Profile already exists, this is fine - just continue
              // The profile list will be refreshed when redirected to home
            } else {
              console.warn('⚠️ Failed to automatically link Facebook account:', error);
              // Don't block login if account linking failed
            }
          }
          
          // Очищаем URL
          url.searchParams.delete('access_token');
          url.searchParams.delete('user');
          url.searchParams.delete('error');
          url.searchParams.delete('error_description');
          window.history.replaceState({}, '', url.pathname + url.search);
          
          // Перенаправляем на главную с флагом для перезагрузки профилей
          window.location.replace('/?reload_profiles=true');
          return;
        }

        // Если нет токена и нет ошибки, возможно это не Facebook callback
        removeAuthMethod();
        setError('Failed to complete Facebook authorization');
        setIsProcessing(false);
        
      } catch (error) {
        console.error('Error processing Facebook callback:', error);
        removeAuthMethod();
        setError('An error occurred while processing authorization');
        setIsProcessing(false);
      }
    };

    handleFacebookCallback();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="text-red-600 font-medium">{error}</div>
          <div className="space-y-2">
            <Link href="/" className="block text-blue-600 hover:underline">
              Go to Home
            </Link>
            <Link href="/?auth=login" className="block text-blue-600 hover:underline">
              Try Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="flex items-center gap-3 text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Completing Facebook login…</span>
      </div>
    </div>
  );
}
