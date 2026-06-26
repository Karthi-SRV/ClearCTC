/**
 * API endpoint constants
 * All API URLs are centralized here for easy maintenance
 */

// Base API path
export const API_BASE = '/api/v1';

// Auth endpoints
export const AUTH_LOGIN = `${API_BASE}/auth/login`;
export const AUTH_SIGNUP = `${API_BASE}/auth/signup`;

// Cities endpoint
export const CITIES = `${API_BASE}/cities`;

// Companies endpoint
export const COMPANIES = `${API_BASE}/companies`;

// City expenses endpoint
export const CITY_EXPENSES = `${API_BASE}/city-expenses`;

// Salary endpoints
export const SALARY_ASKS = `${API_BASE}/salary-asks`;
export const SALARY_COMPARISONS = `${API_BASE}/salary-comparisons`;

// Offer comparison endpoint
export const OFFER_COMPARISONS = `${API_BASE}/offer-comparisons`;

// Interview tracking endpoints
export const INTERVIEWS = `${API_BASE}/interviews`;
export const POSITIONS = `${API_BASE}/positions`;
