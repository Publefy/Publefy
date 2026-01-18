import { FULL_ENDPOINTS, API_BASE, API_ENDPOINTS } from './apiConfig';
import { saveAuthMethod, removeAuthMethod } from '@/utils/auth-method';

// Интерфейсы для Google OAuth
export interface GoogleAuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  token?: string;
  redirect_url?: string;
}

export interface GoogleCallbackResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  token?: string;
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private currentBaseUrl: string;

  constructor() {
    this.currentBaseUrl = API_BASE;
  }

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Устанавливает базовый URL для API
   */
  public setBaseUrl(url: string): void {
    this.currentBaseUrl = url;
  }

  /**
   * Получает URL для начала Google OAuth процесса
   */
  public getGoogleLoginUrl(): string {
    // В проде бэкенд сам управляет redirect_uri (GOOGLE_LOGIN_REDIRECT_URI)
    // В локале пробрасываем redirect_uri на фронт, чтобы замкнуть цикл
    const base = `${this.currentBaseUrl}${API_ENDPOINTS.auth.google.login}`;
    return base;
  }

  /**
   * Получает URL для callback Google OAuth
   */
  public getGoogleCallbackUrl(): string {
    return `${this.currentBaseUrl}${API_ENDPOINTS.auth.google.callback}`;
  }

  /**
   * Инициирует Google OAuth: делаем прямой GET-редирект на /auth/google/login
   * Это надежнее, чем ожидать JSON-ответ с redirect_url (CORS/302 проблемы).
   */
  public initiateGoogleAuth(): { redirect_url: string } {
    const directUrl = this.getGoogleLoginUrl();
    return { redirect_url: directUrl };
  }

  /**
   * Инициирует Google OAuth и выполняет редирект
   */
  public async initiateGoogleAuthAndRedirect(): Promise<void> {
    const { redirect_url } = this.initiateGoogleAuth();
    if (typeof window !== 'undefined') {
      console.log('🔄 Выполняем редирект на:', redirect_url);
      window.location.href = redirect_url;
    }
  }

  /**
   * Fallback метод - прямой редирект на Google OAuth (если API недоступен)
   */
  private fallbackDirectRedirect(): void {
    if (typeof window === 'undefined') return;
    const directUrl = this.getGoogleLoginUrl();
    console.log('🔄 Fallback редирект на:', directUrl);
    window.location.href = directUrl;
  }

  /**
   * Обрабатывает callback от Google OAuth
   * @param code - код авторизации от Google
   * @param state - состояние для проверки безопасности
   */
  public async handleGoogleCallback(code: string, state?: string): Promise<GoogleCallbackResponse> {
    try {
      console.log('🔄 Обрабатываем Google OAuth callback...');
      
      const callbackUrl = this.getGoogleCallbackUrl();
      const params = new URLSearchParams();
      params.append('code', code);
      if (state) {
        params.append('state', state);
      }

      const response = await fetch(`${callbackUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GoogleCallbackResponse = await response.json();
      
      console.log('✅ Google OAuth callback успешно обработан');
      return data;
    } catch (error) {
      console.error('❌ Ошибка при обработке Google OAuth callback:', error);
      throw error;
    }
  }

  /**
   * Проверяет, есть ли параметры Google OAuth в URL
   */
  public checkForGoogleCallback(): { code: string; state?: string } | null {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code) {
      return { code, state: state || undefined };
    }

    return null;
  }

  /**
   * Очищает URL от параметров OAuth после успешной аутентификации
   */
  public clearOAuthParams(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');

    window.history.replaceState({}, document.title, url.toString());
  }

  /**
   * Сохраняет токен в localStorage
   */
  public saveToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userToken', token);
      saveAuthMethod('google');
      console.log('💾 Токен сохранен в localStorage');
    }
  }

  /**
   * Получает токен из localStorage
   */
  public getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userToken');
    }
    return null;
  }

  /**
   * Удаляет токен из localStorage
   */
  public removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userToken');
      removeAuthMethod();
      console.log('🗑️ Токен удален из localStorage');
    }
  }

  /**
   * Проверяет, авторизован ли пользователь
   */
  public isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

// Экспортируем singleton instance
export const googleAuthService = GoogleAuthService.getInstance();
