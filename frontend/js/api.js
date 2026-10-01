/**
 * Centralized API Client for Backend REST Endpoints
 */

const API = {
  // Use relative '/api' so it works identically on localhost:5000, 127.0.0.1, or network host
  baseURL: '/api',

  /**
   * Internal request dispatcher
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('sra_token');

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 Unauthorized globally
      if (response.status === 401) {
        if (!window.location.pathname.endsWith('login.html')) {
          localStorage.removeItem('sra_token');
          localStorage.removeItem('sra_user');
          window.location.href = 'login.html';
        }
      }

      // Check if response is CSV or blob
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/csv')) {
        return await response.text();
      }

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
      throw err;
    }
  },

  /**
   * GET request with optional query object
   */
  get(endpoint, params = {}) {
    let queryString = '';
    const cleanParams = {};

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = value;
      }
    }

    if (Object.keys(cleanParams).length > 0) {
      queryString = '?' + new URLSearchParams(cleanParams).toString();
    }

    return this.request(`${endpoint}${queryString}`, { method: 'GET' });
  },

  /**
   * POST request
   */
  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  /**
   * PUT request
   */
  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  /**
   * DELETE request
   */
  delete(endpoint, params = {}) {
    let queryString = '';
    if (Object.keys(params).length > 0) {
      queryString = '?' + new URLSearchParams(params).toString();
    }
    return this.request(`${endpoint}${queryString}`, { method: 'DELETE' });
  }
};

window.API = API;
