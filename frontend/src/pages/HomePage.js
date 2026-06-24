import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** 课堂演示用示例数据；接入后端时可在 useEffect 中请求接口覆盖 */
const DEFAULT_PLATFORM_STATS = {
  detectedImages: 1286,
  videoHours: 42,
  accuracyPct: 96.3,
};

const divider = (
  <span
    aria-hidden
    style={{
      color: 'rgba(148, 163, 184, 0.35)',
      fontWeight: 300,
      userSelect: 'none',
      margin: '0 0.35rem',
    }}
  >
    |
  </span>
);

function IconChart({ style }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden style={style}>
      <path d="M4 19h16" stroke="url(#ecoStatGrad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 16V10M12 16V7M17 16v-5" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="ecoStatGrad" x1="4" y1="19" x2="20" y2="19">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconImage({ style }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden style={style}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="#38bdf8" strokeWidth="1.6" />
      <circle cx="8.5" cy="10" r="2" stroke="#34d399" strokeWidth="1.5" />
      <path d="M21 15l-4-4-8 8" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClock({ style }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden style={style}>
      <circle cx="12" cy="12" r="8.5" stroke="#38bdf8" strokeWidth="1.6" />
      <path d="M12 8v5l3 2" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconGauge({ style }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden style={style}>
      <circle cx="12" cy="12" r="8.5" stroke="rgba(148,163,184,0.35)" strokeWidth="1.4" />
      <path
        d="M12 14V9m0 0l2.5 2.5"
        stroke="#34d399"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const HomePage = () => {
  const [stats] = useState(DEFAULT_PLATFORM_STATS);
  const [glowPhase, setGlowPhase] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setGlowPhase((p) => (p + 1) % 2), 4200);
    return () => clearInterval(t);
  }, []);

  const iconBase = { flexShrink: 0, display: 'block' };

  const barShadow =
    glowPhase === 0
      ? '0 0 26px rgba(56, 189, 248, 0.16), 0 16px 42px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
      : '0 0 28px rgba(52, 211, 153, 0.14), 0 16px 42px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.07)';

  const barStyle = {
    width: '100%',
    marginTop: '0.25rem',
    padding: 'clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.5rem)',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.78) 0%, rgba(15, 23, 42, 0.85) 100%)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: barShadow,
    transition: 'box-shadow 3.2s ease-in-out',
  };

  const titleRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '0.55rem',
  };

  const titleTextStyle = {
    margin: 0,
    fontSize: 'clamp(0.8rem, 2.1vw, 0.92rem)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    background: 'linear-gradient(90deg, #a7f3d0, #7dd3fc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };

  const metricsRowStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    rowGap: '0.35rem',
    fontSize: 'clamp(0.74rem, 1.95vw, 0.875rem)',
    color: '#e2e8f0',
    lineHeight: 1.5,
    textAlign: 'center',
  };

  const itemStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    whiteSpace: 'nowrap',
  };

  const labelMuted = { color: 'rgba(203, 213, 225, 0.88)' };
  const valueStrong = {
    fontWeight: 600,
    color: '#f8fafc',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div className="page-container eco-page">
      <section className="container eco-hero text-center py-5">
        <h1 className="display-5 fw-bold mb-5 eco-gradient">智能垃圾分类检测系统</h1>

        <div className="row g-4 text-start mb-5">
          <div className="col-lg-4">
            <div className="eco-card h-100 p-4 rounded-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="eco-chip eco-chip-blue">实时</span>
                <h2 className="h5 mb-0 text-white">EcoVision · 实时视频流检测模块</h2>
              </div>
              <p className="text-secondary small mb-4">
                开启摄像头实时监测画面，智能识别场景中的垃圾类别、输出检测框与置信度，实现动态实施垃圾分类。
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link className="btn eco-btn-primary rounded-pill px-4" to="/video-live">
                  打开实时视频
                </Link>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="eco-card h-100 p-4 rounded-4 border-success border-opacity-25">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="eco-chip eco-chip-green">专用模型</span>
                <h2 className="h5 mb-0 text-white">图片上传检测四分类模型</h2>
              </div>
              <p className="text-secondary small mb-4">
                上传本地垃圾图片，模型自动完成目标分类（含可回收、有害、厨余、其他垃圾）识别与精度评估，快速输出检测结果。
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link className="btn btn-success rounded-pill px-4" to="/detect">
                  进入识别工作台
                </Link>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="eco-card h-100 p-4 rounded-4 border-primary border-opacity-25">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="eco-chip eco-chip-blue">演练</span>
                <h2 className="h5 mb-0 text-white">投放场景 · 图片轮播模拟</h2>
              </div>
              <p className="text-secondary small mb-4">
                从本机批量选取固定数量照片进行轮播演练，与工作台相同调用四类 YOLOv5 检测接口；选择四色垃圾桶即可完成投放对错判定；语音需先点「试听语音」或通过「开始轮播」唤起（浏览器权限）。
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link className="btn btn-outline-info rounded-pill px-4" to="/scenario-carousel">
                  进入投放演练
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-center px-1">
          <div
            style={barStyle}
            role="region"
            aria-label="平台数据概览（演示数据）"
          >
            <div style={titleRowStyle}>
              <IconChart style={iconBase} />
              <p style={titleTextStyle}>平台数据概览</p>
            </div>
            <div style={metricsRowStyle}>
              <span style={itemStyle}>
                <IconImage style={iconBase} />
                <span style={labelMuted}>已检测图片</span>
                <span style={valueStrong}>{stats.detectedImages.toLocaleString('zh-CN')}</span>
                <span style={labelMuted}>张</span>
              </span>
              {divider}
              <span style={itemStyle}>
                <IconClock style={iconBase} />
                <span style={labelMuted}>已处理视频时长</span>
                <span style={valueStrong}>{stats.videoHours}</span>
                <span style={labelMuted}>小时</span>
              </span>
              {divider}
              <span style={itemStyle}>
                <IconGauge style={iconBase} />
                <span style={labelMuted}>识别准确率</span>
                <span style={valueStrong}>{stats.accuracyPct}%</span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
