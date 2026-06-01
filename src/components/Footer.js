import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="footer mt-auto py-5 text-white-50">
      <div className="container">
        <div className="row g-4 g-lg-5 align-items-start">
          <div className="col-12 col-lg-7">
            <div className="footer-about">
              <h5 className="text-white fw-semibold mb-3 lh-sm">
                基于YOLO的实时垃圾识别与分类监测平台
              </h5>
              <p className="small mb-0 lh-lg footer-about-lead">
                平台采用 Flask+React 前后端分离架构，集成 YOLOv8 实时视频流检测与 YOLOv5
                静态图像识别双链路，实现从目标检测、分类判定到数据管理的全流程闭环，提供完整、高效的智能垃圾分类解决方案。
              </p>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <nav className="footer-nav" aria-label="页脚导航">
              <h6 className="text-white text-uppercase small mb-3 footer-nav-heading">导航</h6>
              <ul className="list-unstyled small mb-0 d-flex flex-column gap-2">
                <li>
                  <Link className="footer-nav-link" to="/video-live">
                    实时视频
                  </Link>
                </li>
                <li>
                  <Link className="footer-nav-link" to="/detect">
                    YOLOv5 识别
                  </Link>
                </li>
                <li>
                  <Link className="footer-nav-link" to="/about">
                    关于项目
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <hr className="border-secondary opacity-25 my-4" />
        <p className="small text-center mb-0">
          © {currentYear} EcoVision AI ·
        </p>
      </div>
    </footer>
  );
};

export default Footer;
