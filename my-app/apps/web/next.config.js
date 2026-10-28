/** @type {import('next').NextConfig} */
const path = require("path");

const isProd = process.env.NODE_ENV === "production";

// SECURITY：内容安全策略。app 重度用内联 style（无 rehype-raw / 无 dangerouslySetInnerHTML，
// XSS 面已低），故 style/script 放行 'unsafe-inline'；dev 额外需 'unsafe-eval' + ws: 给 HMR。
// 生产想进一步收紧 script-src 可后续改 nonce 方案（见 Doc/SECURITY.md）。
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",        // 壁纸/上传图/管家素材(blob/data) + 外部面板图
  "font-src 'self' data:",
  "connect-src 'self' https: ws: wss:",        // /api 同源 + 外部 API 经服务端代理；ws 给 HMR
  "media-src 'self' blob: data: https:",       // 视频壁纸
  "frame-src 'self' blob: https:",             // iframe 面板(外部 https) + PDF 预览(blob)
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",                    // 防点击劫持：Butler 不可被任何站点内嵌
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS 仅生产（HTTPS）下发；dev 的 http 浏览器会忽略
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["openai", "better-sqlite3"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
