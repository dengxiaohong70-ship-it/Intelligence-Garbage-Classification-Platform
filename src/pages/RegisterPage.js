import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/authService';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/login');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.code === 'ERR_NETWORK'
          ? '网络错误：请在 frontend 目录运行 npm start，并确保 Flask 已在 5000 端口启动（python app.py）'
          : '') ||
        err.message ||
        '注册失败';
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
            <p className="text-dark small text-center mb-2">一体化智能垃圾感知平台</p>
            <h2 className="h4 mb-4 text-center text-dark">注册账号</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label text-dark">用户名</label>
                <input
                  type="text"
                  className="form-control text-dark"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-dark">邮箱</label>
                <input
                  type="email"
                  className="form-control text-dark"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-dark">密码</label>
                <input
                  type="password"
                  className="form-control text-dark"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn btn-success w-100" disabled={loading}>
                {loading ? '提交中…' : '注册'}
              </button>
            </form>
            <p className="mt-3 mb-0 text-center text-muted">
              已有账号？
              <Link to="/login" className="ms-1">
                去登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
