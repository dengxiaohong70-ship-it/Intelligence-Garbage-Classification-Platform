import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';

const parseMarkdown = (text) => {
  if (!text) return '';
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  return html;
};

const WELCOME =
  '你好，我是 EcoVision 垃圾分类小助手（DeepSeek）。可以问我：某物品属于哪类垃圾、如何正确投放、四类标准区别等。';

export default function AssistantPage() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [llmReady, setLlmReady] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/llm/status')
      .then(({ data }) => setLlmReady(Boolean(data.configured)))
      .catch(() => setLlmReady(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const payload = {
        messages: nextMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content })),
      };
      const { data } = await api.post('/api/llm/chat', payload);
      if (data.status === 'success') {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setError(data.message || '请求失败');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container eco-page assistant-page">
      <div className="container" style={{ maxWidth: 820 }}>
        <h2 className="h4 mb-2 text-white">
          <i className="bi bi-chat-dots me-2" />
          Eco 助手 · DeepSeek
        </h2>
        <p className="text-muted small mb-4">
          轻量级 LLM，专注垃圾分类问答；需后端配置 <code>DEEPSEEK_API_KEY</code>。
        </p>

        {llmReady === false && (
          <div className="alert alert-warning">
            LLM 尚未配置：请在项目根目录创建 <code>.env</code> 并设置 <code>DEEPSEEK_API_KEY</code>，然后重启{' '}
            <code>python app.py</code>。
          </div>
        )}

        <div className="eco-glass-card assistant-chat-panel p-3 mb-3">
          {messages.map((m, idx) => (
            <div
              key={`${idx}-${m.role}`}
              className={`assistant-bubble assistant-bubble--${m.role} mb-3`}
            >
              <div className="assistant-bubble-label">
                {m.role === 'user' ? '我' : 'Eco 助手'}
              </div>
              <div className="assistant-bubble-body" dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }} />
            </div>
          ))}
          {loading && (
            <div className="assistant-bubble assistant-bubble--assistant mb-0">
              <div className="assistant-bubble-label">Eco 助手</div>
              <div className="assistant-bubble-body text-muted">思考中…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <form onSubmit={send} className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="例如：过期药品属于什么垃圾？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || llmReady === false}
            maxLength={500}
          />
          <button
            type="submit"
            className="btn btn-success text-nowrap"
            disabled={loading || !input.trim() || llmReady === false}
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
}
