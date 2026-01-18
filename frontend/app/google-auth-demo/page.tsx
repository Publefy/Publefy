'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Mail, Shield } from 'lucide-react';

const GoogleAuthDemo: React.FC = () => {
  const { isAuthenticated, isLoading, user, token, login, logout } = useGoogleAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800">
              Google OAuth Demo
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Демонстрация входа через Google OAuth
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Статус аутентификации */}
            <div className="flex items-center justify-center">
              <Badge 
                variant={isAuthenticated ? "default" : "secondary"}
                className="text-sm px-4 py-2"
              >
                <Shield className="w-4 h-4 mr-2" />
                {isAuthenticated ? 'Аутентифицирован' : 'Не аутентифицирован'}
              </Badge>
            </div>

            {/* Информация о пользователе */}
            {isAuthenticated && user && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg text-green-800 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Информация о пользователе
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      <strong>Email:</strong> {user.email}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      <strong>Имя:</strong> {user.name}
                    </span>
                  </div>
                  {user.picture && (
                    <div className="flex items-center space-x-2">
                      <img 
                        src={user.picture} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-sm text-gray-700">Аватар</span>
                    </div>
                  )}
                  {token && (
                    <div className="mt-3 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                      <strong>Токен:</strong> {token.substring(0, 50)}...
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Кнопки действий */}
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="space-y-3">
                  <GoogleAuthButton
                    onSuccess={(user, token) => {
                      console.log('Успешный вход:', user, token);
                    }}
                    onError={(error) => {
                      console.error('Ошибка входа:', error);
                    }}
                    className="w-full"
                  />
                  
                  <div className="text-center text-sm text-gray-500">
                    или
                  </div>
                  
                  <Button
                    onClick={login}
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                  >
                    Альтернативный способ входа
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={logout}
                  variant="destructive"
                  className="w-full"
                  disabled={isLoading}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </Button>
              )}
            </div>

            {/* Информация о API */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-800">
                  API Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="font-mono bg-white p-2 rounded border">
                  <strong>GET</strong> /auth/google/login
                </div>
                <div className="font-mono bg-white p-2 rounded border">
                  <strong>GET</strong> /auth/google/callback
                </div>
                <div className="text-gray-600 mt-2">
                  Базовый URL: <code>https://api.publefy.com</code>
                </div>
              </CardContent>
            </Card>

            {/* Инструкции */}
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-lg text-yellow-800">
                  Инструкции
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-yellow-700 space-y-2">
                <p>1. Убедитесь, что API сервер запущен</p>
                <p>2. Нажмите "Войти через Google"</p>
                <p>3. Вы будете перенаправлены на Google OAuth</p>
                <p>4. После авторизации вернетесь на эту страницу</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GoogleAuthDemo;
