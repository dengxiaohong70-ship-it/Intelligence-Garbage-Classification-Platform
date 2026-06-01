import React, { useEffect, useState } from 'react';
import api from '../services/api';

const AdminPage = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [logError, setLogError] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) return;
    (async () => {
      setError('');
      try {
        const [s, u] = await Promise.all([api.get('/api/admin/stats'), api.get('/api/admin/users')]);
        if (s.data.status === 'success') setStats(s.data);
        if (u.data.status === 'success') setUsers(u.data.users || []);
      } catch (e) {
        const msg =
          e.response?.data?.message ||
          (e.response?.status === 401 ? '请先登录或会话已过期，请重新登录' : '') ||
          (e.response?.status === 403 ? '需要管理员权限' : '') ||
          (e.code === 'ERR_NETWORK' ? '网络错误：请确认后端已启动' : '') ||
          '管理数据加载失败';
        setError(msg);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    let cancel = false;
    (async () => {
      setLogError('');
      try {
        const { data } = await api.get('/api/admin/logs', {
          params: { page: logPage, per_page: 15 },
        });
        if (!cancel && data.status === 'success') {
          setLogs(data.logs || []);
          setLogTotalPages(data.pages || 1);
        }
      } catch (e) {
        if (!cancel) {
          setLogError(
            e.response?.data?.message ||
              (e.response?.status === 401 ? '请先登录' : '') ||
              (e.code === 'ERR_NETWORK' ? '无法连接后端' : '日志加载失败')
          );
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user, logPage]);

  if (!user?.isAdmin) return null;

  return (
    <div className="page-container">
      <div className="container-fluid px-4">
        <h2 className="h4 mb-4">管理后台</h2>
        {error && <div className="alert alert-danger">{error}</div>}

        {stats && (
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h6 className="text-muted">用户</h6>
                  <p className="display-6 mb-0">{stats.users?.total}</p>
                  <small className="text-muted">今日新增：{stats.users?.new_today}</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h6 className="text-muted">检测图片</h6>
                  <p className="display-6 mb-0">{stats.images?.total}</p>
                  <small className="text-muted">今日上传：{stats.images?.new_today}</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h6 className="text-muted">类别计数（检测结果条数）</h6>
                  <ul className="mb-0 small">
                    {stats.classes &&
                      Object.entries(stats.classes).map(([k, v]) => (
                        <li key={k}>
                          {k}: {v}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card shadow-sm">
              <div className="card-header">用户列表</div>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>用户名</th>
                      <th>邮箱</th>
                      <th>管理员</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.is_admin ? '是' : '否'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>系统日志</span>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={logPage <= 1}
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={logPage >= logTotalPages}
                    onClick={() => setLogPage((p) => p + 1)}
                  >
                    下一页
                  </button>
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {logError && <div className="alert alert-warning py-2 mb-0 small">{logError}</div>}
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>类型</th>
                      <th>内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((lg) => (
                      <tr key={lg.id}>
                        <td className="small text-nowrap">{lg.created_at?.replace('T', ' ')}</td>
                        <td>{lg.log_type}</td>
                        <td className="small">{lg.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
