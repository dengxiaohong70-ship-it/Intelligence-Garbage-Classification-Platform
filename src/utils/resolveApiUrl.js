/**
 * 将后端返回的相对路径（如 /api/images/1/result）转为完整 URL。
 * 未设置 REACT_APP_API_URL 时（开发代理模式）保持相对路径。
 */
export function resolveApiUrl(path) {
  if (path == null || path === '') {
    return path;
  }
  if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path;
  }
  const base = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
  if (!base) {
    return path;
  }
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}
