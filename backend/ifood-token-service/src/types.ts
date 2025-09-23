export interface TokenRequest {
  clientId: string;
  clientSecret: string;
  user_id: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  created_at: string;
  expires_at: string;
}

export interface IFoodTokenData {
  accessToken: string;
  expiresIn: number;
  tokenType?: string;
}

export interface StoredToken {
  client_id: string;
  client_secret: string;
  access_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  token_updated_at?: string;
  user_id: string;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}