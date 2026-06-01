import React from 'react';

const AboutPage = () => (
  <div className="page-container eco-page">
    <div className="container eco-narrow">
      <div className="eco-glass rounded-4 p-4 p-md-5 text-start">
        <h1 className="h3 text-white fw-bold mb-4 pb-3 border-bottom border-secondary border-opacity-25">
          项目概述
        </h1>

        <section className="mb-4">
          <h2 className="h5 text-white mb-3">1. 项目背景与目标</h2>
          <p className="text-secondary mb-0 lh-lg">
            本项目为<strong className="text-white">一体化智能垃圾感知平台</strong>
            ，旨在构建一套集<strong className="text-white">实时视频流检测、静态图像识别、多类生活垃圾分类管理</strong>
            于一体的完整系统，用于教学演示与工程实践。平台通过合并两套独立功能模块，实现单一后端与单一前端的统一架构，降低部署复杂度，提升演示便捷性。
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 text-white mb-3">2. 系统架构说明</h2>
          <ul className="text-secondary ps-3 mb-0 list-unstyled">
            <li className="mb-3">
              <strong className="text-white">后端架构</strong>
              <span className="text-secondary">
                ：以 Flask 框架构建，由单一入口文件 <code className="text-info px-1">app.py</code>{' '}
                统一暴露所有服务接口。
              </span>
              <ul className="mt-2 ps-3 mb-0 small">
                <li className="mb-2">
                  <strong className="text-white-50">EcoVision 模块</strong>
                  ：提供 MJPEG 实时视频流推流接口与静态图像检测 JSON 接口，基于 YOLOv8
                  实现垃圾目标的实时识别与分类。
                </li>
                <li className="mb-0">
                  <strong className="text-white-50">YOLOv5 模块</strong>
                  ：提供 RESTful API 接口，支持用户登录、历史记录查询、管理后台操作，实现四类生活垃圾的分类管理。
                </li>
              </ul>
            </li>
            <li>
              <strong className="text-white">前端架构</strong>
              <span className="text-secondary">
                ：采用 React 构建单页应用，统一托管于项目根目录 <code className="text-info px-1">frontend/</code>
                ，开发环境通过代理转发请求至后端服务，生产环境可直接由 Flask 托管构建产物。
              </span>
            </li>
          </ul>
        </section>

        <section className="mb-4">
          <h2 className="h5 text-white mb-3">3. 关键资源与配置</h2>
          <ul className="text-secondary ps-3 mb-0">
            <li className="mb-2 lh-lg">
              <strong className="text-white">模型与权重</strong>
              ：YOLOv5 相关源码与权重位于 <code className="text-warning px-1">garbage_yolov5/</code> 目录，包含{' '}
              <code className="text-warning px-1">yolov5-6.0</code> 版本源码与 <code className="text-warning px-1">garbage.yaml</code>{' '}
              数据集配置文件，支持自定义训练与推理。
            </li>
            <li className="mb-2 lh-lg">
              <strong className="text-white">数据存储</strong>
              ：垃圾分类会话数据默认存储于 SQLite 数据库 <code className="text-warning px-1">instance/garbage_classification.db</code>
              ，默认管理员账号为 <code className="text-warning px-1">admin</code> / <code className="text-warning px-1">admin123</code>。
            </li>
            <li className="mb-0 lh-lg">
              <strong className="text-white">模型训练流程</strong>
              ：进入 <code className="text-warning px-1">garbage_yolov5/yolov5-6.0</code> 目录，配置好 Python
              环境后，执行 YOLOv5 官方训练命令，数据配置文件指向上一级 <code className="text-warning px-1">garbage.yaml</code> 即可启动训练。
            </li>
          </ul>
        </section>

        <section className="mb-0">
          <h2 className="h5 text-white mb-3">4. 技术栈与优势</h2>
          <ul className="text-secondary ps-3 mb-0">
            <li className="mb-2 lh-lg">
              <strong className="text-white">技术栈</strong>：Flask、React、YOLOv5、YOLOv8、SQLite。
            </li>
            <li className="mb-0 lh-lg">
              <strong className="text-white">优势</strong>
              ：架构统一、部署简单、功能完整，同时支持二次开发，兼顾实时性与可扩展性。
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
);

export default AboutPage;
