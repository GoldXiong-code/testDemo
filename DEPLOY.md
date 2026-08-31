# Atoms-Demo 阿里云部署指南

> 本指南帮你把 Atoms-Demo 部署到阿里云轻量应用服务器，通过 IP 或域名访问。
> 当前线上服务器 IP：**120.79.143.65**（访问地址 http://120.79.143.65）

---

## 一、部署架构

```
用户浏览器
    │  HTTP :80
    ▼
Nginx（反向代理，80 端口）
    │  proxy_pass
    ▼
Next.js 应用（PM2 托管，:3000 端口）
    │
    ├── 文本/代码生成 → DeepSeek API（deepseek-v4-pro）
    ├── 图片生成 → 阿里云通义万相（DashScope）
    └── 商品实物图搜索 → Pexels 免费图库
```

---

## 二、服务器环境要求

- 系统：Alibaba Cloud Linux / CentOS
- Node.js 20+
- Git
- PM2（进程管理）
- Nginx（反向代理）

---

## 三、首次部署步骤

### 1. 安装 Node.js 20

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node -v && npm -v
```

### 2. 安装 Git / PM2 / Nginx

```bash
yum install -y git nginx
npm install -g pm2
```

### 3. 拉取代码

```bash
cd /var/www
git clone git@github.com:GoldXiong-code/testDemo.git atoms-demo
cd atoms-demo
```

### 4. 安装依赖

```bash
npm install
```

### 5. 创建环境变量（重要，密钥不硬编码）

```bash
cat > .env << 'EOF'
DEEPSEEK_API_KEY="你的DeepSeek密钥"
DASHSCOPE_API_KEY="你的通义万相密钥"
PEXELS_API_KEY="你的Pexels密钥"
EOF
```

> ⚠️ 三个密钥缺一不可；`.env` 已被 gitignore，不会上传，也不会被 `git pull` 覆盖。
> 模板见仓库里的 `.env.example`。

### 6. 构建并启动

```bash
npm run build
pm2 start node_modules/.bin/next --name atoms-demo -- start -p 3000
pm2 save
pm2 startup
```

> 数据库是 JSON 文件（`data/db.json`），无需 `prisma migrate`。

### 7. 配置 Nginx

```bash
cat > /etc/nginx/conf.d/atoms-demo.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 支持 SSE（AI 流式响应）
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
EOF

nginx -t && systemctl restart nginx && systemctl enable nginx
```

---

## 四、⚠️ 打不开最常见的原因：阿里云防火墙没放行 80 端口

服务器本身运行正常，但外网访问不了，**99% 是阿里云控制台的防火墙（安全组）没开放 80 端口**。

> 服务器内部 `curl localhost` 返回 200 只能说明应用本身正常，不代表外网能访问。

**解决步骤（在阿里云控制台操作，不是服务器上）：**

1. 登录 [阿里云控制台](https://home.console.aliyun.com) → 轻量应用服务器
2. 点击你的实例 → 左侧 **「防火墙」** 标签
3. 点 **「添加规则」**，按下面添加：

| 应用类型 | 协议 | 端口 | 说明 |
|---------|------|------|------|
| HTTP | TCP | 80 | 网页访问（必须） |
| HTTPS | TCP | 443 | HTTPS（后续配置证书后） |
| SSH | TCP | 22 | 远程连接（默认已有） |

4. 保存后等几十秒，浏览器访问 `http://你的IP` 即可。

> 另外注意：国内服务器用**域名**访问需要先做 **ICP 备案**，否则会被阻断；用 **IP 直连**不强制备案，但阿里云会拦截未备案域名的 80 端口流量。建议先用 IP 验证。

---

## 五、日常运维

```bash
# 查看状态 / 日志 / 重启
pm2 status
pm2 logs atoms-demo --lines 50
pm2 restart atoms-demo
```

### 更新代码到线上

```bash
cd /var/www/atoms-demo
git pull
npm install
npm run build
pm2 restart atoms-demo
```

> 密钥在 `.env` 里，`git pull` 不会动它，无需重填。

---

## 六、常见问题排查

| 现象 | 排查步骤 |
|------|---------|
| 浏览器打不开 / 超时 | 1) 阿里云控制台防火墙是否放行 80；2) `pm2 status` 是否 online；3) `systemctl status nginx` |
| 显示空白页 / 502 | `pm2 logs atoms-demo --lines 50` 看报错；`tail -50 /var/log/nginx/error.log` |
| 生成内容失败 | 检查服务器 `.env` 三个密钥是否都填了、是否正确 |
| 服务器重启后打不开 | `pm2 startup` + `pm2 save` 确保开机自启；`systemctl enable nginx` |

---

## 七、费用预估

| 项目 | 费用 |
|------|------|
| 轻量应用服务器（2核2G） | ¥54-100/年 |
| 域名（可选） | ¥30-60/年 |
| SSL 证书 | 免费（Let's Encrypt） |
| DeepSeek / 通义万相 API | 按调用量计费 |
| Pexels 图库 | 免费 |

---

## 下一步

- [ ] 阿里云控制台放行 80 端口（若访问不了）
- [ ] 购买域名并 ICP 备案（国内服务器用域名必须）
- [ ] 配置 HTTPS（Let's Encrypt 免费证书）
- [ ] 设置数据库定时备份
