// ============ Custom Error Class ============
export class ApiError extends Error {
    public statusCode: number;
    public errors?: Record<string, string[]>;
    public data?: any;
  
    constructor(message: string, statusCode: number = 500, errors?: Record<string, string[]>, data?: any) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.errors = errors;
      this.data = data;
      
      // Maintains proper stack trace for where our error was thrown (only available on V8)
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, ApiError);
      }
    }
  
    /**
     * Get formatted error message for display
     */
    getDisplayMessage(): string {
      if (this.errors) {
        // Flatten all error messages
        const allErrors = Object.values(this.errors).flat();
        return allErrors.join(', ');
      }
      return this.message;
    }
  
    /**
     * Get errors for a specific field
     */
    getFieldErrors(field: string): string[] {
      if (this.errors && this.errors[field]) {
        return this.errors[field];
      }
      return [];
    }
  
    /**
     * Check if error has field-specific errors
     */
    hasFieldErrors(): boolean {
      return !!this.errors && Object.keys(this.errors).length > 0;
    }
   
    /**
     * Convert to string for logging
     */
    toString(): string {
      return `ApiError [${this.statusCode}]: ${this.message}`;
    }
  }
  
  // ============ Complete API Client ============
  import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
  
  const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/realtor/api';
  
  // ============ Types ============
  export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data: T;
    errors?: Record<string, string[]>;
  }
  
  export interface User {
    uuid: string;
    name: string;
    email: string;
    phone: string;
    role: 'buyer' | 'seller' | 'lawyer' | 'admin';
    email_verified: boolean;
    is_active: boolean;
    created_at: string;
    last_login?: string;
  }
  
  // ============ API Client ============
  class ApiClient {
    private api: AxiosInstance;
    private static instance: ApiClient;
    private isRefreshing = false;
    private refreshSubscribers: ((token: string) => void)[] = [];
  
    private constructor() {
      this.api = axios.create({
        baseURL: API_URL,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });
  
      // Request Interceptor - Add token
      this.api.interceptors.request.use(
        (config) => {
          const token = localStorage.getItem('access_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        },
        (error) => Promise.reject(error)
      );
  
      // Response Interceptor - Handle errors and token refresh
      this.api.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;
  
          // Extract error details from response
          const statusCode = error.response?.status || 500;
          const responseData = error.response?.data || {};
          
          // Get error message from your API format: { success: false, message: "..." }
          let message = responseData.message || error.message || 'An error occurred';
          let errors = responseData.errors || responseData.data?.errors || undefined;
          let data = responseData.data || undefined;
  
          // If there are validation errors, format them nicely
          if (errors && typeof errors === 'object') {
            const errorMessages = Object.values(errors).flat();
            message = errorMessages.join(', ');
          }
  
          const apiError = new ApiError(message, statusCode, errors, data);
  
          // Handle 401 - Token expired
          if (statusCode === 401 && !originalRequest._retry) {
            if (this.isRefreshing) {
              // If already refreshing, queue the request
              return new Promise((resolve) => {
                this.refreshSubscribers.push((token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.api(originalRequest));
                });
              });
            }
  
            originalRequest._retry = true;
            this.isRefreshing = true;
  
            try {
              const refreshToken = localStorage.getItem('refresh_token');
              if (!refreshToken) {
                throw new Error('No refresh token');
              }
  
              const response = await axios.post(`${API_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });
  
              const { access_token, refresh_token } = response.data.data;
              
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', refresh_token);
  
              // Update authorization header
              this.api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  
              // Resolve all queued requests
              this.refreshSubscribers.forEach((callback) => callback(access_token));
              this.refreshSubscribers = [];
  
              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.api(originalRequest);
  
            } catch (refreshError) {
              // Refresh failed - logout user
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
              
              // Redirect to login if not already there
              if (!window.location.pathname.includes('/auth/login')) {
                window.location.href = '/auth/login';
              }
              
              return Promise.reject(new ApiError('Session expired. Please login again.', 401));
            } finally {
              this.isRefreshing = false;
            }
          }
  
          return Promise.reject(apiError);
        }
      );
    }
  
    public static getInstance(): ApiClient {
      if (!ApiClient.instance) {
        ApiClient.instance = new ApiClient();
      }
      return ApiClient.instance;
    }
  
    public async request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
      try {
        const response: AxiosResponse<ApiResponse<T>> = await this.api.request(config);
        return response.data;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError('An unexpected error occurred', 500);
      }
    }
  
    public async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
        // If params is a plain object, use it directly
        // If params is nested with a 'params' key, flatten it
        let queryParams = params;
        if (params && params.params) {
          // Handle the case where { params: { ... } } is passed
          queryParams = params.params;
        }
        return this.request<T>({ 
          method: 'GET', 
          url, 
          params: queryParams 
        });
      }
  
    public async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
      return this.request<T>({ method: 'POST', url, data });
    }
  
    public async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
      return this.request<T>({ method: 'PUT', url, data });
    }
  
    public async delete<T>(url: string, data?: any): Promise<ApiResponse<T>> {
      return this.request<T>({ method: 'DELETE', url, data });
    }
  
    public async upload<T>(url: string, file: File, fieldName: string = 'file'): Promise<ApiResponse<T>> {
      const formData = new FormData();
      formData.append(fieldName, file);
      
      return this.request<T>({
        method: 'POST',
        url,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }
  }
  
  export const api = ApiClient.getInstance();
  
  // ============ API Functions ============
  export const AuthAPI = {
    login: (email: string, password: string) => 
      api.post<{ access_token: string; refresh_token: string; user: User }>('/auth/login', { email, password }),
    
    register: (data: { full_name: string; email: string; password: string; phone: string; role?: string; address?: string; city?: string; state?: string }) => 
      api.post<{ uuid: string; email: string; role: string }>('/auth/register', data),
    
    verifyEmail: (uuid: string, otp: string) => 
      api.post('/auth/verify-email', { uuid, otp }),
    
    resendVerification: (uuid: string) => 
      api.post('/auth/resend-verification', { uuid }),

    forgotPassword: async (email: string) => {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    },
    
    resetPassword: async (uuid: string, otp: string, new_password: string) => {
      const response = await api.post('/auth/reset-password', { uuid, otp, new_password });
      return response.data;
    },
    
    logout: (refresh_token: string) => 
      api.post('/auth/logout', { refresh_token }),
    
    refresh: (refresh_token: string) => 
      api.post<{ access_token: string; refresh_token: string }>('/auth/refresh', { refresh_token }),
  };
  
  export const UserAPI = {
    getProfile: () => 
      api.get<User>('/user/profile'),

    updateBankDetails: (data: { bank_name: string; account_number: string; account_name: string }) => 
      api.post('/user/update-bank', data),
    
    
    updateProfile: (data: { name?: string; phone?: string; address?: string; city?: string; state?: string; country?: string }) => 
      api.put('/user/update', data),
    
    changePassword: (current_password: string, new_password: string, confirm_password: string) => 
      api.post('/user/change-password', { current_password, new_password, confirm_password }),
    
    uploadPhoto: (photo: string) => 
      api.post<{ photo_url: string }>('/user/upload-photo', { photo }),
    
    deleteAccount: (password: string) => 
      api.delete('/user/delete', { password }),
  };
  
  export const PropertyAPI = {
    create: (data: any) => 
      api.post<{ uuid: string }>('/property/create', data),
    delete: async (uuid: string) => {
      const response = await api.delete('/property/delete', {uuid});
      return response.data;
    },
    
    update: (data: any) => 
      api.put('/property/update', data),
    
    get: (uuid: string) => 
      api.get<Property>(`/property/get`, { uuid }),
    userList: async (page: number = 1, limit: number = 20) => {
      const response = await api.get('/property/user/list', { page, limit });
      return response.data;
    },
    
    list: (page: number = 1, limit: number = 20) => 
      api.get<{ properties: Property[]; pagination: any }>('/property/list', { page, limit }),
    
    adminlist: (page: number = 1, limit: number = 20) => 
        api.get<{ properties: Property[]; pagination: any }>('/admin/properties', { page, limit }),
      

    
    search: (params: any) => 
      api.post<{ properties: Property[]; pagination: any }>('/property/search', params),
    
    favorite: (property_uuid: string) => 
      api.post('/property/favorite', { property_uuid }),
    
    unfavorite: (property_uuid: string) => 
      api.delete('/property/unfavorite', { property_uuid }),
    
    getFavorites: () => 
      api.get('/property/favorites'),
    
    adminApprove: (uuid: string) => 
      api.post('/property/admin/approve', { uuid }),
    
    adminReject: (uuid: string, reason: string) => 
      api.post('/property/admin/reject', { uuid, reason }),
  };
  
  export const LawyerAPI = {
    register: (data: any) => 
      api.post('/lawyer/register', data),
    
    getProfile: () => 
      api.get<Lawyer>('/lawyer/profile'),
    
    discover: (params: { state?: string; min_rating?: number; page?: number; limit?: number }) => 
      api.post<{ lawyers: Lawyer[] }>('/lawyer/discover', params),
    
    adminList: (params: { state?: string; min_rating?: number; page?: number; limit?: number }) => 
      api.post<{ lawyers: Lawyer[] }>('/lawyer/admin/list', params),
    
    adminApprove: (user_uuid: string) => 
      api.post('/lawyer/admin/approve', { user_uuid }),
    
    adminReject: (user_uuid: string, reason: string) => 
      api.post('/lawyer/admin/reject', { user_uuid, reason }),
  };
  
  export const KYCAPI = {
    submit: (data: { document_type: string; document: string; document_number?: string }) => 
      api.post('/kyc/submit', data),
    
    getStatus: () => 
      api.get<{ documents: KYCDocument[] }>('/kyc/status'),
    
    adminList: (status: string = 'pending', page: number = 1) => 
      api.get('/kyc/admin/list', { status, page }),
    
    adminApprove: (id: string) => 
      api.post('/kyc/admin/approve', { id }),
    
    adminReject: (id: string, reason: string) => 
      api.post('/kyc/admin/reject', { id, reason }),
  };
  
  export const EscrowAPI = {
    create: (property_uuid: string, lawyer_uuid: string) => 
      api.post<{ uuid: string; total_amount: number }>('/escrow/create', { property_uuid, lawyer_uuid }),
    
    get: (uuid: string) => 
      api.get<EscrowTransaction>('/escrow/get', { uuid }),
    
    list: (page: number = 1) => 
      api.get<{ escrows: EscrowTransaction[] }>('/escrow/list', { page }),
    
    adminList: (page: number = 1) => 
      api.get<{ escrows: EscrowTransaction[] }>('/escrow/admin/list', { page }),
    
    
    fund: (escrow_uuid: string) => 
      api.post('/escrow/fund', { escrow_uuid }),
    
    sellerConfirm: (escrow_uuid: string) => 
      api.post('/escrow/confirm', { escrow_uuid }),
    
    lawyerApprove: (escrow_uuid: string) => 
      api.post('/escrow/approve', { escrow_uuid }),
    
    release: (escrow_uuid: string) => 
      api.post('/escrow/release', { escrow_uuid }),
  };
  
  export const PaymentAPI = {
    initialize: (escrow_uuid: string) => 
      api.post<{ authorization_url: string; reference: string; payment_uuid: string }>('/payment/initialize', { escrow_uuid }),
    
    verify: (reference: string) => 
      api.get('/payment/verify', { reference }),
    
    history: (page: number = 1) => 
      api.get('/payment/history', { page }),
  };
  
  export const ChatAPI = {
    send: (receiver_uuid: string, message: string, image?: string) => 
      api.post<{ uuid: string; conversation_uuid: string; message_type: string; message: string; created_at: string }>('/chat/send', { receiver_uuid, message, image }),
    
  
    typing: (conversation_uuid: string, is_typing: boolean) => 
      api.post('/chat/typing', { conversation_uuid, is_typing }),
    
  

    getConversations: async () => {
        const response = await api.get('/chat/list');
        return response.data;
      },
      
      getMessages: async (conversationUuid: string) => {
        console.log('conversationUuid',conversationUuid)
        const response = await api.get('/chat/messages', {
          params: { conversation_uuid: conversationUuid }
        });
        return response.data;
      },
      
      sendMessage: async (data: {
        conversation_uuid: string;
        receiver_uuid: string;
        message: string;
        message_type?: string;
      }) => {
        const response = await api.post('/chat/send', data);
        return response.data;
      },
      
      createConversation: async (participantUuid: string) => {
        const response = await api.post('/chat/create', {
          participant_uuid: participantUuid
        });
        return response.data;
      },
      
      markAsRead: async (conversationUuid: string) => {
        const response = await api.post('/chat/read', {
          conversation_uuid: conversationUuid
        });
        return response.data;
      },
      
      deleteMessage: async (messageUuid: string) => {
        const response = await api.delete('/chat/delete', {
          data: { message_uuid: messageUuid }
        });
        return response.data;
      }
  };
  
  export const DisputeAPI = {
    create: (data: { escrow_uuid: string; against_uuid: string; title: string; description: string; evidence?: string[] }) => 
      api.post<{ uuid: string }>('/dispute/create', data),
    
    get: (uuid: string) => 
      api.get<Dispute>('/dispute/get', { uuid }),
    
    list: (page: number = 1) => 
      api.get<{ disputes: Dispute[]; pagination: any }>('/dispute/list', { page }),
    
    adminList: (status: string = 'open', page: number = 1) => 
      api.get<{ disputes: Dispute[]; pagination: any }>('/dispute/admin/list', { status, page }),
    
    adminResolve: (uuid: string, resolution: string, action: 'refund_buyer' | 'release_seller' | 'partial_refund' | 'cancel_transaction') => 
      api.post('/dispute/admin/resolve', { uuid, resolution, action }),
  };
  
  export const NotificationAPI = {
    list: (page: number = 1, is_read?: string) => 
      api.get<{ notifications: Notification[]; unread_count: number; pagination: any }>('/notification/list', { page, is_read }),
    
    markAsRead: (notification_uuid: string) => 
      api.post('/notification/mark-read', { notification_uuid }),
    
    markAllAsRead: () => 
      api.post('/notification/mark-all-read'),
    
    delete: (notification_uuid: string) => 
      api.delete('/notification/delete', { notification_uuid }),
  };
  
  export const AdminAPI = {
    dashboard: () => 
      api.get('/admin/dashboard'),
    
    getUsers: (page: number = 1, role?: string) => 
      api.get('/admin/users', { page, role }),
    
    getStats: () => 
      api.get('/admin/stats'),
    
    updateSettings: (key: string, value: string) => 
      api.put('/admin/settings', { key, value }),
  };
  
  // ============ Types for API responses ============
  export interface Property {
    uuid: string;
    title: string;
    description: string;
    property_type: string;
    price: number;
    address: string;
    city: string;
    state: string;
    country: string;
    bedrooms: number;
    bathrooms: number;
    square_meters: number;
    status: 'pending' | 'approved' | 'rejected' | 'sold';
    views: number;
    is_featured: boolean;
    created_at: string;
    images: string[];
    features: string[];
    seller_name: string;
    seller_email: string;
    seller_phone: string;
    seller_uuid?: string;
  }
  
  export interface Lawyer {
    user_uuid: string;
    license_number: string;
    bar_certificate_url: string;
    years_experience: number;
    specialization: string;
    jurisdiction_states: string[];
    rating: number;
    total_cases: number;
    completed_cases: number;
    is_approved: boolean;
    is_verified: boolean;
    created_at: string;
    name: string;
    email: string;
    phone: string;
    state: string;
    bio?: string;
    full_name?: string;
    specialty?: string;
  }
  
  export interface EscrowTransaction {
    uuid: string;
    property_uuid: string;
    buyer_uuid: string;
    seller_uuid: string;
    lawyer_uuid: string;
    amount: number;
    fee: number;
    total_amount: number;
    status: 'pending' | 'under_review' | 'buyer_funded' | 'seller_confirmed' | 'lawyer_approved' | 'completed' | 'cancelled' | 'disputed' | 'refunded';
    payment_reference: string;
    funded_at: string;
    seller_confirmed_at: string;
    lawyer_approved_at: string;
    released_at: string;
    created_at: string;
    property_title: string;
    buyer_name: string;
    seller_name: string;
    lawyer_name: string;
  }
  
  export interface KYCDocument {
    document_type: string;
    document_url: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_comment: string;
    created_at: string;
  }
  
  export interface Dispute {
    uuid: string;
    escrow_uuid: string;
    raised_by_uuid: string;
    against_uuid: string;
    title: string;
    description: string;
    evidence_urls: string[];
    status: 'open' | 'resolved';
    resolution: string;
    created_at: string;
    raised_by_name: string;
    against_name: string;
    property_title: string;
  }
  
  export interface Notification {
    uuid: string;
    type: string;
    title: string;
    message: string;
    data: any;
    is_read: boolean;
    created_at: string;
  }
  
  export interface ChatMessage {
    uuid: string;
    sender_uuid: string;
    receiver_uuid: string;
    message_type: 'text' | 'image';
    message: string;
    file_url: string | null;
    file_name: string | null;
    is_read: boolean;
    created_at: string;
  }