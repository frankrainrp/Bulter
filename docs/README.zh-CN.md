# Bulter — 本地 AI 学习助手

[English](../README.md) · [下载](https://github.com/frankrainrp/Bulter/releases/tag/v0.1.0)

Bulter 将学习资料和对话整理成任务、日历与笔记。网页助手先提出修改草稿，用户确认后才执行。

## 安装与组成

- **Bulter-Windows-x64.zip**：浏览器客户端、本地 Next.js 服务端和 Node.js 运行时。解压到可写目录，双击 `Start-Bulter.cmd`，打开 `http://127.0.0.1:3000`。不需要全局安装 Node。任务、日历、笔记可以独立使用。
- **Butler-MCP-Server-Windows-x64.zip**：独立 MCP 服务端，包含 14 个工具；需在支持 MCP 的客户端中配置。它使用独立 JSON vault，不会自动同步网页数据库。
- **Bulter-Source.zip**：整理后的核心源码，供评审与开发，不是双击运行的安装包。

AI 需要另装 Ollama，并下载 `config.json` 指定的模型；便携包初始配置为 `qwen3:0.6b`，可以替换成已安装且适合你的模型。模型权重、个人数据库、API Key、私人设备地址均不打包。核心导航与设置可切换中英文，部分面板内容仍为中文。

## 技术实现

前端为 React / TypeScript / Next.js，浏览器使用 Dexie / IndexedDB，本地 API 使用 SQLite。聊天走 OpenAI-compatible 流式接口，可配置两条 Ollama 路由及各自模型。PDF 由 unpdf 提取文字，MiniLM 进行语义筛选；扫描件可选接入 Mistral OCR。

历史路由 ID 带有 DeepSeek 字样，但实际模型以服务端配置为准。源码默认回退模型为 `huihui_ai/qwen3-abliterated:30b`；便携启动器使用 `config.json` 覆盖它。不能把这些路由 ID 当作已经接入 DeepSeek V4 的证据。

MCP 采用 stdio 传输和原子 JSON 文件写入，提供笔记、任务、日历事件和周期工作流工具。MCP 调用直接执行，网页确认卡不会自动约束外部 MCP 客户端。

## 版本边界

`Hackathon` 是同一产品线的课程同步版本，增加 Brightspace、Python/Playwright 同步和课程问答。本轮核心包不包含学校同步工作进程。

这是本机单用户应用。状态 API 没有面向公网的强认证，保持 `127.0.0.1` 监听；支付为演示流程，Tauri 桌面壳和多租户认证不属于已交付能力。

两类图暂不制作：[技术实现图与非技术理解图需求](DIAGRAM_BRIEF.md)。
