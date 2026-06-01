import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, normalizeUser } from '../services/authService';

const LoginPage = ({ setUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.status === 'success' && data.user) {
        setUser(normalizeUser(data.user));
        navigate('/');
      } else {
        setError(data.message || '登录失败');
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.code === 'ERR_NETWORK'
          ? '网络错误：请在后端目录运行 python app.py（端口 5000），并在 frontend 目录执行 npm start，勿在项目根目录直接 npm'
          : '') ||
        err.message ||
        '登录失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container eco-page d-flex align-items-center justify-content-center py-5 min-vh-100">
      <div className="container" style={{ maxWidth: '420px' }}>
        <div className="card shadow-sm">
          <div className="card-body p-4">
            <p className="text-muted small text-center mb-2">一体化智能垃圾感知平台</p>
            <h2 className="h4 mb-4 text-center text-dark">登录</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label text-dark">用户名</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-dark">密码</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-success w-100" disabled={loading}>
                {loading ? '登录中…' : '登录'}
              </button>
            </form>
            <p className="mt-3 mb-0 text-center text-muted">
              没有账号？
              <Link to="/register" className="ms-1">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
