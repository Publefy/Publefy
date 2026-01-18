'use client';

import { useEffect, useState } from 'react';
import { googleAuthService } from '@/services/api/google-auth-service';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GoogleCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tryStoreTokenFromQueryOrHash = () => {
      try {
        const url = new URL(window.location.href);
        let token = url.searchParams.get('access_token');
        let userParam = url.searchParams.get('user');
        if (!token && window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.substring(1));
          token = hash.get('access_token') || token;
          userParam = hash.get('user') || userParam;
        }
        if (token) {
          googleAuthService.saveToken(token);
          if (userParam) {
            try {
              const parsed = JSON.parse(userParam);
              localStorage.setItem('user', JSON.stringify(parsed));
            } catch {
              try {
                const decoded = atob(userParam);
                const parsed2 = JSON.parse(decoded);
                localStorage.setItem('user', JSON.stringify(parsed2));
              } catch {}
            }
          }
          // cleanup URL
          url.searchParams.delete('access_token');
          url.searchParams.delete('user');
          window.history.replaceState({}, '', url.pathname + url.search);
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };

    const run = async () => {
      // 1) Пробуем схему, когда бэкенд уже вернул токен
      const stored = tryStoreTokenFromQueryOrHash();
      if (stored) {
        window.location.replace('/');
        return;
      }

      // 2) Классический OAuth (code/state)
      const params = googleAuthService.checkForGoogleCallback();
      if (!params) {
        // Мягко уходим на главную, чтобы не оставаться на пустой странице
        setTimeout(() => window.location.replace('/'), 600);
        return;
      }
      try {
        const res = await googleAuthService.handleGoogleCallback(params.code, params.state);
        if (res.success && res.token) {
          googleAuthService.saveToken(res.token);
          googleAuthService.clearOAuthParams();
          window.location.replace('/');
          return;
        }
        setError(res.message || 'Не удалось завершить аутентификацию');
      } catch (e: any) {
        setError(e?.message || 'Ошибка при обработке колбэка');
      }
    };
    run();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="text-red-600 font-medium">{error}</div>
          <Link href="/" className="text-blue-600 hover:underline">На главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="flex items-center gap-3 text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Завершаем вход через Google…</span>
      </div>
    </div>
  );
}


