# 阿里云轻量应用服务器部署指南

> 本指南帮助你把 Atoms-Demo 部署到阿里云，通过 IP 或域名访问

---

## 第一步：购买服务器

### 1. 访问阿里云

前往 [阿里云轻量应用服务器](https://www.aliyun.com/product/swas)

### 2. 选择配置

| 项目 | 推荐选择 |
|------|---------|
| **地域** | 离你最近的（如华东-上海、华北-北京、华南-深圳） |
| **镜像** | 系统镜像 → **Alibaba Cloud Linux** |
| **套餐** | 2核2G（最便宜即可） |
| **时长** | 包年更划算，新用户经常有 1 折优惠 |

> 💡 新用户可前往 [阿里云优惠活动页](https://www.aliyun.com/activity) 查看折扣，轻量服务器经常有 ¥68/年的优惠。

### 3. 设置密码

购买时设置 root 密码，请妥善保存。

### 4. 开放防火墙端口

购买完成后，进入服务器控制台：

1. 点击实例 → **防火墙** 标签
2. 添加以下规则：

| 协议 | 端口 | 说明 |
|------|------|------|
| TCP | 80 | HTTP 访问 |
| TCP | 443 | HTTPS（后续需要） |
| TCP | 22 | SSH 连接（默认已开） |

---

## 第二步：连接服务器

### macOS / Linux

打开终端：

```bash
ssh root@你的服务器IP
```

输入 root 密码。

### Windows

**方式一：PowerShell**（Win10+ 自带）
```powershell
ssh root@你的服务器IP
```

**方式二：使用 [Termius](https://termius.com/download)**（图形界面，更友好）

---

## 第三步：环境准备

连接服务器后，依次执行以下命令：

### 1. 安装 Node.js 20

Alibaba Cloud Linux 是干净系统，需要手动安装 Node.js：

```bash
# 安装 nvm（Node 版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# 安装 Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# 验证安装
node -v
npm -v
```

### 2. 安装 Git

```bash
yum install -y git
```

### 3. 安装 PM2（进程管理）

```bash
npm install -g pm2
```

### 4. 安装 Nginx（反向代理）

```bash
yum install -y nginx
```

---

## 第四步：部署项目

### 1. 拉取代码

```bash
cd /var/www
git clone git@github.com:GoldXiong-code/testDemo.git atoms-demo
cd atoms-demo
```

> 如果服务器未配置 SSH，使用 HTTPS 方式：
> ```bash
> git clone https://github.com/GoldXiong-code/testDemo.git atoms-demo
> ```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 4. 创建环境变量

```bash
cat > .env << 'EOF'
DATABASE_URL="file:./data/db.json"
DASHSCOPE_API_KEY="你的通义千问API密钥"
EOF
```

> ⚠️ 替换 `你的通义千问API密钥` 为实际密钥。

### 5. 构建项目

```bash
npm run build
```

---

## 第五步：配置 PM2

PM2 让应用持续运行，崩溃自动重启。

### 1. 创建配置文件

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'atoms-demo',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    cwd: '/var/www/atoms-demo',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
EOF
```

### 2. 启动应用

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. 检查状态

```bash
pm2 status
```

应该看到 `atoms-demo` 状态为 `online`。

---

## 第六步：配置 Nginx

Nginx 让用户通过 80 端口（而不是 3000）访问应用。

### 1. 创建 Nginx 配置

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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 支持 SSE（AI 流式响应）
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
EOF
```

### 2. 删除默认配置（如有）

```bash
rm -f /etc/nginx/conf.d/default.conf
```

### 3. 测试并启动 Nginx

```bash
nginx -t
systemctl restart nginx
systemctl enable nginx
```

---

## 第七步：验证部署

在浏览器中访问：

```
http://你的服务器IP
```

看到 Atoms 首页就说明部署成功！🎉

---

## 日常运维命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs atoms-demo

# 重启应用
pm2 restart atoms-demo

# 停止应用
pm2 stop atoms-demo
```

### 更新代码

```bash
cd /var/www/atoms-demo
git pull
npm install
npx prisma generate
npm run build
pm2 restart atoms-demo
```

---

## 常见问题

### Q: 访问 IP 显示空白页或 502？

```bash
# 1. 检查应用是否在运行
pm2 status

# 2. 检查 Nginx 是否在运行
systemctl status nginx

# 3. 查看应用日志
pm2 logs atoms-demo --lines 50

# 4. 查看 Nginx 日志
tail -50 /var/log/nginx/error.log
```

### Q: 数据库报错？

```bash
cd /var/www/atoms-demo
npx prisma generate
npx prisma db push
pm2 restart atoms-demo
```

### Q: 端口被占用？

```bash
# 查看 3000 端口占用
lsof -i :3000

# 杀掉占用进程
kill -9 <PID>
pm2 restart atoms-demo
```

### Q: 如何备份数据库？

```bash
# 手动备份
cp /var/www/atoms-demo/data/db.json /var/www/atoms-demo/data/db.json.backup

# 定时备份（每天凌晨 3 点）
crontab -e
# 添加：
# 0 3 * * * cp /var/www/atoms-demo/data/db.json /root/db-backup-$(date +\%Y\%m\%d).json
```

### Q: 服务器重启后应用没启动？

```bash
# 确保 PM2 开机自启已配置
pm2 startup
pm2 save

# 如果还没生效，手动启动
pm2 start /var/www/atoms-demo/ecosystem.config.js
```

---

## 费用预估

| 项目 | 费用 |
|------|------|
| 轻量应用服务器（2核2G） | ¥54-100/年 |
| 域名（可选） | ¥30-60/年 |
| SSL 证书（可选） | 免费（Let's Encrypt） |
| 通义千问 API | 按调用量计费 |
| **总计** | **约 ¥54-160/年** |

---

## 下一步

- [ ] 购买域名并备案（国内服务器必须）
- [ ] 配置 HTTPS（Let's Encrypt 免费证书）
- [ ] 设置自动备份
- [ ] 监控服务器状态
