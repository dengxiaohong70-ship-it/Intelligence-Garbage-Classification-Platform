import axios from 'axios';

// 打包部署且前端与后端不同源时设置：REACT_APP_API_URL=http://127.0.0.1:5000 （与 Flask 监听地址一致）
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, ''),
  withCredentials: true,
});

export default api;
