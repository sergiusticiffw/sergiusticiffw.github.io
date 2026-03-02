/**
 * Cloudflare Worker - Proxy pentru API-ul Drupal
 * Redirecționează request-urile de la frontend către backend-ul Pantheon.
 * Folosit când DNS-ul pentru backend nu s-a propagat încă (fallback la schimbare IP).
 */

// URL-ul backend-ului Drupal (Pantheon)
const API_BASE = 'https://dev-expenses-api.pantheonsite.io';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight - browserul trimite OPTIONS înainte de request-uri cross-origin
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

    // Parse URL-ul request-ului primit de la frontend
    const url = new URL(request.url);

    // Normalizează path-ul: elimina slash-uri duble (ex: //node -> /node)
    // Necesar dacă frontend-ul trimite accidental URL-uri cu path duplicat
    let path = url.pathname.replace(/\/+/g, '/');
    if (path === '') path = '/';

    // Construiește URL-ul complet către backend (path + query string)
    const backendUrl = `${API_BASE}${path}${url.search}`;

    // Copiază header-ele din request, dar elimină cele care pot cauza probleme
    const headers = new Headers(request.headers);
    headers.delete('Host');      // Backend-ul așteaptă propriul Host
    headers.delete('Origin');    // Request-ul vine de la Worker, nu de la frontend
    headers.delete('Referer');  // Nu expune URL-ul frontend-ului

    // Creează request-ul nou către backend
    const modifiedRequest = new Request(backendUrl, {
      method: request.method,
      headers,
      // Pentru GET/HEAD nu trimitem body-ul
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    try {
      // Trimite request-ul către backend
      const response = await fetch(modifiedRequest);

      // Adaugă CORS la răspuns ca frontend-ul să poată citi datele
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');

      // Returnează răspunsul backend-ului către frontend
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      // Eroare la conectare (ex: DNS, timeout) - returnează 502
      return new Response(
        JSON.stringify({ error: 'Proxy request failed', message: error.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  },
};
