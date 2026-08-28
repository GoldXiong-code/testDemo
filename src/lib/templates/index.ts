/**
 * 模板注册系统
 *
 * 每个模板包含：
 * - 完整的 HTML 结构（基于 Tailwind CSS + Flowbite 风格组件）
 * - 可替换的内容占位符（通过 LLM 填充）
 * - 精美的视觉设计（渐变、阴影、动效）
 */

/** 生成内联 SVG 占位图（data URI），零外部依赖，国内网络可用 */
function placeholderImg(emoji: string, bg1: string, bg2: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="220" font-size="120" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  /** 模板 HTML 内容，包含 {{placeholders}} 供 LLM 填充 */
  content: string;
}

// ==================== 模板 HTML ====================

export const TEMPLATES: Template[] = [
  {
    id: "landing-general",
    name: "通用商业落地页",
    category: "tool",
    description: "适用于大多数商业产品的现代落地页，包含 Hero、特性、定价、CTA 等模块",
    tags: ["商业", "落地页", "通用", "企业"],
    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '{{primaryColor}}', secondary: '{{secondaryColor}}' },
          animation: { 'fade-in': 'fadeIn 0.6s ease-out', 'slide-up': 'slideUp 0.6s ease-out' },
          keyframes: {
            fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
            slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }
          }
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .gradient-text { background: linear-gradient(135deg, {{primaryColor}}, {{secondaryColor}}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-bg { background: radial-gradient(ellipse at top, {{primaryColor}}15 0%, transparent 70%); }
    .card-hover { transition: all 0.3s ease; }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .nav-blur { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  </style>
</head>
<body class="bg-gray-50 text-gray-900">

  <!-- 导航栏 -->
  <nav class="fixed top-0 left-0 right-0 z-50 nav-blur bg-white/80 border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <span class="text-lg font-bold">{{brandName}}</span>
      </div>
      <div class="hidden md:flex items-center gap-8">
        <a href="#features" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">功能</a>
        <a href="#pricing" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">定价</a>
        <a href="#about" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">关于</a>
        <a href="#contact" class="text-sm text-gray-600 hover:text-gray-900 transition-colors">联系</a>
      </div>
      <div class="flex items-center gap-3">
        <button class="text-sm text-gray-600 hover:text-gray-900 font-medium">登录</button>
        <button class="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium">免费开始</button>
      </div>
    </div>
  </nav>

  <!-- Hero 区域 -->
  <section class="hero-bg pt-32 pb-20 px-6">
    <div class="max-w-4xl mx-auto text-center animate-fade-in">
      <div class="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
        <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
        {{badgeText}}
      </div>
      <h1 class="text-4xl md:text-6xl font-bold leading-tight mb-6">
        {{heroTitle}}
      </h1>
      <p class="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
        {{heroSubtitle}}
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button class="w-full sm:w-auto bg-primary text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25">
          {{ctaText}}
        </button>
        <button class="w-full sm:w-auto border border-gray-200 bg-white text-gray-700 px-8 py-3.5 rounded-xl text-base font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          观看演示
        </button>
      </div>
      <div class="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
        <div class="flex items-center gap-1.5"><svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>免费试用</div>
        <div class="flex items-center gap-1.5"><svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>无需信用卡</div>
        <div class="flex items-center gap-1.5"><svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>随时取消</div>
      </div>
    </div>
  </section>

  <!-- 特性区域 -->
  <section id="features" class="py-20 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16 animate-slide-up">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">为什么选择 {{brandName}}</h2>
        <p class="text-gray-600 text-lg max-w-2xl mx-auto">我们提供强大的功能，帮助你的业务快速增长</p>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        {{#features}}
        <div class="card-hover bg-white rounded-2xl p-8 border border-gray-100">
          <div class="w-12 h-12 rounded-xl bg-{{featureColor}}/10 flex items-center justify-center mb-5">
            <span class="text-2xl">{{featureIcon}}</span>
          </div>
          <h3 class="text-lg font-bold mb-2">{{featureTitle}}</h3>
          <p class="text-gray-600 text-sm leading-relaxed">{{featureDesc}}</p>
        </div>
        {{/features}}
      </div>
    </div>
  </section>

  <!-- 定价区域 -->
  <section id="pricing" class="py-20 px-6 bg-white">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">简单透明的定价</h2>
        <p class="text-gray-600 text-lg">选择最适合你的方案</p>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        {{#plans}}
        <div class="card-hover rounded-2xl p-8 border {{planHighlight}} bg-white">
          <h3 class="text-lg font-bold mb-2">{{planName}}</h3>
          <p class="text-gray-500 text-sm mb-6">{{planDesc}}</p>
          <div class="mb-6">
            <span class="text-4xl font-bold">{{planPrice}}</span>
            <span class="text-gray-500 text-sm">/{{planUnit}}</span>
          </div>
          <ul class="space-y-3 mb-8">
            {{#planFeatures}}
            <li class="flex items-center gap-2 text-sm text-gray-600">
              <svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              {{.}}
            </li>
            {{/planFeatures}}
          </ul>
          <button class="w-full py-3 rounded-xl font-medium transition-all {{planBtnStyle}}">{{planBtnText}}</button>
        </div>
        {{/plans}}
      </div>
    </div>
  </section>

  <!-- CTA 区域 -->
  <section class="py-20 px-6">
    <div class="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary to-secondary rounded-3xl p-12 md:p-16">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">{{ctaTitle}}</h2>
      <p class="text-white/80 text-lg mb-8 max-w-xl mx-auto">{{ctaSubtitle}}</p>
      <button class="bg-white text-primary px-8 py-3.5 rounded-xl font-semibold hover:bg-white/90 transition-all">
        {{ctaText}}
      </button>
    </div>
  </section>

  <!-- 页脚 -->
  <footer class="bg-gray-900 text-gray-400 py-12 px-6">
    <div class="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
      <div>
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <span class="text-white font-bold">{{brandName}}</span>
        </div>
        <p class="text-sm">{{brandDesc}}</p>
      </div>
      <div>
        <h4 class="text-white font-medium mb-4">产品</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="#" class="hover:text-white transition-colors">功能介绍</a></li>
          <li><a href="#" class="hover:text-white transition-colors">定价方案</a></li>
          <li><a href="#" class="hover:text-white transition-colors">更新日志</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-white font-medium mb-4">公司</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="#" class="hover:text-white transition-colors">关于我们</a></li>
          <li><a href="#" class="hover:text-white transition-colors">联系我们</a></li>
          <li><a href="#" class="hover:text-white transition-colors">加入我们</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-white font-medium mb-4">法律</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="#" class="hover:text-white transition-colors">隐私政策</a></li>
          <li><a href="#" class="hover:text-white transition-colors">服务条款</a></li>
          <li><a href="#" class="hover:text-white transition-colors">Cookie 政策</a></li>
        </ul>
      </div>
    </div>
    <div class="max-w-7xl mx-auto mt-10 pt-8 border-t border-gray-800 text-sm text-center">
      © 2024 {{brandName}}. All rights reserved.
    </div>
  </footer>

</body>
</html>`
  },
  {
    id: "ecommerce",
    name: "电商产品展示",
    category: "ecommerce",
    description: "适合电商产品展示，包含商品卡片、购物车、分类浏览等模块",
    tags: ["电商", "购物", "商品", "产品"],
    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '{{primaryColor}}', secondary: '{{secondaryColor}}' },
          animation: {
            'fade-in': 'fadeIn 0.3s ease-out',
            'fade-up': 'fadeUp 0.5s ease-out both',
            'float': 'floaty 6s ease-in-out infinite',
          },
          keyframes: {
            fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
            fadeUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
            floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
          },
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif; -webkit-font-smoothing: antialiased; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    .product-card { transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s; }
    .product-card:hover { transform: translateY(-6px); box-shadow: 0 24px 48px -16px rgba(0,0,0,.18); }
    .product-img { transition: transform .5s cubic-bezier(.2,.8,.2,1); }
    .product-card:hover .product-img { transform: scale(1.07); }
    .page { display: none; }
    .page.active { display: block; animation: fadeIn .3s ease-out; }
    .nav-link { cursor: pointer; position: relative; }
    .nav-link.active { color: {{primaryColor}}; font-weight: 600; }
    .nav-link.active::after { content:''; position:absolute; left:50%; transform:translateX(-50%); bottom:-6px; width:18px; height:3px; border-radius:99px; background:{{primaryColor}}; }
    #navbar { transition: box-shadow .3s; }
    #navbar.scrolled { box-shadow: 0 4px 24px -8px rgba(0,0,0,.08); }
    .discount-badge { position:absolute; top:10px; left:10px; background:linear-gradient(90deg,#f43f5e,#f97316); color:#fff; font-size:11px; font-weight:700; padding:3px 8px; border-radius:99px; z-index:5; }
    .cat-pill { transition: all .2s; cursor: pointer; }
    .cat-pill:hover { transform: translateY(-1px); }
    .fade-up-item { opacity: 0; animation: fadeUp .5s ease-out forwards; }
    .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .qty-btn { transition: all .15s; }
    .qty-btn:hover { background: {{primaryColor}}; color:#fff; border-color: {{primaryColor}}; }
    input:focus, textarea:focus { outline: none; }
  </style>
</head>
<body class="bg-gray-50">

  <!-- 顶部导航 -->
  <nav id="navbar" class="bg-white/85 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
      <div class="flex items-center gap-2.5 cursor-pointer" onclick="showPage('home')">
        <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-lg font-bold shadow-md">{{brandLogo}}</span>
        <span class="text-xl font-bold text-gray-900">{{brandName}}</span>
      </div>
      <div class="hidden md:flex items-center gap-8">
        <a class="nav-link active text-sm text-gray-700" data-page="home" onclick="showPage('home')">首页</a>
        <a class="nav-link text-sm text-gray-700" data-page="products" onclick="showPage('products')">全部商品</a>
        <a class="nav-link text-sm text-gray-700" data-page="new" onclick="showPage('new')">新品上架</a>
        <a class="nav-link text-sm text-gray-700" data-page="sale" onclick="showPage('sale')">优惠活动</a>
      </div>
      <div class="flex items-center gap-4">
        <button class="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100" title="搜索">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </button>
        <button class="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100" onclick="showPage('cart')" title="购物车">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          <span id="cart-count" class="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full items-center justify-center font-semibold hidden">0</span>
        </button>
      </div>
    </div>
  </nav>

  <!-- 分类标签 -->
  <div class="bg-white border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 overflow-x-auto">
      {{#categories}}
      <button class="cat-pill px-5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap {{catActive}}" onclick="filterByCategory(this)">{{catName}}</button>
      {{/categories}}
    </div>
  </div>

  <!-- ========== 首页 ========== -->
  <div id="page-home" class="page active">
    <!-- Hero -->
    <section class="px-6 pt-10 pb-6">
      <div class="max-w-7xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-secondary text-white p-10 md:p-16">
        <div class="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/10 animate-float"></div>
        <div class="absolute -bottom-20 right-32 w-56 h-56 rounded-full bg-white/10"></div>
        <div class="absolute top-8 right-1/4 w-20 h-20 rounded-full bg-white/20 animate-float"></div>
        <div class="relative z-10 max-w-xl">
          <span class="inline-block bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-5 tracking-wide">✨ {{badgeText}}</span>
          <h1 class="text-3xl md:text-5xl font-bold mb-4 leading-tight">{{heroTitle}}</h1>
          <p class="text-white/85 text-base md:text-lg mb-8">{{heroSubtitle}}</p>
          <div class="flex flex-wrap gap-3">
            <button class="bg-white text-primary px-7 py-3 rounded-full font-semibold hover:scale-105 transition shadow-lg" onclick="showPage('products')">立即选购</button>
            <button class="border border-white/50 text-white px-7 py-3 rounded-full font-semibold hover:bg-white/10 transition" onclick="showPage('sale')">查看优惠</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 服务保障 -->
    <section class="px-6 py-4">
      <div class="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
          <span class="text-2xl">🚀</span><div><p class="font-semibold text-sm text-gray-900">极速发货</p><p class="text-xs text-gray-400">下单 24 小时内发出</p></div>
        </div>
        <div class="bg-white rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
          <span class="text-2xl">🛡️</span><div><p class="font-semibold text-sm text-gray-900">正品保障</p><p class="text-xs text-gray-400">官方授权 假一赔十</p></div>
        </div>
        <div class="bg-white rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
          <span class="text-2xl">🔄</span><div><p class="font-semibold text-sm text-gray-900">7 天退换</p><p class="text-xs text-gray-400">无理由退换货</p></div>
        </div>
        <div class="bg-white rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
          <span class="text-2xl">💬</span><div><p class="font-semibold text-sm text-gray-900">在线客服</p><p class="text-xs text-gray-400">7×24 小时响应</p></div>
        </div>
      </div>
    </section>

    <!-- 精选商品 -->
    <section class="py-8 px-6 pb-20">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-end justify-between mb-8">
          <div>
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900">{{sectionTitle}}</h2>
            <p class="text-gray-400 text-sm mt-1">为你精心挑选的人气好物</p>
          </div>
          <a class="text-primary text-sm font-medium hover:underline cursor-pointer shrink-0" onclick="showPage('products')">查看全部 →</a>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
          {{#products}}
          <div class="product-card fade-up-item bg-white rounded-2xl overflow-hidden border border-gray-100 relative cursor-pointer" data-category="{{productCategory}}" data-price="{{productPrice}}" data-original="{{originalPrice}}" onclick="showProductDetail({{productId}})">
            <div class="aspect-square bg-gray-100 overflow-hidden relative">
              <img src="{{productImage}}" alt="{{productName}}" class="product-img w-full h-full object-cover">
              <button class="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur text-primary flex items-center justify-center shadow-md hover:bg-primary hover:text-white transition z-10" onclick="event.stopPropagation(); addToCart({{productId}})" title="加入购物车">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              </button>
            </div>
            <div class="p-4">
              <p class="text-xs text-primary font-medium mb-1">{{productCategory}}</p>
              <h3 class="font-semibold text-sm mb-1.5 line-clamp-2 leading-snug text-gray-900">{{productName}}</h3>
              <div class="stars text-xs text-amber-400 mb-2"></div>
              <div class="flex items-end justify-between">
                <div><span class="text-lg font-bold text-primary">¥{{productPrice}}</span><span class="text-xs text-gray-400 line-through ml-1.5">¥{{originalPrice}}</span></div>
              </div>
            </div>
          </div>
          {{/products}}
        </div>
      </div>
    </section>
  </div>

  <!-- ========== 全部商品页 ========== -->
  <div id="page-products" class="page">
    <section class="py-8 px-6 pb-20">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-1">全部商品</h2>
        <p class="text-gray-400 text-sm mb-8">为你精心挑选的全部好物</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
          {{#products}}
          <div class="product-card bg-white rounded-2xl overflow-hidden border border-gray-100 relative cursor-pointer" data-category="{{productCategory}}" data-price="{{productPrice}}" data-original="{{originalPrice}}" onclick="showProductDetail({{productId}})">
            <div class="aspect-square bg-gray-100 overflow-hidden relative">
              <img src="{{productImage}}" alt="{{productName}}" class="product-img w-full h-full object-cover">
              <button class="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur text-primary flex items-center justify-center shadow-md hover:bg-primary hover:text-white transition z-10" onclick="event.stopPropagation(); addToCart({{productId}})" title="加入购物车">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              </button>
            </div>
            <div class="p-4">
              <p class="text-xs text-primary font-medium mb-1">{{productCategory}}</p>
              <h3 class="font-semibold text-sm mb-1.5 line-clamp-2 leading-snug text-gray-900">{{productName}}</h3>
              <div class="stars text-xs text-amber-400 mb-2"></div>
              <div class="flex items-end justify-between">
                <div><span class="text-lg font-bold text-primary">¥{{productPrice}}</span><span class="text-xs text-gray-400 line-through ml-1.5">¥{{originalPrice}}</span></div>
              </div>
            </div>
          </div>
          {{/products}}
        </div>
      </div>
    </section>
  </div>

  <!-- ========== 新品上架页 ========== -->
  <div id="page-new" class="page">
    <section class="py-8 px-6 pb-20">
      <div class="max-w-7xl mx-auto">
        <div class="bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
          <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/15"></div>
          <h2 class="text-3xl font-bold mb-2 relative z-10">新品上架</h2>
          <p class="text-white/85 relative z-10">发现最新上架的精选好物，抢先体验</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
          {{#products}}
          <div class="product-card bg-white rounded-2xl overflow-hidden border border-gray-100 relative cursor-pointer" data-category="{{productCategory}}" data-price="{{productPrice}}" data-original="{{originalPrice}}" onclick="showProductDetail({{productId}})">
            <div class="aspect-square bg-gray-100 overflow-hidden relative">
              <span class="discount-badge" style="background:linear-gradient(90deg,#8b5cf6,#d946ef)">NEW</span>
              <img src="{{productImage}}" alt="{{productName}}" class="product-img w-full h-full object-cover">
            </div>
            <div class="p-4">
              <p class="text-xs text-primary font-medium mb-1">{{productCategory}}</p>
              <h3 class="font-semibold text-sm mb-1.5 line-clamp-2 leading-snug text-gray-900">{{productName}}</h3>
              <div class="stars text-xs text-amber-400 mb-2"></div>
              <div class="flex items-end justify-between">
                <div><span class="text-lg font-bold text-primary">¥{{productPrice}}</span><span class="text-xs text-gray-400 line-through ml-1.5">¥{{originalPrice}}</span></div>
              </div>
            </div>
          </div>
          {{/products}}
        </div>
      </div>
    </section>
  </div>

  <!-- ========== 优惠活动页 ========== -->
  <div id="page-sale" class="page">
    <section class="py-8 px-6 pb-20">
      <div class="max-w-7xl mx-auto">
        <div class="bg-gradient-to-r from-rose-500 to-orange-500 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
          <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/15"></div>
          <h2 class="text-3xl font-bold mb-2 relative z-10">🔥 限时优惠</h2>
          <p class="text-white/85 relative z-10">精选商品超值特惠，手慢无！</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
          {{#products}}
          <div class="product-card bg-white rounded-2xl overflow-hidden border border-gray-100 relative cursor-pointer" data-category="{{productCategory}}" data-price="{{productPrice}}" data-original="{{originalPrice}}" onclick="showProductDetail({{productId}})">
            <div class="aspect-square bg-gray-100 overflow-hidden relative">
              <img src="{{productImage}}" alt="{{productName}}" class="product-img w-full h-full object-cover">
            </div>
            <div class="p-4">
              <p class="text-xs text-primary font-medium mb-1">{{productCategory}}</p>
              <h3 class="font-semibold text-sm mb-1.5 line-clamp-2 leading-snug text-gray-900">{{productName}}</h3>
              <div class="stars text-xs text-amber-400 mb-2"></div>
              <div class="flex items-end justify-between">
                <div><span class="text-lg font-bold text-primary">¥{{productPrice}}</span><span class="text-xs text-gray-400 line-through ml-1.5">¥{{originalPrice}}</span></div>
              </div>
            </div>
          </div>
          {{/products}}
        </div>
      </div>
    </section>
  </div>

  <!-- ========== 商品详情页 ========== -->
  <div id="page-detail" class="page">
    <section class="py-8 px-6 pb-20">
      <div class="max-w-7xl mx-auto">
        <button class="text-gray-500 mb-6 flex items-center gap-1.5 hover:text-primary text-sm" onclick="showPage('products')">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          返回商品列表
        </button>
        <div class="bg-white rounded-3xl overflow-hidden border border-gray-100">
          <div class="grid md:grid-cols-2 gap-10 p-8 md:p-10">
            <div class="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
              <img id="detail-image" src="" alt="" class="w-full h-full object-cover">
            </div>
            <div class="flex flex-col">
              <p id="detail-category" class="text-xs text-primary font-semibold bg-primary/10 inline-block self-start px-3 py-1 rounded-full mb-3"></p>
              <h1 id="detail-name" class="text-2xl md:text-3xl font-bold text-gray-900 mb-3"></h1>
              <div class="stars-detail text-sm text-amber-400 mb-4"></div>
              <p id="detail-desc" class="text-gray-500 mb-6 leading-relaxed">高品质商品，品质保证。采用优质材料制作，工艺精湛，经久耐用，是你不可错过的选择。</p>
              <div class="flex items-end gap-3 mb-6">
                <span id="detail-price" class="text-4xl font-bold text-primary"></span>
                <span id="detail-original" class="text-lg text-gray-400 line-through mb-1"></span>
                <span id="detail-discount" class="mb-1.5 text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full"></span>
              </div>
              <div class="flex items-center gap-3 mb-6">
                <span class="text-sm text-gray-500">数量</span>
                <div class="flex items-center border border-gray-200 rounded-full overflow-hidden">
                  <button class="qty-btn w-9 h-9 border-r border-gray-200 text-gray-600" onclick="changeDetailQty(-1)">−</button>
                  <span id="detail-qty" class="w-12 text-center font-semibold text-gray-900">1</span>
                  <button class="qty-btn w-9 h-9 border-l border-gray-200 text-gray-600" onclick="changeDetailQty(1)">+</button>
                </div>
              </div>
              <div class="flex items-center gap-3 mb-8">
                <button class="flex-1 bg-primary text-white py-3.5 rounded-full font-semibold hover:opacity-90 hover:shadow-lg transition-all" onclick="addToCartDetail()">加入购物车</button>
                <button class="flex-1 border-2 border-primary text-primary py-3 rounded-full font-semibold hover:bg-primary/5 transition-all" onclick="addToCartDetail(); showPage('cart')">立即购买</button>
              </div>
              <div class="border-t border-gray-100 pt-6">
                <h3 class="font-semibold text-gray-900 mb-3">商品特色</h3>
                <ul class="grid grid-cols-2 gap-2.5 text-gray-600 text-sm">
                  <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 品质保证，正品行货</li>
                  <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 7 天无理由退换</li>
                  <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 全国包邮，极速发货</li>
                  <li class="flex items-center gap-2"><span class="text-green-500">✓</span> 官方质保，售后无忧</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- ========== 购物车页 ========== -->
  <div id="page-cart" class="page">
    <section class="py-8 px-6 pb-20">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-8">🛒 购物车</h2>
        <div class="grid lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-4">
            <div id="cart-items" class="space-y-4">
              <div class="bg-white rounded-2xl p-10 border border-gray-100 text-center text-gray-400">
                <p class="text-4xl mb-3">🛍️</p>购物车还是空的，快去挑选心仪的商品吧！
              </div>
            </div>
          </div>
          <div class="lg:col-span-1">
            <div class="bg-white rounded-2xl p-6 border border-gray-100 sticky top-24">
              <h3 class="font-bold text-gray-900 mb-4">订单摘要</h3>
              <div class="space-y-2.5 text-sm">
                <div class="flex justify-between text-gray-500"><span>商品小计</span><span id="cart-subtotal">¥0</span></div>
                <div class="flex justify-between text-gray-500"><span>运费</span><span class="text-green-500">免运费</span></div>
                <div class="flex justify-between text-gray-500"><span>优惠</span><span class="text-rose-500" id="cart-save">-¥0</span></div>
              </div>
              <div class="border-t border-gray-100 my-4"></div>
              <div class="flex items-center justify-between mb-5">
                <span class="font-semibold text-gray-900">合计</span>
                <span id="cart-total" class="text-2xl font-bold text-primary">¥0</span>
              </div>
              <button class="w-full bg-primary text-white py-3.5 rounded-full font-semibold hover:opacity-90 hover:shadow-lg transition-all" onclick="checkout()">去结算</button>
              <p class="text-xs text-gray-400 text-center mt-3">支持 7 天无理由退换 · 正品保障</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- 页脚 -->
  <footer class="bg-gray-900 text-gray-400 pt-14 pb-8 px-6">
    <div class="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
      <div class="md:col-span-2">
        <div class="flex items-center gap-2.5 mb-3">
          <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">{{brandLogo}}</span>
          <span class="text-white font-bold text-lg">{{brandName}}</span>
        </div>
        <p class="text-sm leading-relaxed max-w-sm">{{brandDesc}}</p>
      </div>
      <div>
        <h4 class="text-white font-semibold mb-3 text-sm">购物指南</h4>
        <ul class="space-y-2 text-sm">
          <li class="hover:text-white cursor-pointer" onclick="showPage('products')">全部商品</li>
          <li class="hover:text-white cursor-pointer" onclick="showPage('new')">新品上架</li>
          <li class="hover:text-white cursor-pointer" onclick="showPage('sale')">优惠活动</li>
        </ul>
      </div>
      <div>
        <h4 class="text-white font-semibold mb-3 text-sm">客户服务</h4>
        <ul class="space-y-2 text-sm">
          <li class="hover:text-white cursor-pointer">帮助中心</li>
          <li class="hover:text-white cursor-pointer">退换政策</li>
          <li class="hover:text-white cursor-pointer">联系客服</li>
        </ul>
      </div>
    </div>
    <div class="max-w-7xl mx-auto mt-10 pt-6 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
      <span>© 2024 {{brandName}}. All rights reserved.</span>
      <span>用心做好每一件商品 ❤️</span>
    </div>
  </footer>

  <!-- Toast 提示 -->
  <div id="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-xl z-[100] hidden items-center gap-2">
    <svg class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
    <span id="toast-text">已加入购物车</span>
  </div>

  <!-- 结算确认弹窗 -->
  <div id="checkout-modal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] hidden items-center justify-center p-6">
    <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center relative animate-fade-up">
      <button class="absolute top-4 right-4 w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center" onclick="closeCheckout()">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">订单提交成功</h3>
      <p class="text-gray-500 text-sm mb-1">共 <span id="checkout-count" class="font-semibold text-gray-900">0</span> 件商品，合计</p>
      <p class="text-3xl font-bold text-primary mb-4" id="checkout-total">¥0</p>
      <p class="text-xs text-gray-400 mb-6">这是演示环境，不会产生真实扣费。感谢体验 {{brandName}}！</p>
      <button class="w-full bg-primary text-white py-3 rounded-full font-semibold hover:opacity-90 transition" onclick="finishCheckout()">好的，继续逛逛</button>
    </div>
  </div>

  <script>
    // 页面切换
    function showPage(pageName) {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      var target = document.getElementById('page-' + pageName);
      if (target) target.classList.add('active');
      document.querySelectorAll('.nav-link').forEach(function (l) { l.classList.remove('active'); });
      var navLink = document.querySelector('[data-page="' + pageName + '"]');
      if (navLink) navLink.classList.add('active');
      if (pageName === 'products') {
        document.querySelectorAll('#page-products .product-card').forEach(function (c) { c.style.display = ''; });
      }
      window.scrollTo(0, 0);
    }

    // 导航滚动阴影
    window.addEventListener('scroll', function () {
      var nb = document.getElementById('navbar');
      if (window.scrollY > 8) nb.classList.add('scrolled'); else nb.classList.remove('scrolled');
    });

    // 商品数据
    var products = [
      {{#products}}
      { id: {{productId}}, name: "{{productName}}", price: {{productPrice}}, originalPrice: {{originalPrice}}, category: "{{productCategory}}", image: "{{productImage}}" },
      {{/products}}
    ];

    var currentProductId = null;
    var detailQty = 1;
    var cart = []; // { id, qty }

    // 根据 id 生成稳定的伪随机评分
    function ratingFor(id) {
      var n = ((id * 37) % 10) / 10;
      return (4 + n).toFixed(1);
    }

    // 填充评分与折扣角标
    function decorateCards() {
      document.querySelectorAll('.product-card').forEach(function (card) {
        var price = parseFloat(card.getAttribute('data-price'));
        var original = parseFloat(card.getAttribute('data-original'));
        // 折扣角标
        var imgBox = card.querySelector('.aspect-square');
        if (imgBox && original > price && original > 0 && !imgBox.querySelector('.discount-badge')) {
          var pct = Math.round((1 - price / original) * 100);
          if (pct > 0) {
            var b = document.createElement('span');
            b.className = 'discount-badge';
            b.textContent = '-' + pct + '%';
            imgBox.appendChild(b);
          }
        }
        // 评分（用图片 src 稳定推断）
        var stars = card.querySelector('.stars');
        if (stars && !stars.dataset.done) {
          stars.dataset.done = '1';
          var idNum = parseInt((card.getAttribute('onclick') || '').replace(/[^0-9]/g, '')) || 1;
          stars.innerHTML = '★★★★★ <span class="text-gray-400 ml-1">' + ratingFor(idNum) + '</span>';
        }
      });
    }

    // Toast
    var toastTimer = null;
    function showToast(msg) {
      var t = document.getElementById('toast');
      document.getElementById('toast-text').textContent = msg;
      t.classList.remove('hidden'); t.classList.add('flex');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.add('hidden'); t.classList.remove('flex'); }, 1800);
    }

    // 商品详情
    function showProductDetail(id) {
      currentProductId = id;
      detailQty = 1;
      var product = products.find(function (p) { return p.id === id; });
      if (!product) return;
      document.getElementById('detail-image').src = product.image;
      document.getElementById('detail-name').textContent = product.name;
      document.getElementById('detail-category').textContent = product.category;
      document.getElementById('detail-price').textContent = '¥' + product.price;
      document.getElementById('detail-original').textContent = '¥' + product.originalPrice;
      var pct = Math.round((1 - product.price / product.originalPrice) * 100);
      document.getElementById('detail-discount').textContent = pct > 0 ? ('立省 ' + pct + '%') : '';
      document.getElementById('detail-qty').textContent = '1';
      var sd = document.querySelector('.stars-detail');
      if (sd) sd.innerHTML = '★★★★★ <span class="text-gray-400 ml-1 text-sm">' + ratingFor(id) + ' 分 · 已售 ' + (120 + id * 37) + ' 件</span>';
      showPage('detail');
    }

    function changeDetailQty(delta) {
      detailQty = Math.max(1, detailQty + delta);
      document.getElementById('detail-qty').textContent = detailQty;
    }

    // 加入购物车
    function addToCart(id, qty) {
      qty = qty || 1;
      var found = cart.find(function (c) { return c.id === id; });
      if (found) found.qty += qty; else cart.push({ id: id, qty: qty });
      updateCart();
      var p = products.find(function (x) { return x.id === id; });
      showToast('已加入购物车：' + (p ? p.name : '商品'));
    }

    function addToCartDetail() {
      if (currentProductId != null) addToCart(currentProductId, detailQty);
    }

    // 数量增减（购物车内）
    function changeQty(id, delta) {
      var found = cart.find(function (c) { return c.id === id; });
      if (!found) return;
      found.qty += delta;
      if (found.qty <= 0) cart = cart.filter(function (c) { return c.id !== id; });
      updateCart();
    }

    function removeFromCart(id) {
      cart = cart.filter(function (c) { return c.id !== id; });
      updateCart();
    }

    // 更新购物车渲染
    function updateCart() {
      var badge = document.getElementById('cart-count');
      var totalQty = cart.reduce(function (s, c) { return s + c.qty; }, 0);
      badge.textContent = totalQty;
      if (totalQty > 0) { badge.classList.remove('hidden'); badge.classList.add('flex'); }
      else { badge.classList.add('hidden'); badge.classList.remove('flex'); }

      var box = document.getElementById('cart-items');
      if (cart.length === 0) {
        box.innerHTML = '<div class="bg-white rounded-2xl p-10 border border-gray-100 text-center text-gray-400"><p class="text-4xl mb-3">🛍️</p>购物车还是空的，快去挑选心仪的商品吧！</div>';
        document.getElementById('cart-total').textContent = '¥0';
        document.getElementById('cart-subtotal').textContent = '¥0';
        document.getElementById('cart-save').textContent = '-¥0';
        return;
      }
      var html = '', total = 0, save = 0;
      cart.forEach(function (item) {
        var p = products.find(function (x) { return x.id === item.id; });
        if (!p) return;
        total += p.price * item.qty;
        save += (p.originalPrice - p.price) * item.qty;
        html += '<div class="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4">' +
          '<img src="' + p.image + '" class="w-20 h-20 object-cover rounded-xl cursor-pointer" onclick="showProductDetail(' + p.id + ')">' +
          '<div class="flex-1 min-w-0"><h4 class="font-semibold text-gray-900 truncate cursor-pointer" onclick="showProductDetail(' + p.id + ')">' + p.name + '</h4>' +
          '<p class="text-primary font-bold mt-1">¥' + p.price + '</p></div>' +
          '<div class="flex items-center border border-gray-200 rounded-full overflow-hidden shrink-0">' +
          '<button class="qty-btn w-8 h-8 border-r border-gray-200 text-gray-600" onclick="changeQty(' + p.id + ', -1)">−</button>' +
          '<span class="w-10 text-center text-sm font-semibold text-gray-900">' + item.qty + '</span>' +
          '<button class="qty-btn w-8 h-8 border-l border-gray-200 text-gray-600" onclick="changeQty(' + p.id + ', 1)">+</button></div>' +
          '<button class="text-gray-400 hover:text-rose-500 shrink-0" onclick="removeFromCart(' + p.id + ')" title="删除">' +
          '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div>';
      });
      box.innerHTML = html;
      document.getElementById('cart-total').textContent = '¥' + total;
      document.getElementById('cart-subtotal').textContent = '¥' + total;
      document.getElementById('cart-save').textContent = '-¥' + save;
    }

    // 分类筛选
    function filterByCategory(btn) {
      document.querySelectorAll('.cat-pill').forEach(function (b) {
        b.classList.remove('bg-primary', 'text-white');
        b.classList.add('bg-gray-100', 'text-gray-600');
      });
      btn.classList.remove('bg-gray-100', 'text-gray-600');
      btn.classList.add('bg-primary', 'text-white');
      var cat = btn.textContent.trim();
      showPage('products');
      var cards = document.querySelectorAll('#page-products .product-card');
      var visible = 0;
      cards.forEach(function (card) {
        var match = cat === '全部' || card.getAttribute('data-category') === cat;
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (visible === 0) {
        cards.forEach(function (card) { card.style.display = ''; });
      }
    }

    // 首页卡片入场动画错开
    document.querySelectorAll('.fade-up-item').forEach(function (el, i) {
      el.style.animationDelay = (i * 0.07) + 's';
    });

    // 结算弹窗
    function checkout() {
      if (cart.length === 0) { showToast('购物车还是空的，先去挑选商品吧'); return; }
      var totalQty = cart.reduce(function (s, c) { return s + c.qty; }, 0);
      var total = 0;
      cart.forEach(function (item) {
        var p = products.find(function (x) { return x.id === item.id; });
        if (p) total += p.price * item.qty;
      });
      document.getElementById('checkout-count').textContent = totalQty;
      document.getElementById('checkout-total').textContent = '¥' + total;
      var modal = document.getElementById('checkout-modal');
      modal.classList.remove('hidden'); modal.classList.add('flex');
    }
    function closeCheckout() {
      var modal = document.getElementById('checkout-modal');
      modal.classList.add('hidden'); modal.classList.remove('flex');
    }
    function finishCheckout() {
      closeCheckout();
      cart = [];
      updateCart();
      showToast('下单成功，感谢惠顾！');
      showPage('home');
    }

    // 初始化
    decorateCards();
    updateCart();
  </script>

</body>
</html>`
  },

  {
    id: "saas",
    name: "SaaS 产品展示",
    category: "showcase",
    description: "适合 SaaS 软件产品展示，包含产品截图、功能对比、客户评价等",
    tags: ["SaaS", "软件", "产品", "科技"],
    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '{{primaryColor}}', secondary: '{{secondaryColor}}' },
          animation: { 'fade-in': 'fadeIn 0.6s ease-out', 'float': 'float 3s ease-in-out infinite' },
          keyframes: {
            fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
            float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } }
          }
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .gradient-text { background: linear-gradient(135deg, {{primaryColor}}, {{secondaryColor}}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .dashboard-mockup { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    .feature-grid-item { transition: all 0.3s ease; }
    .feature-grid-item:hover { background: {{primaryColor}}5; transform: translateY(-2px); }
  </style>
</head>
<body class="bg-white">

  <!-- 导航 -->
  <nav class="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">{{brandLogo}}</div>
        <span class="text-lg font-bold">{{brandName}}</span>
      </div>
      <div class="hidden md:flex items-center gap-8 text-sm">
        <a href="#features" class="text-gray-600 hover:text-gray-900">功能</a>
        <a href="#pricing" class="text-gray-600 hover:text-gray-900">定价</a>
        <a href="#testimonials" class="text-gray-600 hover:text-gray-900">客户评价</a>
        <a href="#faq" class="text-gray-600 hover:text-gray-900">常见问题</a>
      </div>
      <div class="flex items-center gap-3">
        <button class="text-sm text-gray-600 hover:text-gray-900 font-medium">登录</button>
        <button class="text-sm bg-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90">开始免费试用</button>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <section class="pt-32 pb-16 px-6 relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"></div>
    <div class="max-w-6xl mx-auto text-center relative z-10 animate-fade-in">
      <div class="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
        🚀 {{badgeText}}
      </div>
      <h1 class="text-4xl md:text-6xl font-bold leading-tight mb-6">
        {{heroTitle}}
      </h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-10">{{heroSubtitle}}</p>
      <div class="flex items-center justify-center gap-4 mb-16">
        <button class="bg-primary text-white px-8 py-3.5 rounded-xl font-semibold hover:opacity-90 shadow-lg shadow-primary/25">免费开始使用</button>
        <button class="border border-gray-200 px-8 py-3.5 rounded-xl font-medium hover:bg-gray-50">预约演示</button>
      </div>
      <!-- 产品截图 -->
      <div class="dashboard-mockup rounded-2xl overflow-hidden border border-gray-200 bg-gray-900 animate-float">
        <div class="bg-gray-800 px-4 py-3 flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-red-400"></div>
          <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
          <div class="w-3 h-3 rounded-full bg-green-400"></div>
          <div class="flex-1 mx-4"><div class="bg-gray-700 rounded h-5 w-64 mx-auto"></div></div>
        </div>
        <div class="p-6 bg-gradient-to-br from-gray-900 to-gray-800 min-h-[300px] flex items-center justify-center">
          <div class="text-center">
            <div class="text-gray-500 text-sm mb-2">产品界面预览</div>
            <div class="text-6xl mb-4">{{productEmoji}}</div>
            <div class="text-gray-400 text-lg">{{productName}}</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 数据统计 -->
  <section class="py-12 px-6 border-y border-gray-100">
    <div class="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      {{#stats}}
      <div>
        <div class="text-3xl font-bold gradient-text mb-1">{{statValue}}</div>
        <div class="text-sm text-gray-500">{{statLabel}}</div>
      </div>
      {{/stats}}
    </div>
  </section>

  <!-- 功能网格 -->
  <section id="features" class="py-20 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">强大功能，一站搞定</h2>
        <p class="text-gray-600 text-lg">{{featuresSubtitle}}</p>
      </div>
      <div class="grid md:grid-cols-3 gap-6">
        {{#features}}
        <div class="feature-grid-item rounded-2xl p-6 border border-gray-100 bg-gray-50/50">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-lg">{{featureIcon}}</div>
          <h3 class="font-bold mb-2">{{featureTitle}}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{{featureDesc}}</p>
        </div>
        {{/features}}
      </div>
    </div>
  </section>

  <!-- 客户评价 -->
  <section id="testimonials" class="py-20 px-6 bg-gray-50">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">深受用户喜爱</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-6">
        {{#testimonials}}
        <div class="bg-white rounded-2xl p-6 border border-gray-100">
          <div class="flex items-center gap-1 mb-4">
            {{#stars}}<span class="text-yellow-400">★</span>{{/stars}}
          </div>
          <p class="text-gray-700 text-sm leading-relaxed mb-4">{{reviewText}}</p>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">{{reviewerInitial}}</div>
            <div>
              <div class="text-sm font-medium">{{reviewerName}}</div>
              <div class="text-xs text-gray-500">{{reviewerTitle}}</div>
            </div>
          </div>
        </div>
        {{/testimonials}}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="py-20 px-6">
    <div class="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary to-secondary rounded-3xl p-12 md:p-16">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">{{ctaTitle}}</h2>
      <p class="text-white/80 text-lg mb-8">{{ctaSubtitle}}</p>
      <button class="bg-white text-primary px-8 py-3.5 rounded-xl font-semibold hover:bg-white/90">立即开始</button>
    </div>
  </section>

  <!-- 页脚 -->
  <footer class="bg-gray-900 text-gray-400 py-12 px-6">
    <div class="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
      <div>
        <div class="flex items-center gap-2 mb-4"><div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">{{brandLogo}}</div><span class="text-white font-bold">{{brandName}}</span></div>
        <p class="text-sm">{{brandDesc}}</p>
      </div>
      <div><h4 class="text-white font-medium mb-4">产品</h4><ul class="space-y-2 text-sm"><li><a href="#" class="hover:text-white">功能</a></li><li><a href="#" class="hover:text-white">定价</a></li><li><a href="#" class="hover:text-white">更新</a></li></ul></div>
      <div><h4 class="text-white font-medium mb-4">公司</h4><ul class="space-y-2 text-sm"><li><a href="#" class="hover:text-white">关于</a></li><li><a href="#" class="hover:text-white">博客</a></li><li><a href="#" class="hover:text-white">招聘</a></li></ul></div>
      <div><h4 class="text-white font-medium mb-4">支持</h4><ul class="space-y-2 text-sm"><li><a href="#" class="hover:text-white">帮助中心</a></li><li><a href="#" class="hover:text-white">文档</a></li><li><a href="#" class="hover:text-white">联系</a></li></ul></div>
    </div>
    <div class="max-w-7xl mx-auto mt-10 pt-8 border-t border-gray-800 text-sm text-center">© 2024 {{brandName}}</div>
  </footer>

</body>
</html>`
  },
  {
    id: "dashboard",
    name: "数据仪表盘",
    category: "dashboard",
    description: "适合数据可视化和管理后台，包含统计卡片、图表、数据表格等",
    tags: ["仪表盘", "数据", "后台", "管理"],
    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '{{primaryColor}}', secondary: '{{secondaryColor}}' }
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
    .stat-card { background: #1e293b; border: 1px solid #334155; }
    .stat-card:hover { border-color: {{primaryColor}}40; }
    .chart-bar { transition: height 0.5s ease; }
    .sidebar-item { transition: all 0.2s ease; }
    .sidebar-item:hover, .sidebar-item.active { background: {{primaryColor}}20; color: {{primaryColor}}; }
  </style>
</head>
<body class="flex min-h-screen">

  <!-- 侧边栏 -->
  <aside class="w-64 bg-[#1e293b] border-r border-[#334155] p-4 hidden md:block">
    <div class="flex items-center gap-2 mb-8 px-2">
      <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">{{brandLogo}}</div>
      <span class="text-white font-bold">{{brandName}}</span>
    </div>
    <nav class="space-y-1">
      {{#navItems}}
      <a href="#" class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm {{navActive}}">
        <span>{{navIcon}}</span>
        <span>{{navLabel}}</span>
      </a>
      {{/navItems}}
    </nav>
  </aside>

  <!-- 主内容 -->
  <main class="flex-1 p-6">
    <!-- 顶部栏 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-white">{{pageTitle}}</h1>
        <p class="text-gray-400 text-sm mt-1">{{pageSubtitle}}</p>
      </div>
      <div class="flex items-center gap-3">
        <button class="px-4 py-2 rounded-lg border border-[#334155] text-sm text-gray-300 hover:bg-[#334155]">导出</button>
        <button class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">+ 新建</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {{#stats}}
      <div class="stat-card rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm text-gray-400">{{statLabel}}</span>
          <span class="{{statTrend}} text-xs font-medium px-2 py-0.5 rounded-full">{{statChange}}</span>
        </div>
        <div class="text-2xl font-bold text-white">{{statValue}}</div>
      </div>
      {{/stats}}
    </div>

    <!-- 图表区域 -->
    <div class="grid lg:grid-cols-2 gap-6 mb-8">
      <div class="stat-card rounded-xl p-6">
        <h3 class="text-white font-medium mb-6">{{chart1Title}}</h3>
        <div class="flex items-end gap-2 h-48">
          {{#chart1Bars}}
          <div class="flex-1 h-full flex flex-col items-center justify-end gap-1">
            <div class="chart-bar w-full rounded-t bg-primary/60" style="height: {{barHeight}}%"></div>
            <span class="text-xs text-gray-500">{{barLabel}}</span>
          </div>
          {{/chart1Bars}}
        </div>
      </div>
      <div class="stat-card rounded-xl p-6">
        <h3 class="text-white font-medium mb-6">{{chart2Title}}</h3>
        <div class="space-y-4">
          {{#chart2Items}}
          <div>
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="text-gray-300">{{itemLabel}}</span>
              <span class="text-gray-400">{{itemValue}}</span>
            </div>
            <div class="w-full h-2 bg-[#334155] rounded-full">
              <div class="h-full rounded-full bg-primary" style="width: {{itemPercent}}%"></div>
            </div>
          </div>
          {{/chart2Items}}
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="stat-card rounded-xl overflow-hidden">
      <div class="p-6 border-b border-[#334155]">
        <h3 class="text-white font-medium">{{tableTitle}}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-[#334155]">
              {{#tableHeaders}}<th class="text-left text-xs text-gray-400 font-medium px-6 py-3">{{.}}</th>{{/tableHeaders}}
            </tr>
          </thead>
          <tbody>
            {{#tableRows}}
            <tr class="border-b border-[#334155]/50 hover:bg-[#334155]/30">
              {{#rowCells}}<td class="px-6 py-4 text-sm text-gray-300">{{.}}</td>{{/rowCells}}
            </tr>
            {{/tableRows}}
          </tbody>
        </table>
      </div>
    </div>
  </main>

</body>
</html>`
  },
  {
    id: "blog",
    name: "博客/内容社区",
    category: "community",
    description: "适合博客、内容社区、知识库等，包含文章列表、分类、阅读页等",
    tags: ["博客", "内容", "文章", "社区"],
    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '{{primaryColor}}', secondary: '{{secondaryColor}}' }
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; }
    .article-card { transition: all 0.3s ease; }
    .article-card:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .article-card:hover .article-img { transform: scale(1.03); }
    .article-img { transition: transform 0.3s ease; }
    .tag { transition: all 0.2s ease; }
    .tag:hover { background: {{primaryColor}}; color: white; }
  </style>
</head>
<body>

  <!-- 导航 -->
  <nav class="bg-white border-b border-gray-100 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.5 2.5 0 113.536 3.536L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </div>
        <span class="text-lg font-bold">{{brandName}}</span>
      </div>
      <div class="hidden md:flex items-center gap-6 text-sm">
        <a href="#" class="font-medium text-gray-900">首页</a>
        <a href="#" class="text-gray-600 hover:text-gray-900">文章</a>
        <a href="#" class="text-gray-600 hover:text-gray-900">分类</a>
        <a href="#" class="text-gray-600 hover:text-gray-900">关于</a>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <input type="text" placeholder="搜索文章..." class="w-48 pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50">
          <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <button class="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">写文章</button>
      </div>
    </div>
  </nav>

  <!-- 精选文章 -->
  <section class="py-10 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
        <div class="md:w-1/2 h-64 md:h-auto bg-gray-100 overflow-hidden">
          <div class="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <span class="text-6xl">{{featuredEmoji}}</span>
          </div>
        </div>
        <div class="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <span class="text-xs text-primary font-medium uppercase tracking-wider mb-3">{{featuredTag}}</span>
          <h1 class="text-2xl md:text-3xl font-bold mb-4">{{featuredTitle}}</h1>
          <p class="text-gray-600 leading-relaxed mb-6">{{featuredDesc}}</p>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">{{featuredAuthorInitial}}</div>
            <div>
              <span class="text-sm font-medium">{{featuredAuthor}}</span>
              <span class="text-xs text-gray-500 ml-2">{{featuredDate}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 文章列表 -->
  <section class="py-8 px-6 pb-20">
    <div class="max-w-7xl mx-auto">
      <h2 class="text-2xl font-bold mb-8">{{sectionTitle}}</h2>
      <div class="grid md:grid-cols-3 gap-6">
        {{#articles}}
        <article class="article-card bg-white rounded-xl overflow-hidden border border-gray-100">
          <div class="h-48 bg-gray-100 overflow-hidden">
            <div class="article-img w-full h-full bg-gradient-to-br from-{{articleColor}}/10 to-{{articleColor}}/5 flex items-center justify-center">
              <span class="text-4xl">{{articleEmoji}}</span>
            </div>
          </div>
          <div class="p-5">
            <div class="flex items-center gap-2 mb-2">
              <span class="tag text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 cursor-pointer">{{articleTag}}</span>
              <span class="text-xs text-gray-400">{{articleDate}}</span>
            </div>
            <h3 class="font-bold mb-2 line-clamp-2">{{articleTitle}}</h3>
            <p class="text-sm text-gray-600 line-clamp-3 mb-4">{{articleDesc}}</p>
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">{{articleAuthorInitial}}</div>
              <span class="text-xs text-gray-500">{{articleAuthor}}</span>
              <span class="text-xs text-gray-400 ml-auto">{{articleReadTime}} 分钟</span>
            </div>
          </div>
        </article>
        {{/articles}}
      </div>
    </div>
  </section>

  <!-- 页脚 -->
  <footer class="bg-gray-900 text-gray-400 py-10 px-6">
    <div class="max-w-7xl mx-auto text-center text-sm">
      <p class="text-white font-bold text-lg mb-2">{{brandName}}</p>
      <p>{{brandDesc}}</p>
      <div class="mt-4 pt-4 border-t border-gray-800">© 2024 {{brandName}}</div>
    </div>
  </footer>

</body>
</html>`
  },
];

// ==================== 模板工具函数 ====================

/**
 * 根据分类获取匹配的模板
 */
export function getTemplateByCategory(category: string): Template | null {
  return TEMPLATES.find(t => t.category === category) || TEMPLATES[0];
}

/**
 * 获取所有模板的分类列表
 */
export function getTemplateCategories(): { key: string; name: string; count: number }[] {
  const map = new Map<string, Template[]>();
  TEMPLATES.forEach(t => {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category)!.push(t);
  });
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    name: items[0].name,
    count: items.length,
  }));
}

/**
 * 简单的模板变量替换
 * 支持 {{variable}} 和 {{#array}}...{{/array}} 循环（含嵌套循环，如 tableRows 里的 rowCells）
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  const result = renderBlock(template, data);
  // 兜底：清掉仍未填充的占位符（如内容方案漏给的字段），避免页面显示原始 {{xxx}}
  return result.replace(/\{\{[#/]?[\w.]+\}\}/g, "");
}

function renderBlock(template: string, data: Record<string, any>): string {
  let result = template;

  // 先处理循环 {{#key}}...{{/key}}（循环内的同名字段优先于全局字段，
  // 避免全局默认值把循环里的 {{productName}} 等字段覆盖掉）
  const loopPattern = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(loopPattern, (_match, key, content) => {
    const arr = data[key];
    if (!Array.isArray(arr)) return "";
    return arr.map((item: any) => {
      if (typeof item === "object" && item !== null) {
        // 递归展开，支持嵌套循环（如 tableRows 内嵌 rowCells）
        return renderBlock(content, { ...data, ...item });
      }
      return content.replace(/\{\{\.\}\}/g, String(item));
    }).join("");
  });

  // 再处理简单变量替换 {{key}}（此时循环已展开，不会误伤循环内字段）
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" || typeof value === "number") {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }
  }

  return result;
}

/**
 * 生成默认数据（用于预览/测试）
 */
export function getDefaultTemplateData(category: string): Record<string, any> {
  const defaults: Record<string, any> = {
    title: "我的应用",
    brandName: "MyApp",
    brandLogo: "M",
    brandDesc: "一个优秀的产品",
    primaryColor: "#6366f1",
    secondaryColor: "#8b5cf6",
    badgeText: "全新发布",
    heroTitle: "让工作更高效",
    heroSubtitle: "用 AI 驱动的工具，帮助你的团队提升生产力",
    ctaTitle: "准备好开始了吗？",
    ctaSubtitle: "立即注册，享受 14 天免费试用",
    ctaText: "立即开始",
    sectionTitle: "精选内容",
    features: [
      { featureIcon: "⚡", featureTitle: "快速高效", featureDesc: "毫秒级响应，让你的工作流畅无阻", featureColor: "yellow" },
      { featureIcon: "🔒", featureTitle: "安全可靠", featureDesc: "企业级安全标准，数据加密保护", featureColor: "green" },
      { featureIcon: "🎨", featureTitle: "精美设计", featureDesc: "现代化 UI 设计，带来愉悦的使用体验", featureColor: "purple" },
    ],
    plans: [
      { planName: "基础版", planDesc: "适合个人使用", planPrice: "免费", planUnit: "月", planFeatures: ["5个项目", "1GB 存储", "社区支持"], planBtnText: "开始使用", planBtnStyle: "border border-gray-200 text-gray-700 hover:bg-gray-50", planHighlight: "border-gray-100" },
      { planName: "专业版", planDesc: "适合小团队", planPrice: "¥99", planUnit: "月", planFeatures: ["无限项目", "10GB 存储", "优先支持", "高级功能"], planBtnText: "开始试用", planBtnStyle: "bg-primary text-white hover:opacity-90", planHighlight: "border-primary shadow-lg" },
      { planName: "企业版", planDesc: "适合大型组织", planPrice: "¥299", planUnit: "月", planFeatures: ["所有功能", "无限存储", "专属客服", "API 访问", "SLA 保障"], planBtnText: "联系我们", planBtnStyle: "border border-gray-200 text-gray-700 hover:bg-gray-50", planHighlight: "border-gray-100" },
    ],
    stats: [
      { statValue: "10K+", statLabel: "活跃用户", statChange: "+12.5%", statTrend: "text-green-400" },
      { statValue: "99.9%", statLabel: "服务可用率", statChange: "+0.1%", statTrend: "text-green-400" },
      { statValue: "50+", statLabel: "集成服务", statChange: "+8%", statTrend: "text-green-400" },
      { statValue: "24/7", statLabel: "技术支持", statChange: "", statTrend: "" },
    ],
    testimonials: [
      { reviewText: "这个产品彻底改变了我们的工作方式，效率提升了 3 倍！", reviewerName: "张明", reviewerTitle: "产品经理", reviewerInitial: "张", stars: [1, 2, 3, 4, 5] },
      { reviewText: "界面简洁美观，功能强大，是我用过最好的工具之一。", reviewerName: "李华", reviewerTitle: "设计师", reviewerInitial: "李", stars: [1, 2, 3, 4, 5] },
      { reviewText: "客服响应很快，问题都能及时解决，非常满意。", reviewerName: "王芳", reviewerTitle: "运营总监", reviewerInitial: "王", stars: [1, 2, 3, 4, 5] },
    ],
    navItems: [
      { navIcon: "", navLabel: "概览", navActive: "active" },
      { navIcon: "📈", navLabel: "分析", navActive: "" },
      { navIcon: "👥", navLabel: "用户", navActive: "" },
      { navIcon: "⚙️", navLabel: "设置", navActive: "" },
    ],
    articles: [
      { articleTitle: "如何提升团队效率", articleDesc: "分享几个实用的方法和工具...", articleTag: "效率", articleDate: "2024-01-15", articleAuthor: "张明", articleAuthorInitial: "张", articleEmoji: "", articleColor: "indigo", articleReadTime: "5" },
      { articleTitle: "产品设计的最佳实践", articleDesc: "从用户研究到原型设计的完整流程...", articleTag: "设计", articleDate: "2024-01-12", articleAuthor: "李华", articleAuthorInitial: "李", articleEmoji: "🎨", articleColor: "purple", articleReadTime: "8" },
      { articleTitle: "技术选型指南", articleDesc: "2024 年最值得关注的技术趋势...", articleTag: "技术", articleDate: "2024-01-10", articleAuthor: "王芳", articleAuthorInitial: "王", articleEmoji: "", articleColor: "blue", articleReadTime: "6" },
    ],
    products: [
      { productId: 1, productName: "无线蓝牙耳机", productPrice: 299, originalPrice: 399, productCategory: "电子产品", productImage: placeholderImg("🎧", "#6366f1", "#a855f7") },
      { productId: 2, productName: "极简手表", productPrice: 599, originalPrice: 799, productCategory: "配饰", productImage: placeholderImg("⌚", "#f59e0b", "#ef4444") },
      { productId: 3, productName: "帆布背包", productPrice: 199, originalPrice: 299, productCategory: "箱包", productImage: placeholderImg("🎒", "#10b981", "#06b6d4") },
      { productId: 4, productName: "运动跑鞋", productPrice: 459, originalPrice: 599, productCategory: "运动鞋", productImage: placeholderImg("", "#ec4899", "#f43f5e") },
    ],
    categories: [
      { catName: "全部", catActive: "bg-primary text-white" },
      { catName: "电子产品", catActive: "bg-gray-100 text-gray-600" },
      { catName: "配饰", catActive: "bg-gray-100 text-gray-600" },
      { catName: "箱包", catActive: "bg-gray-100 text-gray-600" },
    ],
    chart1Bars: [
      { barLabel: "1月", barHeight: "40" },
      { barLabel: "2月", barHeight: "65" },
      { barLabel: "3月", barHeight: "45" },
      { barLabel: "4月", barHeight: "80" },
      { barLabel: "5月", barHeight: "55" },
      { barLabel: "6月", barHeight: "90" },
    ],
    chart2Items: [
      { itemLabel: "直接访问", itemValue: "35%", itemPercent: "35" },
      { itemLabel: "搜索引擎", itemValue: "28%", itemPercent: "28" },
      { itemLabel: "社交媒体", itemValue: "22%", itemPercent: "22" },
      { itemLabel: "邮件营销", itemValue: "15%", itemPercent: "15" },
    ],
    tableHeaders: ["名称", "状态", "数量", "金额", "日期"],
    tableRows: [
      { rowCells: ["产品 A", "✅ 已完成", "128", "¥12,800", "2024-01-15"] },
      { rowCells: ["产品 B", "⏳ 进行中", "64", "¥6,400", "2024-01-14"] },
      { rowCells: ["产品 C", "✅ 已完成", "256", "¥25,600", "2024-01-13"] },
    ],
    featuredTag: "精选文章",
    featuredTitle: "2024 年最重要的技术趋势",
    featuredDesc: "深入了解即将改变行业的几项关键技术，以及它们将如何影响你的业务和工作方式。",
    featuredAuthor: "张明",
    featuredAuthorInitial: "张",
    featuredDate: "2024-01-15",
    featuredEmoji: "",
    productEmoji: "📱",
    productName: "产品预览",
  };

  return { ...defaults };
}
