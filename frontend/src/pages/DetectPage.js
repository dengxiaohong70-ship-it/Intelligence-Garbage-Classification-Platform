import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { resolveApiUrl } from '../utils/resolveApiUrl';

const AI_CHAT_HINT =
  '点击下方「AI 解读投放建议」获取初次分析，或在下方输入框继续追问，例如：这类垃圾为什么要分开投？';

const buildDetectionSystemPrompt = (results, summary) =>
  `你是 EcoVision 垃圾分类投放顾问。用户刚完成图片检测。
检测摘要：${summary || '无'}
检测明细（JSON）：${JSON.stringify(results)}
请结合以上结果回答后续问题：说明应投入哪类垃圾桶、常见误区与环保提示。回答简洁、口语化，不确定时说明并建议以当地规定为准。请用纯文本自然回复，不要使用星号、Markdown 或列表符号。`;

const DetectPage = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [llmReady, setLlmReady] = useState(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/detect/model')
      .then(({ data }) => {
        if (data.status === 'success') setModelInfo(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get('/api/llm/status')
      .then(({ data }) => setLlmReady(Boolean(data.configured)))
      .catch(() => setLlmReady(false));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  const resetResult = () => {
    setResultUrl('');
    setResults([]);
    setMessage('');
    setAiMessages([]);
    setAiInput('');
    setAiError('');
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    resetResult();
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) {
      setFile(f);
      resetResult();
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('请选择一张图片');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/api/detect', form);
      if (data.status === 'success') {
        setResults(data.results || []);
        setMessage(data.message || '');
        if (data.model) setModelInfo(data.model);
        if (data.result_url) setResultUrl(data.result_url);
      } else {
        setMessage(data.message || '识别失败');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || '识别失败');
    } finally {
      setLoading(false);
    }
  };

  const onExplain = async () => {
    if (llmReady === false) {
      setAiError('LLM 未配置，请在后端 .env 设置 DEEPSEEK_API_KEY');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const { data } = await api.post('/api/llm/explain-detection', {
        results,
        message,
      });
      if (data.status === 'success') {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setAiError(data.message || 'AI 解读失败');
      }
    } catch (err) {
      setAiError(err.response?.data?.message || err.message || 'AI 解读失败');
    } finally {
      setAiLoading(false);
    }
  };

  const onAiSend = async (e) => {
    e.preventDefault();
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    if (llmReady === false) {
      setAiError('LLM 未配置，请在后端 .env 设置 DEEPSEEK_API_KEY');
      return;
    }

    const nextMessages = [...aiMessages, { role: 'user', content: text }];
    setAiMessages(nextMessages);
    setAiInput('');
    setAiError('');
    setAiLoading(true);

    try {
      const payload = {
        system_prompt: buildDetectionSystemPrompt(results, message),
        messages: nextMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content })),
      };
      const { data } = await api.post('/api/llm/chat', payload);
      if (data.status === 'success') {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setAiError(data.message || 'AI 回复失败');
      }
    } catch (err) {
      setAiError(err.response?.data?.message || err.message || 'AI 回复失败');
    } finally {
      setAiLoading(false);
    }
  };

  const onQuickAsk = (question) => {
    setAiInput(question);
  };

  return (
    <div className="page-container detect-page eco-page">
      <div className="container">
        <h2 className="h4 mb-2 text-white">
          {modelInfo?.model_label || '图片垃圾识别'}
        </h2>
        {modelInfo?.classes?.length > 0 && (
          <p className="text-muted small mb-4">
            当前检测类别：{modelInfo.classes.join(' · ')}
          </p>
        )}
        {!modelInfo && <div className="mb-4" />}
        <form onSubmit={onSubmit}>
          <div
            className="upload-area mb-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <i className="bi bi-cloud-arrow-up upload-icon d-block" />
            <input type="file" accept="image/*" className="form-control" onChange={onFileChange} />
            <small className="text-muted mt-2 d-block">或将图片拖到此区域（jpg / png）</small>
          </div>
          <button type="submit" className="btn btn-success" disabled={loading || !file}>
            {loading ? '识别中…' : '开始识别'}
          </button>
        </form>

        {message && (
          <div className={`alert mt-4 ${results.length ? 'alert-success' : 'alert-secondary'}`}>
            {message}
          </div>
        )}

        <div className="row result-section g-4">
          {preview && (
            <div className="col-md-6">
              <h6 className="text-white">原图预览</h6>
              <img src={preview} alt="原图" className="image-preview rounded border" />
            </div>
          )}
          {resultUrl && (
            <div className="col-md-6">
              <h6 className="text-white">标注结果</h6>
              <img src={resolveApiUrl(resultUrl)} alt="结果" className="image-preview rounded border" />
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="table-responsive mt-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <h6 className="mb-0 text-white">检测明细</h6>
              <button
                type="button"
                className="btn btn-outline-info btn-sm"
                onClick={onExplain}
                disabled={aiLoading || llmReady === false}
              >
                {aiLoading && aiMessages.length === 0 ? '解读中…' : 'AI 解读投放建议'}
              </button>
            </div>
            <table className="table table-striped table-results">
              <thead>
                <tr>
                  <th>类别</th>
                  <th>置信度</th>
                  <th>边框 (x1,y1,x2,y2)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.class_name}</td>
                    <td>{r.confidence?.toFixed(3)}</td>
                    <td className="detect-bbox-cell">{JSON.stringify(r.bbox)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="eco-glass-card mt-4 p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h6 className="mb-0 text-white">
                  <i className="bi bi-chat-left-text me-2" />
                  AI 投放建议 · 互动问答
                </h6>
                {llmReady === false && (
                  <span className="badge text-bg-warning">需配置 DEEPSEEK_API_KEY</span>
                )}
              </div>

              {aiMessages.length === 0 && !aiLoading && (
                <p className="text-muted small mb-3">{AI_CHAT_HINT}</p>
              )}

              <div className="detect-ai-chat mb-3">
                {aiMessages.map((m, idx) => (
                  <div
                    key={`${idx}-${m.role}`}
                    className={`assistant-bubble assistant-bubble--${m.role} mb-3`}
                  >
                    <div className="assistant-bubble-label">
                      {m.role === 'user' ? '我' : '投放顾问'}
                    </div>
                    <div className="assistant-bubble-body">{m.content}</div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="assistant-bubble assistant-bubble--assistant mb-0">
                    <div className="assistant-bubble-label">投放顾问</div>
                    <div className="assistant-bubble-body text-muted">思考中…</div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {aiError && <div className="alert alert-danger py-2 small mb-3">{aiError}</div>}

              <div className="d-flex flex-wrap gap-2 mb-3">
                {['为什么要这样分类？', '投错了会怎样？', '有没有更环保的替代？'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => onQuickAsk(q)}
                    disabled={aiLoading || llmReady === false}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form onSubmit={onAiSend} className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="继续追问投放问题，例如：这个置信度偏低该怎么处理？"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  disabled={aiLoading || llmReady === false}
                  maxLength={500}
                />
                <button
                  type="submit"
                  className="btn btn-success text-nowrap"
                  disabled={aiLoading || !aiInput.trim() || llmReady === false}
                >
                  发送
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectPage;
