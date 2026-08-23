# 腾讯云轻量服务器部署指南

> 无需域名，直接用服务器 IP 访问

---

## 第一步：购买服务器

### 1. 访问腾讯云

前往 [腾讯云轻量应用服务器](https://cloud.tencent.com/product/lighthouse)

### 2. 选择配置

推荐配置（个人项目够用）：

| 项目 | 选择 |
|------|------|
| **地域** | 选离你最近的（如上海、广州、北京） |
| **镜像** | 应用镜像 → **Node.js** （预装 Node.js 环境） |
| **套餐** | 2核2G / 50GB SSD / 3Mbps（最便宜的即可） |
| **时长** | 按需选择（包年更便宜） |

### 3. 设置服务器密码

购买时会要求设置 root 密码，请记住这个密码。

### 4. 开放防火墙端口

购买完成后，进入服务器控制台：

1. 点击服务器实例 → **防火墙** 标签
2. 添加以下规则：

| 协议 | 端口 | 说明 |
|------|------|------|
| TCP | 80 | HTTP 访问 |
| TCP | 22 | SSH 连接（默认已开放） |

---

## 第二步：连接服务器

### macOS / Linux

打开终端，使用 SSH 连接：

```bash
ssh root@你的服务器IP
```

输入购买时设置的 root 密码。

### Windows

**方式一：使用 PowerShell**（Windows 10+自带）
```powershell
ssh root@你的服务器IP
```

**方式二：使用 [Termius](https://termius.com/download)**（图形界面，更友好）

---

## 第三步：安装环境

连接服务器后，依次执行以下命令：

### 1. 确认 Node.js 版本

如果选择了 Node.js 应用镜像，Node.js 应该已经安装好了：

```bash
node -v
npm -v
```

如果 Node.js 版本低于 18，需要升级：

```bash
# 安装 nvm（Node 版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# 安装 Node.js 20
nvm install 20
nvm use 20
nvm alias default 20
```

### 2. 安装 Git

```bash
# Ubuntu/Debian
apt update && apt install -y git

# CentOS
yum install -y git
```

### 3. 安装 PM2（进程管理）

```bash
npm install -g pm2
```

### 4. 安装 Nginx（反向代理）

```bash
# Ubuntu/Debian
apt install -y nginx

# CentOS
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

> 💡 如果服务器没有配置 GitHub SSH，可以用 HTTPS 方式：
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

### 4. 构建项目

```bash
npm run build
```

### 5. 创建环境变量文件

```bash
cat > .env << 'EOF'
DATABASE_URL="file:./data/db.json"
DASHSCOPE_API_KEY="你的通义千问API密钥"
EOF
```

> ⚠️ 请把 `你的通义千问API密钥` 替换为实际的 API 密钥。

---

## 第五步：配置 PM2

### 1. 创建 PM2 配置文件

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

### 3. 验证运行状态

```bash
pm2 status
pm2 logs atoms-demo
```

---

## 第六步：配置 Nginx

### 1. 创建 Nginx 配置

```bash
cat > /etc/nginx/sites-available/atoms-demo << 'EOF'
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

### 2. 启用配置

```bash
# Ubuntu/Debian
ln -sf /etc/nginx/sites-available/atoms-demo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# CentOS（如果 sites-available 目录不存在）
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
# 然后把上面的配置写入 /etc/nginx/sites-available/atoms-demo
ln -sf /etc/nginx/sites-available/atoms-demo /etc/nginx/sites-enabled/
# 在 /etc/nginx/nginx.conf 的 http {} 块中添加：include /etc/nginx/sites-enabled/*;
```

### 3. 测试并重启 Nginx

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

看到 Atoms 首页就说明部署成功了！🎉

---

## 常用运维命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs atoms-demo

# 重启应用
pm2 restart atoms-demo

# 停止应用
pm2 stop atoms-demo

# 更新代码并重新部署
cd /var/www/atoms-demo
git pull
npm install
npx prisma generate
npm run build
pm2 restart atoms-demo
```

---

## 常见问题

### Q: 访问 IP 显示空白页？

```bash
# 检查应用是否在运行
pm2 status

# 检查 Nginx 是否在运行
systemctl status nginx

# 查看错误日志
pm2 logs atoms-demo --lines 50
```

### Q: 数据库报错？

```bash
# 确保 Prisma Client 已生成
cd /var/www/atoms-demo
npx prisma generate
npx prisma db push
pm2 restart atoms-demo
```

### Q: 端口被占用？

```bash
# 查看 3000 端口占用情况
lsof -i :3000

# 杀掉占用进程
kill -9 <PID>
pm2 restart atoms-demo
```

### Q: 如何备份数据库？

```bash
# 备份 SQLite 数据库文件
cp /var/www/atoms-demo/data/db.json /var/www/atoms-demo/data/db.json.backup

# 定时备份（每天凌晨 3 点）
crontab -e
# 添加以下行：
# 0 3 * * * cp /var/www/atoms-demo/data/db.json /var/www/atoms-demo/data/db.json.backup.$(date +\%Y\%m\%d)
```
