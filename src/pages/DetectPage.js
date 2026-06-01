import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { resolveApiUrl } from '../utils/resolveApiUrl';

const DetectPage = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetResult = () => {
    setResultUrl('');
    setResults([]);
    setMessage('');
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
      const { data } = await api.post('/api/detect', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.status === 'success') {
        setResults(data.results || []);
        setMessage(data.message || '');
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

  return (
    <div className="page-container detect-page eco-page">
      <div className="container">
        <h2 className="h4 mb-4 text-white">YOLOv5 · 四类生活垃圾识别</h2>
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
              <h6>原图预览</h6>
              <img src={preview} alt="原图" className="image-preview rounded border" />
            </div>
          )}
          {resultUrl && (
            <div className="col-md-6">
              <h6>标注结果</h6>
              <img src={resolveApiUrl(resultUrl)} alt="结果" className="image-preview rounded border" />
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="table-responsive mt-4">
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
                    <td className="small text-muted">{JSON.stringify(r.bbox)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectPage;
