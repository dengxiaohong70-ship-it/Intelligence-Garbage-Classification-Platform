import api from './api';

export function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    isAdmin: Boolean(raw.is_admin),
  };
}

export async function register(username, email, password) {
  const { data } = await api.post('/api/register', {
    username,
    email,
    password,
  });
  return data;
}

export async function login(username, password) {
  const { data } = await api.post('/api/login', { username, password });
  return data;
}

export async function logout() {
  try {
    await api.post('/api/logout');
  } catch {
    // 即便未登录或会话过期也视为已登出
  }
}

export async function getCurrentUser() {
  try {
    const { data } = await api.get('/api/user');
    if (data.status === 'success' && data.user) {
      return normalizeUser(data.user);
    }
    return null;
  } catch {
    return null;
  }
}
