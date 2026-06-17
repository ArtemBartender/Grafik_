export function getToken() {
  return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
}

export function removeToken() {
  localStorage.removeItem('access_token');
  sessionStorage.removeItem('access_token');
}

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('access_token');
    // If we're not on the login/landing screen, redirect
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    throw new Error('Sesja wygasła. Zaloguj się ponownie.');
  }

  const contentType = response.headers.get('content-type') || '';
  let body;
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Błąd ${response.status}`);
  }

  return body;
}

export function currentClaims() {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  if (!token) return null;
  try {
    const payloadStr = atob(token);
    return JSON.parse(payloadStr);
  } catch (e) {
    return null;
  }
}
