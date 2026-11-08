# syntax=docker/dockerfile:1
#
# 考研管综 199 真题题库与复习台 —— 容器化部署
#
# 两阶段构建:
#   builder  用 Pillow 把原卷 PNG 切片转码成 WebP,产出可发布的静态站点
#   runtime 用 nginx 托管该静态站点,单进程、纯静态、支持 gzip 与缓存头
#
# 构建:
#   docker build -t kaoyan199-study-guide .
# 运行:
#   docker run -d --name kaoyan199 -p 8080:80 kaoyan199-study-guide
# 打开:
#   http://localhost:8080/
#
# 说明:
#   * 站点是纯静态的,无需 Node.js、OCR 或数据库;所有作答记录存在浏览器
#     localStorage,容器重启不影响,换浏览器/域名也不共享。
#   * 数学公式走 CDN 加载 MathJax,首次访问需要外网;离线环境会显示 LaTeX 原文。
#   * 镜像只包含已构建的静态产物与 nginx,不包含题库 md / RAG 切分库 / PDF。

# ---------- builder: 生成静态站点产物 ----------
FROM python:3.11-slim AS builder

# Pillow 的 WebP 编码需要;其余工具在 builder 阶段用不到
RUN pip install --no-cache-dir "Pillow==11.3.0"

WORKDIR /build

# 先只拷贝构建所需文件,便于 Docker 层缓存:改页面/脚本时不必重转 1073 张图
COPY study-guide/build_site.py ./study-guide/build_site.py
COPY study-guide/app.js ./study-guide/app.js
COPY study-guide/index.html ./study-guide/index.html
COPY study-guide/styles.css ./study-guide/styles.css
COPY study-guide/data/questions.js ./study-guide/data/questions.js
COPY study-guide/data/knowledge-base.js ./study-guide/data/knowledge-base.js

# 原卷切片图:build_site.py 按年份目录读取 {year}年/images/*.png
COPY "199管综真题_Markdown题库/" "199管综真题_Markdown题库/"

# 产出 study-guide/web/;--skip-images 不需要,这里必须带图
RUN python study-guide/build_site.py

# ---------- runtime: nginx 托管静态站点 ----------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="199 管综真题复习台" \
      org.opencontainers.image.description="考研管综 199 真题备考工具箱:题库 + 浏览器复习台" \
      org.opencontainers.image.source="https://github.com/gtqbhksl/kaoyan-199-guanzong-real-exams"

# 替换默认站点配置:根路径直出复习台首页,静态资源加压缩与缓存头
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /build/study-guide/web/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
