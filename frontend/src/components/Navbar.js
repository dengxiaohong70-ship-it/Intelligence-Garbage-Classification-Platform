import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark eco-navbar border-bottom border-secondary border-opacity-25">
      <div className="container">
        <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" to="/">
          <span className="eco-brand-dot" />
          基于YOLO的实时垃圾识别与分类监测平台
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
            <li className="nav-item">
              <Link className="nav-link" to="/">
                <i className="bi bi-grid-1x2 me-1" />
                总览
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/scenario-carousel">
                <i className="bi bi-collection-play me-1" />
                投放演练
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/assistant">
                <i className="bi bi-chat-dots me-1" />
                Eco 助手
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/about">
                <i className="bi bi-info-circle me-1" />
                关于
              </Link>
            </li>
            <li className="nav-item dropdown">
              <a
                href="#!"
                className="nav-link dropdown-toggle"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                onClick={(e) => e.preventDefault()}
              >
                <i className="bi bi-person-circle me-1" />
                {user.username}
              </a>
              <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end border-secondary">
                <li>
                  <Link className="dropdown-item" to="/profile">
                    个人信息
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/history">
                    历史记录
                  </Link>
                </li>
                {user.isAdmin && (
                  <li>
                    <Link className="dropdown-item" to="/admin">
                      管理后台
                    </Link>
                  </li>
                )}
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <button type="button" className="dropdown-item" onClick={handleLogout}>
                    退出登录
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
