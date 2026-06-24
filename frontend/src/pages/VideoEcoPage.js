import React from 'react';
import { Link } from 'react-router-dom';

const VideoEcoPage = () => (
  <div className="page-container eco-page">
    <div className="container eco-narrow">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <p className="eco-eyebrow mb-1">EcoVision · 实时视频流检测模块</p>
          <h1 className="h3 mb-0 text-white">实时视频垃圾检测</h1>
          <p className="text-muted small mb-0 mt-2">
            使用本机摄像头与 MJPEG 推流，在画面上叠加湿垃圾 / 干垃圾 / 有害物等分类框。
          </p>
        </div>
        <Link className="btn btn-outline-light btn-sm rounded-pill px-3" to="/">
          返回总览
        </Link>
      </div>

      <div className="eco-glass p-3 p-md-4 mb-4">
        <div className="ratio ratio-4x3 rounded-4 overflow-hidden position-relative border border-secondary border-opacity-25 bg-black">
          <span className="eco-live-pill">
            <span className="eco-live-dot" /> LIVE
          </span>
          <img className="w-100 h-100 object-fit-contain" src="/video_feed" alt="实时检测画面" />
        </div>
        <div className="d-flex flex-wrap justify-content-center gap-3 mt-3 small text-muted">
          <span>
            <span className="eco-dot eco-dot-wet" /> 湿垃圾（有机）
          </span>
          <span>
            <span className="eco-dot eco-dot-dry" /> 干垃圾（可回收等）
          </span>
          <span>
            <span className="eco-dot eco-dot-haz" /> 有害垃圾
          </span>
        </div>
      </div>

      <p className="small text-secondary">
        提示：首次打开可能需要授予浏览器摄像头权限；若画面卡住，请确认未在其他程序中独占摄像头。
      </p>
    </div>
  </div>
);

export default VideoEcoPage;
