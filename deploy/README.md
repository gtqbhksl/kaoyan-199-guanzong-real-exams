# Docker 部署指南

本目录配合仓库根目录的 `Dockerfile` / `docker-compose.yml` / `.dockerignore`,
用于把 199 复习台部署成容器。

镜像里只有**静态站点 + nginx**,不含题库 Markdown、RAG 切分库与 PDF,
最终体积约 50 MB 量级;运行时不需要 Node.js、OCR、数据库或任何 Python 依赖。

## 目录内容

| 文件 | 用途 |
| --- | --- |
| `nginx.conf` | 静态站点托管配置:gzip、缓存头、404 处理 |
| `check_deploy_config.py` | 静态校验 compose / nginx / Dockerfile |
| `check_nginx_rules.py` | 校验 nginx 路径匹配与缓存头策略 |
| `check_docker_context.py` | 核算 `.dockerignore` 后的构建上下文 |
| `materialize_context.py` | 按忽略规则复制出构建上下文,离线验证用 |

## 快速开始

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

浏览器打开 http://localhost:8080/ 。

宿主机端口用环境变量改:

```bash
HOST_PORT=9000 docker compose up -d --build
```

不用 compose 也可以:

```bash
docker build -t kaoyan199-study-guide .
docker run -d --name kaoyan199 -p 8080:80 --restart unless-stopped \
  --memory 256m kaoyan199-study-guide
```

## 镜像是怎么构建的

两阶段构建,最终镜像里只有 nginx 和静态产物:

```
builder: python:3.11-slim
  ├─ pip install Pillow
  ├─ COPY 复习台源码 + 已生成的数据
  ├─ COPY 199管综真题_Markdown题库/{year}年/images/*.png   (1073 张原卷切片)
  └─ python study-guide/build_site.py
       └─ PNG → WebP 转码(质量 72,宽上限 1600px)+ 组装静态站点
              产出 study-guide/web/  (约 35 MiB,1032 个文件)

runtime: nginx:1.27-alpine
  ├─ COPY deploy/nginx.conf → /etc/nginx/conf.d/default.conf
  ├─ COPY --from=builder /build/study-guide/web/ → /usr/share/nginx/html/
  └─ CMD nginx -g "daemon off;"
```

要点:

- **构建上下文约 293 MiB**,几乎全是原卷切片图。`.git`、题库 md、
  RAG 切分库、文档与 OCR 缓存都已在 `.dockerignore` 中排除。
- **分层缓存**:复习台源码与题库数据在切片图之前 COPY,
  只改页面或脚本时不必重转 1073 张图,只重建最后一层。
- **产物按年分目录**:`scans/{year}/{year}_qNN.webp`,文件名带年份题号,
  内容稳定,因此配了 `immutable` 长缓存。

## nginx 配置要点

| 资源类型 | 缓存策略 | 原因 |
| --- | --- | --- |
| `/scans/**.webp` | `max-age=31536000, immutable` | 切片图内容不变,可长期缓存 |
| `/data/**.js` | `no-cache` | 题库数据随题库更新,不能长缓存 |
| `.html` / `.css` / `.js` | `no-cache` | 页面与样式取最新,避免发版后拿到旧壳 |
| `.ico` / `.png` 等小资源 | `max-age=604800` | 一周 |

站点是**单页 hash 路由**(`#practice` / `#mistakes` / `#skills`),
浏览器请求的路径始终是 `/` 或静态资源路径,因此 `location /` 用
`try_files $uri $uri/ =404;` 而**不做** SPA 回退——缺失的资源直接 404,
不会被 200 的 HTML 掩盖,排障时能一眼看出是哪个文件丢了。

## 更新部署

题库或页面有改动后:

```bash
git pull
docker compose up -d --build
```

只有 `study-guide/data/questions.js` 变了、切片图没变时,
可以只重建最后一层;要强制全部重转,加 `--no-cache`:

```bash
docker compose build --no-cache
docker compose up -d
```

## 排错

**容器起不来 / 反复重启**

```bash
docker compose ps                  # 看状态,是否 unhealthy
docker compose logs --tail=50       # 看 nginx 报错
```

镜像里带 healthcheck:每 30 秒探一次 `/`,连续 3 次失败会标记为 unhealthy。
`docker inspect` 可看具体状态。

**页面能开但切片图裂开**

切片图路径是 `scans/{year}/{year}_qNN.webp`。在容器里确认文件在不在:

```bash
docker compose exec study-guide ls /usr/share/nginx/html/scans/2026 | head
```

如果目录为空,说明 builder 阶段没转出图,通常是构建时切片图没进上下文——
用 `python deploy/check_docker_context.py` 核对。

**公式显示成 LaTeX 原文**

数学公式走 CDN 加载 MathJax,首次访问需要外网。内网环境要么给容器配代理,
要么接受显示原文;这不影响答题与错题本功能。

**端口被占用**

换宿主机端口即可,容器内固定 80:

```bash
HOST_PORT=9000 docker compose up -d --build
```

**构建很慢或磁盘吃紧**

构建要转 1073 张图,耗时长主要在这步。`docker system df` 查看占用,
`docker builder prune` 清理构建缓存。

## 无 Docker 时的本地等价物

如果只是本机使用,不必构建镜像,直接跑仓库自带的静态服务:

```bash
python study-guide/serve.py 8765
# 打开 http://127.0.0.1:8765/study-guide/index.html
```

这个服务以仓库根为站点根,直接读取 Markdown 题库里的原图(PNG),
不经过 WebP 转码。两者内容一致,差别只在图片格式与访问方式。

## 离线校验

本机没有 Docker 时,可以用 `deploy/` 下的脚本做静态检查:

```bash
python deploy/check_deploy_config.py     # compose / nginx / Dockerfile 静态校验
python deploy/check_nginx_rules.py        # nginx 路径与缓存规则自检
python deploy/check_docker_context.py     # 核算构建上下文与必需文件
python deploy/materialize_context.py /tmp/ctx   # 复现构建上下文
```

最后一条会按 `.dockerignore` 的规则把文件复制到指定目录,
用来核对构建上下文里到底装了什么、哪些必需文件有没有被误排除。
