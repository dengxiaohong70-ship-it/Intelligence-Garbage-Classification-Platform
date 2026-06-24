import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { normalizeUser } from '../services/authService';

const ProfilePage = ({ user, setUser }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get('/api/user/profile');
        if (!cancel && data.status === 'success' && data.user) {
          setUser(normalizeUser(data.user));
        }
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [setUser]);

  const submitPassword = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await api.post('/api/user/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setMsg('密码已更新');
      setOldPassword('');
      setNewPassword('');
    } catch (ex) {
      setErr(ex.response?.data?.message || '修改失败');
    }
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <div className="container" style={{ maxWidth: '560px' }}>
        <h2 className="h4 mb-4">个人信息</h2>
        <div className="card mb-4 shadow-sm">
          <div className="card-body text-dark">
            <p>
              <strong>用户名：</strong>
              {user.username}
            </p>
            <p>
              <strong>邮箱：</strong>
              {user.email}
            </p>
            <p className="mb-0">
              <strong>角色：</strong>
              {user.isAdmin ? '管理员' : '普通用户'}
            </p>
          </div>
        </div>
        <h3 className="h6">修改密码</h3>
        {msg && <div className="alert alert-success py-2">{msg}</div>}
        {err && <div className="alert alert-danger py-2">{err}</div>}
        <form onSubmit={submitPassword} className="card card-body shadow-sm text-dark">
          <div className="mb-3">
            <label className="form-label text-dark">当前密码</label>
            <input
              type="password"
              className="form-control text-dark"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-dark">新密码</label>
            <input
              type="password"
              className="form-control text-dark"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn btn-success">
            保存
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
