/**
 * RTK Query API Slice - Unified API layer with PData authentication
 * 
 * This replaces all legacy API code and provides a clean, unified interface
 * for all server communication with proper PData token-based authentication.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query';

// Base query configuration with PData token authentication
const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include', // Always include session cookies
  timeout: 10000, // 10 second timeout to prevent hanging
});

// Enhanced base query with error handling and token refresh
const baseQueryWithReauth = async (args, api, extraOptions) => {
  // Check if user is authenticated for protected endpoints
  const state = api.getState();
  const isAuthenticated = state.auth?.isAuthenticated;
  const authChecked = state.auth?.authChecked;
  
  // Skip auth check for login and public endpoints
  const isAuthEndpoint = typeof args === 'string' ? 
    args.includes('/auth/') : 
    args.url?.includes('/auth/');
  
  // If auth has been checked and user is not authenticated, and this isn't an auth endpoint
  if (authChecked && !isAuthenticated && !isAuthEndpoint) {
    console.log('[API] Skipping API call - user not authenticated:', args);
    return {
      error: {
        status: 401,
        data: { message: 'User not authenticated' }
      }
    };
  }
  
  let result = await baseQuery(args, api, extraOptions);
  
  // If we get a 401, the user needs to re-authenticate
  if (result.error && result.error.status === 401) {
    console.log('[API] 401 Unauthorized - clearing auth state');
    // Clear the auth state to force re-login
    api.dispatch({ type: 'auth/clearAuth' });
  }
  
  return result;
};

// Create the API slice
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth', 
    'User', 
    'Directory', 
    'File', 
    'Config',
    'Capabilities'
  ],
  endpoints: (builder) => ({
    
    // ===== AUTHENTICATION ENDPOINTS =====
    
    /**
     * Login with username/password and get PData token
     */
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth', 'User'],
      transformResponse: (response) => {
        // The server should return both user info and a PData token
        return response;
      },
    }),
    
    /**
     * Generate a PData API token for the current session
     */
    generateToken: builder.mutation({
      query: ({ expiryHours = 24, description = 'API Access Token' } = {}) => ({
        url: '/auth/token/generate',
        method: 'POST',
        body: { expiryHours, description },
      }),
      invalidatesTags: ['Auth'],
    }),
    
    /**
     * Get current user authentication status
     */
    getCurrentUser: builder.query({
      query: () => '/auth/user',
      providesTags: ['Auth', 'User'],
      transformResponse: (response) => {
        return response;
      },
    }),
    
    /**
     * Logout and invalidate session/token
     */
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth', 'User', 'Directory', 'File'],
    }),
    
    // ===== FILE SYSTEM ENDPOINTS =====
    
    /**
     * Get top-level directories for the authenticated user
     */
    getTopLevelDirectories: builder.query({
      query: () => '/files/dirs',
      providesTags: ['Directory'],
      transformErrorResponse: (response) => {
        console.error('[API] Failed to load top-level directories:', response);
        return response;
      },
    }),
    
    /**
     * Get directory listing
     */
    getDirectoryListing: builder.query({
      query: (pathname = '/') => ({
        url: '/files/list',
        params: { pathname },
      }),
      providesTags: (result, error, pathname) => [
        { type: 'Directory', id: pathname },
        'Directory'
      ],
    }),
    
    /**
     * Get file content
     */
    getFileContent: builder.query({
      query: (pathname) => ({
        url: '/files/content',
        params: { pathname },
      }),
      providesTags: (result, error, pathname) => [
        { type: 'File', id: pathname },
        'File'
      ],
    }),
    
    /**
     * Save file content
     */
    saveFile: builder.mutation({
      query: ({ pathname, content }) => ({
        url: '/files/save',
        method: 'POST',
        body: { pathname, content },
      }),
      invalidatesTags: (result, error, { pathname }) => [
        { type: 'File', id: pathname },
        { type: 'Directory', id: pathname.split('/').slice(0, -1).join('/') || '/' },
      ],
    }),
    
    /**
     * Delete file
     */
    deleteFile: builder.mutation({
      query: (pathname) => ({
        url: '/files/delete',
        method: 'DELETE',
        params: { pathname },
      }),
      invalidatesTags: (result, error, pathname) => [
        { type: 'File', id: pathname },
        { type: 'Directory', id: pathname.split('/').slice(0, -1).join('/') || '/' },
      ],
    }),
    
    // ===== CONFIGURATION ENDPOINTS =====
    
    /**
     * Get directory configuration
     */
    getDirectoryConfig: builder.query({
      query: (directory) => ({
        url: '/config',
        params: { directory },
      }),
      providesTags: (result, error, directory) => [
        { type: 'Config', id: directory },
        'Config'
      ],
    }),
    
    // ===== USER MANAGEMENT ENDPOINTS =====
    
    /**
     * Get user information
     */
    getUserInfo: builder.query({
      query: (username) => `/users/${username}`,
      providesTags: (result, error, username) => [
        { type: 'User', id: username },
        'User'
      ],
    }),
    
    /**
     * Get system status
     */
    getSystemStatus: builder.query({
      query: () => '/auth/system',
      providesTags: ['Auth'],
    }),
    
  }),
});

// Export hooks for use in components
export const {
  // Auth hooks
  useLoginMutation,
  useGenerateTokenMutation,
  useGetCurrentUserQuery,
  useLogoutMutation,
  
  // File system hooks
  useGetTopLevelDirectoriesQuery,
  useGetDirectoryListingQuery,
  useGetFileContentQuery,
  useSaveFileMutation,
  useDeleteFileMutation,
  
  // Config hooks
  useGetDirectoryConfigQuery,
  
  // User hooks
  useGetUserInfoQuery,
  useGetSystemStatusQuery,
  
} = apiSlice;

// Export the reducer
export default apiSlice.reducer;

console.log('[API Slice] RTK Query API slice initialized with PData authentication');
