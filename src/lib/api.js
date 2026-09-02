const TOKEN_KEY = 'reedshelf_jwt_token';
const CURRENT_USER_KEY = 'reedshelf_current_user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  },
};

async function apiRequest(endpoint, options = {}) {
  const token = authStorage.getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, set Content-Type to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear token and cached user
    authStorage.clearToken();
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) || (typeof data === 'string' && data) || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  auth: {
    async register({ name, email, password }) {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      if (res.token) authStorage.setToken(res.token);
      if (res.user) authStorage.setUser(res.user);
      return res;
    },

    async login({ email, password }) {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.token) authStorage.setToken(res.token);
      if (res.user) authStorage.setUser(res.user);
      return res;
    },

    async getMe() {
      const res = await apiRequest('/api/auth/me');
      if (res.user) authStorage.setUser(res.user);
      return res;
    },

    async updateProfile({ name, avatar }) {
      const res = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, avatar }),
      });
      if (res.user) authStorage.setUser(res.user);
      return res.user;
    },

    async changePassword({ currentPassword, newPassword }) {
      return await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    async resetPassword(email, password) {
      return await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },

    logout() {
      authStorage.clearToken();
    },
  },

  books: {
    async list() {
      return await apiRequest('/api/books');
    },

    async get(id) {
      return await apiRequest(`/api/books/${id}`);
    },

    async upload(file, { title, author, totalPages, coverDataUrl } = {}) {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (author) formData.append('author', author);
      if (totalPages) formData.append('totalPages', String(totalPages));
      if (coverDataUrl) formData.append('coverDataUrl', coverDataUrl);

      return await apiRequest('/api/books/upload', {
        method: 'POST',
        body: formData,
      });
    },

    getFileUrl(id) {
      const token = authStorage.getToken();
      return token ? `/api/books/${id}/file?token=${encodeURIComponent(token)}` : `/api/books/${id}/file`;
    },

    async getFileData(id) {
      const url = this.getFileUrl(id);
      const token = authStorage.getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to load book file: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    },

    async update(id, changes) {
      return await apiRequest(`/api/books/${id}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
    },

    async delete(id) {
      return await apiRequest(`/api/books/${id}`, {
        method: 'DELETE',
      });
    },
  },

  progress: {
    async get(bookId) {
      return await apiRequest(`/api/progress/${bookId}`);
    },

    async save(bookId, page) {
      return await apiRequest(`/api/progress/${bookId}`, {
        method: 'PUT',
        body: JSON.stringify({ page }),
      });
    },
  },

  plans: {
    async list() {
      return await apiRequest('/api/plans');
    },

    async create(plan) {
      return await apiRequest('/api/plans', {
        method: 'POST',
        body: JSON.stringify(plan),
      });
    },

    async delete(id) {
      return await apiRequest(`/api/plans/${id}`, {
        method: 'DELETE',
      });
    },
  },

  highlights: {
    async list(bookId) {
      return await apiRequest(`/api/highlights/${bookId}`);
    },

    async create(bookId, { text, page, color }) {
      return await apiRequest(`/api/highlights/${bookId}`, {
        method: 'POST',
        body: JSON.stringify({ text, page, color }),
      });
    },

    async delete(id) {
      return await apiRequest(`/api/highlights/${id}`, {
        method: 'DELETE',
      });
    },
  },

  settings: {
    async get() {
      return await apiRequest('/api/settings');
    },

    async save(settings) {
      return await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
  },

  health: {
    async check() {
      return await apiRequest('/api/health');
    },
  },

  admin: {
    async getOverview() {
      return await apiRequest('/api/admin/overview');
    },

    async getStorage() {
      return await apiRequest('/api/admin/storage');
    },

    async getStorageUsers(params = {}) {
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''));
      const qs = new URLSearchParams(cleanParams).toString();
      return await apiRequest(`/api/admin/storage/users${qs ? `?${qs}` : ''}`);
    },

    async getUsers(params = {}) {
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''));
      const qs = new URLSearchParams(cleanParams).toString();
      return await apiRequest(`/api/admin/users${qs ? `?${qs}` : ''}`);
    },

    async getUser(id) {
      return await apiRequest(`/api/admin/users/${id}`);
    },

    async updateUserStatus(id, { status, reason } = {}) {
      return await apiRequest(`/api/admin/users/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      });
    },

    async updateUserRole(id, { role } = {}) {
      return await apiRequest(`/api/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },

    async deleteUser(id) {
      return await apiRequest(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
    },

    async getBooks(params = {}) {
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''));
      const qs = new URLSearchParams(cleanParams).toString();
      return await apiRequest(`/api/admin/books${qs ? `?${qs}` : ''}`);
    },

    async getReadingActivity() {
      return await apiRequest('/api/admin/reading-activity');
    },

    async getSettings() {
      return await apiRequest('/api/admin/settings');
    },

    async updateSettings(settings) {
      return await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },

    async getAuditLogs(params = {}) {
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''));
      const qs = new URLSearchParams(cleanParams).toString();
      return await apiRequest(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
    },

    async setupFirstAdmin() {
      return await apiRequest('/api/admin/setup-first-admin', {
        method: 'POST',
      });
    },
  },
};
