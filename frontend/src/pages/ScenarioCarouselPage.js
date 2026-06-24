import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { resolveApiUrl } from '../utils/resolveApiUrl';
import {
  BUCKET_IDS,
  BUCKET_META,
  bucketLabel,
  inferDominantBucketYolo5,
} from '../utils/ecoScenarioMap';
import { speakScenario } from '../utils/scenarioSpeech';

const SLIDE_COUNT_OPTIONS = [6, 12, 18];

const SPEEDS = [
  { ms: 2000, label: '快（2 秒/张）' },
  { ms: 3000, label: '中（3 秒/张）' },
  { ms: 5000, label: '慢（5 秒/张）' },
];

function buildSlideItem(file, idPrefix) {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
    file,
    previewUrl: URL.createObjectURL(file),
    caption: file.name,
  };
}

function revokeSlideUrls(slides) {
  slides.forEach((s) => {
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
  });
}

export default function ScenarioCarouselPage() {
  const [phase, setPhase] = useState('setup');
  const [slideCount, setSlideCount] = useState(12);
  const [pickError, setPickError] = useState('');
  const [pickInfo, setPickInfo] = useState('');
  const [pendingSlides, setPendingSlides] = useState([]);
  const [slides, setSlides] = useState([]);
  const slidesRef = useRef([]);
  const pendingRef = useRef([]);
  const fileInputRef = useRef(null);

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const intervalMs = SPEEDS[speedIdx].ms;

  const [selectedBucket, setSelectedBucket] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const voicePrimedRef = useRef(false);
  const expectedBucketRef = useRef(null);
  const selectedBucketRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [annotatedUrl, setAnnotatedUrl] = useState('');
  const [overall, setOverall] = useState('');
  const [inferred, setInferred] = useState(null);

  const [judge, setJudge] = useState('idle');
  const judgeRef = useRef('idle');
  useEffect(() => {
    judgeRef.current = judge;
  }, [judge]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    pendingRef.current = pendingSlides;
  }, [pendingSlides]);

  useEffect(
    () => () => {
      revokeSlideUrls(slidesRef.current);
      revokeSlideUrls(pendingRef.current);
    },
    [],
  );

  useEffect(() => {
    setPendingSlides((prev) => {
      if (prev.length <= slideCount) return prev;
      const kept = prev.slice(0, slideCount);
      prev.slice(slideCount).forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      return kept;
    });
  }, [slideCount]);

  const detectionSeqRef = useRef(0);
  const lastHintKeyRef = useRef('');
  const hintTimerRef = useRef(null);
  const reminderTimerRef = useRef(null);

  const clearHintTimers = useCallback(() => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    if (reminderTimerRef.current != null) {
      window.clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
  }, []);

  const speakBucketFeedback = useCallback(
    (text) => {
      if (!voiceEnabledRef.current) return;
      lastHintKeyRef.current = `${index}-${detectionSeqRef.current}`;
      clearHintTimers();
      // 必须在点击事件内同步调用 speak，否则 Chrome 会拦截语音
      speakScenario(text, { afterCancelMs: 0 });
    },
    [index, clearHintTimers],
  );

  const selectBucket = (id) => {
    voicePrimedRef.current = true;
    const exp = expectedBucketRef.current;
    setSelectedBucket(id);

    if (exp == null) {
      judgeRef.current = 'idle';
    } else {
      judgeRef.current = id === exp ? 'correct' : 'wrong';
    }

    if (!voiceEnabledRef.current) return;
    if (exp == null) {
      speakBucketFeedback('当前暂未识别出明确四类垃圾类别，请选择最接近的垃圾桶。');
      return;
    }
    if (id === exp) {
      speakBucketFeedback('投放正确！请继续保持垃圾分类好习惯。');
    } else {
      speakBucketFeedback(`投放错误！模型判断为${bucketLabel(exp)}，请投入对应垃圾桶。`);
    }
  };

  const slide = slides[index];

  const runDetectionForSlide = useCallback(async () => {
    if (!slide?.file) return;
    const seq = ++detectionSeqRef.current;
    setLoading(true);
    setErrMsg('');
    setAnnotatedUrl('');
    setOverall('');
    setInferred(null);
    setJudge('idle');
    judgeRef.current = 'idle';
    lastHintKeyRef.current = '';
    clearHintTimers();
    try {
      const form = new FormData();
      form.append('file', slide.file);
      const { data } = await api.post('/api/detect', form);
      if (detectionSeqRef.current !== seq) return;
      if (data.status !== 'success') {
        throw new Error(data.message || '检测接口返回失败');
      }
      setOverall(data.message || '');
      const inf = inferDominantBucketYolo5(data.results || []);
      setInferred(inf);
      if (data.result_url) setAnnotatedUrl(resolveApiUrl(data.result_url));
    } catch (e) {
      if (detectionSeqRef.current !== seq) return;
      const msg = e.response?.data?.message || e.message || '检测失败';
      setErrMsg(msg);
    } finally {
      if (detectionSeqRef.current === seq) setLoading(false);
    }
  }, [slide, clearHintTimers]);

  useEffect(() => {
    if (phase !== 'carousel' || !slide) return;
    setSelectedBucket(null);
    runDetectionForSlide();
  }, [index, phase, runDetectionForSlide, slide]);

  useEffect(() => {
    if (phase !== 'carousel' || !isPlaying || slides.length === 0) return undefined;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [phase, isPlaying, intervalMs, slides.length]);

  const expectedBucket = inferred?.bucket ?? null;

  useEffect(() => {
    expectedBucketRef.current = expectedBucket;
  }, [expectedBucket]);

  useEffect(() => {
    selectedBucketRef.current = selectedBucket;
  }, [selectedBucket]);

  useEffect(() => {
    if (selectedBucket == null || expectedBucket == null) {
      setJudge('idle');
      return;
    }
    setJudge(selectedBucket === expectedBucket ? 'correct' : 'wrong');
  }, [selectedBucket, expectedBucket]);

  useEffect(() => {
    if (phase !== 'carousel') return undefined;
    if (!voiceEnabledRef.current || selectedBucket != null) return undefined;
    if (!expectedBucket || loading || errMsg) return undefined;
    if (!voicePrimedRef.current) return undefined;

    const hintKey = `${index}-${detectionSeqRef.current}`;
    if (lastHintKeyRef.current === hintKey) return undefined;

    hintTimerRef.current = window.setTimeout(() => {
      hintTimerRef.current = null;
      if (judgeRef.current !== 'idle') return;
      if (!voicePrimedRef.current || !voiceEnabledRef.current) return;
      if (selectedBucketRef.current != null) return;
      lastHintKeyRef.current = hintKey;
      speakScenario(
        `第 ${index + 1} 张，请根据画面选择垃圾桶，模型建议投入${bucketLabel(expectedBucket)}。`,
        { afterCancelMs: 50 },
      );
    }, 700);

    return () => {
      if (hintTimerRef.current != null) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };
  }, [phase, index, selectedBucket, expectedBucket, loading, errMsg]);

  useEffect(() => {
    if (phase !== 'carousel') return undefined;
    if (!voiceEnabledRef.current || selectedBucket != null) return undefined;
    if (!expectedBucket || loading || errMsg) return undefined;
    if (!voicePrimedRef.current) return undefined;

    const hintKey = `${index}-${detectionSeqRef.current}`;
    reminderTimerRef.current = window.setTimeout(() => {
      reminderTimerRef.current = null;
      if (judgeRef.current !== 'idle') return;
      if (selectedBucketRef.current != null) return;
      if (lastHintKeyRef.current !== hintKey) return;
      speakScenario('您还未选择垃圾桶，请尽快完成投放。', { afterCancelMs: 50 });
    }, 12000);

    return () => {
      if (reminderTimerRef.current != null) {
        window.clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
    };
  }, [phase, index, selectedBucket, expectedBucket, loading, errMsg]);

  const addFiles = (rawFiles) => {
    const images = Array.from(rawFiles || []).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      setPickInfo('');
      setPickError('请选择图片文件（jpg / png 等）');
      return;
    }

    setPendingSlides((prev) => {
      const remaining = slideCount - prev.length;
      if (remaining <= 0) {
        setPickInfo('');
        setPickError(`已选满 ${slideCount} 张，请先删除图片或点击「开始演练」`);
        return prev;
      }

      const toAdd = images.slice(0, remaining);
      const skipped = images.length - toAdd.length;
      const newItems = toAdd.map((file) => buildSlideItem(file, 'pending'));
      const next = [...prev, ...newItems];

      setPickError('');
      if (skipped > 0) {
        setPickInfo(`已添加 ${toAdd.length} 张，还可再添加 ${slideCount - next.length} 张（超出部分已忽略）`);
      } else if (next.length === slideCount) {
        setPickInfo(`已选满 ${slideCount} 张，可以开始演练`);
      } else {
        setPickInfo(`已选 ${next.length} / ${slideCount} 张，可继续添加或再次点击「添加图片」`);
      }

      return next;
    });
  };

  const onAddFilesFromInput = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const onDropFiles = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const removePending = (id) => {
    setPendingSlides((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      const next = prev.filter((s) => s.id !== id);
      setPickError('');
      setPickInfo(next.length === 0 ? '' : `已选 ${next.length} / ${slideCount} 张`);
      return next;
    });
  };

  const clearPending = () => {
    revokeSlideUrls(pendingSlides);
    setPendingSlides([]);
    setPickError('');
    setPickInfo('');
  };

  const onStartCarousel = () => {
    if (pendingSlides.length !== slideCount) {
      setPickInfo('');
      setPickError(`还需 ${slideCount - pendingSlides.length} 张图片（当前 ${pendingSlides.length} / ${slideCount}）`);
      return;
    }

    const next = pendingSlides.map((s, i) => ({
      ...s,
      id: `local-${i}-${s.file.name}`,
    }));
    setPendingSlides([]);
    setPickError('');
    setPickInfo('');
    setSlides(next);
    setIndex(0);
    setPhase('carousel');
    setIsPlaying(false);
    setSelectedBucket(null);
    setJudge('idle');
    voicePrimedRef.current = true;
  };

  const onReselect = () => {
    voicePrimedRef.current = true;
    setIsPlaying(false);
    setPhase('setup');
    setPickError('');
    setPickInfo('');
    setIndex(0);
    setSelectedBucket(null);
    setJudge('idle');
    setErrMsg('');
    revokeSlideUrls(slides);
    setSlides([]);
    clearPending();
  };

  const goPrev = () => {
    voicePrimedRef.current = true;
    setIsPlaying(false);
    lastHintKeyRef.current = '';
    clearHintTimers();
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    voicePrimedRef.current = true;
    setIsPlaying(false);
    lastHintKeyRef.current = '';
    clearHintTimers();
    setIndex((i) => (i + 1) % slides.length);
  };

  const onReset = () => {
    voicePrimedRef.current = true;
    setIsPlaying(false);
    lastHintKeyRef.current = '';
    clearHintTimers();
    setSelectedBucket(null);
    setJudge('idle');
    judgeRef.current = 'idle';
    setIndex(0);
  };

  const confText =
    inferred?.topConf != null ? `${(Number(inferred.topConf) * 100).toFixed(1)}%` : inferred?.bucket ? '（综合推断）' : '—';

  if (phase === 'setup') {
    return (
      <div className="page-container eco-page scenario-carousel-page">
        <div className="container eco-narrow">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
            <div>
              <p className="eco-eyebrow mb-1">YOLOv5 · 场景演练</p>
              <h1 className="h3 mb-0 text-white">图片轮播 · 模拟垃圾投放</h1>
              <p className="text-muted small mb-0 mt-2">
                从本机批量选取固定数量的生活垃圾照片，轮播时自动调用{' '}
                <code className="text-success">POST /api/detect</code>；点选四色垃圾桶后对照模型结果判定对错。
              </p>
            </div>
            <Link className="btn btn-outline-light btn-sm rounded-pill px-3" to="/">
              返回总览
            </Link>
          </div>

          <div className="eco-glass p-3 p-md-4">
            <div className="row g-3 align-items-end mb-3">
              <div className="col-sm-auto">
                <label className="form-label small text-muted mb-1">演练图片数量</label>
                <select
                  className="form-select form-select-sm eco-select-dark"
                  value={slideCount}
                  onChange={(e) => {
                    setSlideCount(Number(e.target.value));
                    setPickError('');
                    setPickInfo('');
                  }}
                >
                  {SLIDE_COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} 张
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-auto d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-success btn-sm rounded-pill px-4"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pendingSlides.length >= slideCount}
                >
                  添加图片
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                  onClick={clearPending}
                  disabled={pendingSlides.length === 0}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="btn btn-info btn-sm rounded-pill px-4"
                  onClick={onStartCarousel}
                  disabled={pendingSlides.length !== slideCount}
                >
                  开始演练（{pendingSlides.length}/{slideCount}）
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="d-none"
              onChange={onAddFilesFromInput}
            />

            <div
              className="scenario-drop-zone upload-area mb-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropFiles}
              onClick={() => pendingSlides.length < slideCount && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (pendingSlides.length < slideCount) fileInputRef.current?.click();
                }
              }}
            >
              <i className="bi bi-images upload-icon d-block" />
              <p className="mb-1 text-white-50 small">
                点击或拖拽图片到此处 · 支持一次选多张（Ctrl / Shift 多选）
              </p>
              <p className="mb-0 text-secondary small">
                可分批添加，选满 <strong className="text-white">{slideCount}</strong> 张后点击「开始演练」
              </p>
            </div>

            {pendingSlides.length > 0 && (
              <div className="scenario-pending-grid d-flex flex-wrap gap-2 mb-3">
                {pendingSlides.map((s, i) => (
                  <div key={s.id} className="scenario-pending-item position-relative">
                    <img src={s.previewUrl} alt={s.caption} className="scenario-pending-img rounded-2" title={s.caption} />
                    <span className="scenario-pending-index">{i + 1}</span>
                    <button
                      type="button"
                      className="scenario-pending-remove btn btn-sm"
                      aria-label={`移除第 ${i + 1} 张`}
                      onClick={() => removePending(s.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pickInfo && !pickError && <div className="alert alert-info py-2 small mb-3">{pickInfo}</div>}
            {pickError && <div className="alert alert-warning py-2 small mb-3">{pickError}</div>}

            <div className="scenario-setup-hint p-3 rounded-4 mb-0">
              <p className="small text-secondary mb-2">
                <strong className="text-white-50">使用说明</strong>
              </p>
              <ul className="small text-secondary mb-0 ps-3">
                <li>每次可添加 1 张或多张图片，直到凑满 <strong className="text-white">{slideCount}</strong> 张</li>
                <li>Windows 文件框多选：按住 <strong className="text-white">Ctrl</strong> 点选多张，或 <strong className="text-white">Shift</strong> 连选</li>
                <li>支持 jpg、png、webp 等；预览区可单独删除某张</li>
                <li>选满后点击「开始演练」进入轮播投放模拟</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container eco-page scenario-carousel-page">
      <div className="container eco-narrow">
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
          <div>
            <p className="eco-eyebrow mb-1">YOLOv5 · 场景演练</p>
            <h1 className="h3 mb-0 text-white">图片轮播 · 模拟垃圾投放</h1>
            <p className="text-muted small mb-0 mt-2">
              当前使用本机选取的 {slides.length} 张图片；每张自动调用{' '}
              <code className="text-success">POST /api/detect</code>。若听不到语音请先点{' '}
              <strong className="text-white-50">试听语音</strong>。
            </p>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={onReselect}>
              重新选图
            </button>
            <Link className="btn btn-outline-light btn-sm rounded-pill px-3" to="/">
              返回总览
            </Link>
          </div>
        </div>

        <div className="eco-glass p-3 p-md-4 mb-4">
          <div className="row g-3 mb-3">
            {BUCKET_IDS.map((id) => {
              const m = BUCKET_META[id];
              const active = selectedBucket === id;
              return (
                <div key={id} className="col-6 col-md-3">
                  <button
                    type="button"
                    className={`btn w-100 py-3 rounded-4 border scenario-bucket-btn ${active ? 'scenario-bucket-active' : ''}`}
                    style={{
                      borderColor: 'rgba(148,163,184,0.35)',
                      background: active ? `${m.color}33` : 'rgba(15,23,42,0.5)',
                      color: '#f8fafc',
                    }}
                    onClick={() => selectBucket(id)}
                  >
                    <span className="d-block fw-bold">{m.label}</span>
                    <small className="text-white-50">{m.hint}</small>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="ratio ratio-4x3 rounded-4 overflow-hidden border border-secondary border-opacity-25 bg-black position-relative mb-3">
            {annotatedUrl ? (
              <img src={annotatedUrl} alt="检测结果" className="w-100 h-100 object-fit-contain" />
            ) : slide?.previewUrl ? (
              <img src={slide.previewUrl} alt={slide.caption} className="w-100 h-100 object-fit-contain opacity-75" />
            ) : (
              <div className="d-flex align-items-center justify-content-center text-secondary small p-3 text-center">
                {loading ? '正在检测当前画面…' : errMsg || '等待加载'}
              </div>
            )}
            {loading && (
              <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center scenario-loading-overlay">
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">加载中</span>
                </div>
              </div>
            )}
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button
              type="button"
              className="btn btn-success btn-sm rounded-pill px-3"
              onClick={() => {
                voicePrimedRef.current = true;
                setIsPlaying(true);
              }}
              disabled={isPlaying}
            >
              开始轮播
            </button>
            <button
              type="button"
              className="btn btn-outline-light btn-sm rounded-pill px-3"
              onClick={() => setIsPlaying(false)}
              disabled={!isPlaying}
            >
              停止
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={onReset}>
              复位（回到首张）
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={goPrev}>
              上一张
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={goNext}>
              下一张
            </button>

            <div className="ms-md-auto d-flex align-items-center gap-2">
              <label className="small text-muted mb-0">轮播速度</label>
              <select
                className="form-select form-select-sm eco-select-dark"
                style={{ width: 'auto' }}
                value={speedIdx}
                onChange={(e) => setSpeedIdx(Number(e.target.value))}
              >
                {SPEEDS.map((s, i) => (
                  <option key={s.ms} value={i}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-light btn-sm rounded-pill px-3"
                onClick={() => {
                  voicePrimedRef.current = true;
                  voiceEnabledRef.current = true;
                  setVoiceEnabled(true);
                  speakScenario('语音试听正常，垃圾分类投放演练已就绪。', { enabled: true });
                }}
              >
                试听语音
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 ${voiceEnabled ? 'btn-info' : 'btn-outline-info'}`}
                onClick={() => setVoiceEnabled((v) => !v)}
              >
                {voiceEnabled ? '语音：开' : '语音：关'}
              </button>
            </div>
          </div>

          <div className="scenario-thumb-strip d-flex flex-wrap gap-2 mb-3">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`scenario-thumb-btn p-0 border rounded-2 overflow-hidden ${i === index ? 'scenario-thumb-active' : ''}`}
                title={s.caption}
                onClick={() => {
                  voicePrimedRef.current = true;
                  setIsPlaying(false);
                  lastHintKeyRef.current = '';
                  clearHintTimers();
                  setIndex(i);
                }}
              >
                <img src={s.previewUrl} alt="" className="scenario-thumb-img" />
              </button>
            ))}
          </div>

          <div className="small text-secondary mb-2">
            当前第 <strong className="text-white">{index + 1}</strong> / {slides.length} 张 · {slide?.caption}
          </div>

          {errMsg && <div className="alert alert-danger py-2 small mb-3">{errMsg}</div>}

          <div className="scenario-panel p-3 rounded-4">
            <div className="row g-2 small">
              <div className="col-md-6">
                <span className="text-muted">模型关注点：</span>{' '}
                <strong className="text-white">{inferred?.topClass || '—'}</strong>
              </div>
              <div className="col-md-6">
                <span className="text-muted">推断投放桶：</span>{' '}
                <strong className="text-white">{expectedBucket ? bucketLabel(expectedBucket) : '暂无'}</strong>
              </div>
              <div className="col-md-6">
                <span className="text-muted">置信度：</span>{' '}
                <strong className="text-white">{confText}</strong>
              </div>
              <div className="col-md-6">
                <span className="text-muted">识别摘要：</span>{' '}
                <strong className="text-white">{overall || '—'}</strong>
              </div>
            </div>

            <hr className="border-secondary opacity-25 my-3" />

            <div
              className={`scenario-judge fw-semibold ${
                judge === 'correct' ? 'text-success' : judge === 'wrong' ? 'text-danger' : 'text-secondary'
              }`}
            >
              {selectedBucket == null && <span>投放判定：未选择垃圾桶（未投放）</span>}
              {selectedBucket != null && expectedBucket == null && (
                <span>投放判定：当前画面难以可靠分类，选择仅供参考</span>
              )}
              {selectedBucket != null && expectedBucket != null && judge === 'correct' && (
                <span>投放判定：正确（已选 {bucketLabel(selectedBucket)}）</span>
              )}
              {selectedBucket != null && expectedBucket != null && judge === 'wrong' && (
                <span>
                  投放判定：错误（已选 {bucketLabel(selectedBucket)}，建议 {bucketLabel(expectedBucket)}）
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="small text-secondary mb-2">
          语音提示：每张图检测完成后约 1 秒会自动播报建议桶；点选垃圾桶后会播报对错。请先点「试听语音」解锁浏览器朗读。
        </p>
        <p className="small text-secondary">
          图片来源于本机选取，不会上传到服务端固定目录；检测时仅将当前画面提交至 <code>/api/detect</code>。
        </p>
      </div>
    </div>
  );
}
