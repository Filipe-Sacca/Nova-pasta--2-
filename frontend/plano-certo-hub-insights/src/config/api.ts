// API Configuration
// Centralized API endpoint configuration for all environments

const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

// Detectar se está rodando em localhost
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Base URL do backend
export const API_BASE_URL = isLocalhost
  ? 'http://localhost:8093'
  : 'https://app.planocertodelivery.com/api';

// Export para compatibilidade com código existente
export const LOCAL_SERVICE_URL = API_BASE_URL;

console.log('🌐 API Config:', {
  environment: isProduction ? 'production' : 'development',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  API_BASE_URL
});
