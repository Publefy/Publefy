import axios, { AxiosRequestConfig, AxiosInstance } from "axios";
import { axiosConfig } from "@/services/api/apiConfig";
 
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return v ? v[2] : null;
}

export class ApiService {
  axiosClient: AxiosInstance;


      async postLong<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.axiosClient.post<T>(url, data, {
      timeout: 180_000, 
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      ...config,
    });
  }

  constructor() {
    this.axiosClient = axios.create(axiosConfig); 
    this.axiosClient.interceptors.request.use((config) => { 
      let token: string | null = null;
      if (typeof window !== "undefined") {
        token = localStorage.getItem("userToken") || getCookie("userToken");
      }
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosClient.get<T>(url, config);
      return response.data;
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }
  

 
  async post<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    try { 
      let finalConfig = { ...config };
      if (typeof window !== "undefined" && data instanceof FormData) {
        finalConfig.headers = {
          ...finalConfig.headers,
          "Content-Type": "multipart/form-data",
        };
      }
      const response = await this.axiosClient.post<T>(url, data, finalConfig);
      return response.data;
    } catch (error: any) {
      // Check for duplicate key errors and provide better logging
      const errorMessage = error?.response?.data?.error || error?.message || '';
      if (errorMessage.includes('E11000') || errorMessage.includes('duplicate key')) {
        console.log("ℹ️ Duplicate key detected (this is usually safe to ignore):", errorMessage);
      } else {
        console.error("Error posting data:", error);
      }
      throw error;
    }
  }

  async patch<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosClient.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      console.error("Error patching data:", error);
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<{ data: T; status: number }> {
    try {
      const response = await this.axiosClient.delete<T>(url, config);
      return { data: response.data, status: response.status };
    } catch (error) {
      console.error("Error deleting data:", error);
      throw error;
    }
  }
}

export const apiServiceDefault = new ApiService();
