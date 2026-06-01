import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { resolveApiUrl } from '../utils/resolveApiUrl';

const HistoryPage = ({ user }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setFetchError('');
      try {
        const { data } = await api.get('/api/user/history', { params: { page, per_page: 10 } });
        if (!cancel && data.status === 'success') {
          setHistory(data.history || []);
          setTotalPages(data.pages || 1);
        } else if (!cancel && data.message) {
          setFetchError(data.message);
          setHistory([]);
        }
      } catch (err) {
        if (!cancel) {
          const msg =
            err.response?.data?.message ||
            (err.response?.status === 401 ? '请先登录或会话已过期，请重新登录' : '') ||
            '无法连接后端，请确认 Flask 已启动且端口、跨域配置正确';
          setFetchError(msg);
          setHistory([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user, page]);

  return (
    <div className="page-container eco-page history-page">
      <div className="container">
        <h2 className="h4 mb-4 text-white">检测历史</h2>
        {fetchError && (
          <div className="alert alert-warning" role="alert">
            {fetchError}
          </div>
        )}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status" />
          </div>
        ) : history.length === 0 ? (
          !fetchError ? <p className="text-white">暂无记录。</p> : null
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-dark align-middle">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>缩略图</th>
                    <th>检测结果</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.created_at).toLocaleString()}</td>
                      <td>
                        <a
                          className="link-light"
                          href={resolveApiUrl(h.result_url || h.original_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={resolveApiUrl(h.result_url || h.original_url)}
                            alt=""
                            className="thumbnail border"
                          />
                        </a>
                      </td>
                      <td>
                        {h.results?.length ? (
                          <ul className="mb-0 ps-3 small">
                            {h.results.map((r, i) => (
                              <li key={i}>
                                {r.class_name} ({r.confidence?.toFixed(2)})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-white">未检测到物体</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav>
              <ul className="pagination">
                <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" onClick={() => setPage((p) => p - 1)}>
                    上一页
                  </button>
                </li>
                <li className="page-item disabled">
                  <span className="page-link">
                    {page} / {totalPages}
                  </span>
                </li>
                <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" onClick={() => setPage((p) => p + 1)}>
                    下一页
                  </button>
                </li>
              </ul>
            </nav>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
