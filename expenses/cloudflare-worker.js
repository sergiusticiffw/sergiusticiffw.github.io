/**
 * Cloudflare Worker - Proxy for Drupal API
 * Forwards requests from frontend to Pantheon backend.
 * Used when backend DNS hasn't propagated yet (fallback on IP change).
 */

// Drupal backend URL (Pantheon)
const API_BASE = 'https://dev-expenses-api.pantheonsite.io';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight - browser sends OPTIONS before cross-origin requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, JWT-Authorization, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Parse request URL from frontend
    const url = new URL(request.url);

    // Normalize path: remove double slashes (e.g. //node -> /node)
    // Needed if frontend accidentally sends URLs with duplicated path
    let path = url.pathname.replace(/\/+/g, '/');
    if (path === '') path = '/';

    // Build full backend URL (path + query string)
    const backendUrl = `${API_BASE}${path}${url.search}`;

    // Copy request headers, remove those that may cause issues
    const headers = new Headers(request.headers);
    headers.delete('Host');      // Backend expects its own Host
    headers.delete('Origin');    // Request comes from Worker, not frontend
    headers.delete('Referer');  // Don't expose frontend URL

    // Create new request to backend
    const modifiedRequest = new Request(backendUrl, {
      method: request.method,
      headers,
      // Don't send body for GET/HEAD
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    try {
      // Send request to backend
      const response = await fetch(modifiedRequest);

      // Add CORS to response so frontend can read the data
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');

      // Return backend response to frontend
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      // Connection error (e.g. DNS, timeout) - return 502
      return new Response(
        JSON.stringify({ error: 'Proxy request failed', message: error.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  },
};
