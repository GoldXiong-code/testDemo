/**
 * 商品图片种子数据
 * 运行: node scripts/seed-images.js
 *
 * 图片来源: Unsplash (免费商用，无需署名)
 * 格式: https://images.unsplash.com/photo-{id}?w=400&h=400&fit=crop
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

// 商品图片数据（Unsplash 免费图片）
const productImages = [
  // ========== 电子产品 (electronics) ==========
  {
    category: "electronics",
    name: "智能手机",
    url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop",
    tags: ["手机", "phone", "smartphone", "数码"],
  },
  {
    category: "electronics",
    name: "无线耳机",
    url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop",
    tags: ["耳机", "earbuds", "headphones", "数码"],
  },
  {
    category: "electronics",
    name: "笔记本电脑",
    url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop",
    tags: ["电脑", "laptop", "笔记本", "数码"],
  },
  {
    category: "electronics",
    name: "智能手表",
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
    tags: ["手表", "watch", "smartwatch", "数码"],
  },
  {
    category: "electronics",
    name: "数码相机",
    url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop",
    tags: ["相机", "camera", "数码"],
  },
  {
    category: "electronics",
    name: "平板电脑",
    url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop",
    tags: ["平板", "tablet", "ipad", "数码"],
  },
  {
    category: "electronics",
    name: "蓝牙音箱",
    url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop",
    tags: ["音箱", "speaker", "蓝牙", "数码"],
  },
  {
    category: "electronics",
    name: "游戏手柄",
    url: "https://images.unsplash.com/photo-1592840496694-26d09808e36b?w=400&h=400&fit=crop",
    tags: ["游戏", "手柄", "controller", "gaming"],
  },

  // ========== 服装 (clothing) ==========
  {
    category: "clothing",
    name: "白色T恤",
    url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    tags: ["T恤", "tshirt", "上衣", "服装"],
  },
  {
    category: "clothing",
    name: "牛仔裤",
    url: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop",
    tags: ["裤子", "jeans", "牛仔", "服装"],
  },
  {
    category: "clothing",
    name: "运动鞋",
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
    tags: ["鞋子", "shoes", "sneakers", "运动鞋"],
  },
  {
    category: "clothing",
    name: "时尚手提包",
    url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop",
    tags: ["包", "bag", "手提包", "配饰"],
  },
  {
    category: "clothing",
    name: "太阳眼镜",
    url: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop",
    tags: ["眼镜", "sunglasses", "配饰"],
  },
  {
    category: "clothing",
    name: "连衣裙",
    url: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=400&fit=crop",
    tags: ["裙子", "dress", "连衣裙", "女装"],
  },
  {
    category: "clothing",
    name: "夹克外套",
    url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop",
    tags: ["外套", "jacket", "夹克", "服装"],
  },
  {
    category: "clothing",
    name: "棒球帽",
    url: "https://images.unsplash.com/photo-1588850561407-ed78c380e753?w=400&h=400&fit=crop",
    tags: ["帽子", "hat", "cap", "配饰"],
  },

  // ========== 家居 (home) ==========
  {
    category: "home",
    name: "沙发",
    url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop",
    tags: ["沙发", "sofa", "家具", "客厅"],
  },
  {
    category: "home",
    name: "台灯",
    url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop",
    tags: ["灯", "lamp", "台灯", "照明"],
  },
  {
    category: "home",
    name: "花瓶",
    url: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400&h=400&fit=crop",
    tags: ["花瓶", "vase", "装饰", "摆件"],
  },
  {
    category: "home",
    name: "床上用品",
    url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&h=400&fit=crop",
    tags: ["床", "bedding", "卧室", "家居"],
  },
  {
    category: "home",
    name: "餐具套装",
    url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
    tags: ["餐具", "kitchen", "厨房", "碗碟"],
  },
  {
    category: "home",
    name: "装饰画",
    url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&h=400&fit=crop",
    tags: ["画", "art", "装饰画", "墙面"],
  },
  {
    category: "home",
    name: "收纳盒",
    url: "https://images.unsplash.com/photo-1526227516638-a5a775d82a20?w=400&h=400&fit=crop",
    tags: ["收纳", "storage", "整理", "家居"],
  },
  {
    category: "home",
    name: "抱枕",
    url: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400&h=400&fit=crop",
    tags: ["抱枕", "pillow", "靠垫", "家居"],
  },

  // ========== 食品 (food) ==========
  {
    category: "food",
    name: "新鲜水果",
    url: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=400&fit=crop",
    tags: ["水果", "fruit", "新鲜", "食品"],
  },
  {
    category: "food",
    name: "咖啡",
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
    tags: ["咖啡", "coffee", "饮品", "饮料"],
  },
  {
    category: "food",
    name: "蛋糕甜点",
    url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop",
    tags: ["蛋糕", "cake", "甜点", "烘焙"],
  },
  {
    category: "food",
    name: "新鲜蔬菜",
    url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop",
    tags: ["蔬菜", "vegetable", "新鲜", "食品"],
  },
  {
    category: "food",
    name: "巧克力",
    url: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&h=400&fit=crop",
    tags: ["巧克力", "chocolate", "零食", "糖果"],
  },
  {
    category: "food",
    name: "茶叶",
    url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop",
    tags: ["茶", "tea", "茶叶", "饮品"],
  },

  // ========== 运动 (sports) ==========
  {
    category: "sports",
    name: "瑜伽垫",
    url: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop",
    tags: ["瑜伽", "yoga", "健身", "运动"],
  },
  {
    category: "sports",
    name: "哑铃",
    url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop",
    tags: ["哑铃", "dumbbell", "健身", "器材"],
  },
  {
    category: "sports",
    name: "篮球",
    url: "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=400&h=400&fit=crop",
    tags: ["篮球", "basketball", "球类", "运动"],
  },
  {
    category: "sports",
    name: "自行车",
    url: "https://images.unsplash.com/photo-1532298229144-0db0c2c2b1e8?w=400&h=400&fit=crop",
    tags: ["自行车", "bicycle", "bike", "骑行"],
  },
  {
    category: "sports",
    name: "足球",
    url: "https://images.unsplash.com/photo-1614632537190-23e4b2e69a89?w=400&h=400&fit=crop",
    tags: ["足球", "football", "soccer", "球类"],
  },
  {
    category: "sports",
    name: "跑步鞋",
    url: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=400&fit=crop",
    tags: ["跑鞋", "running", "运动鞋", "运动"],
  },
];

// 读取现有数据库
let db = { users: [], productImages: [] };
if (fs.existsSync(DB_PATH)) {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  db = JSON.parse(raw);
}

// 确保 productImages 字段存在
if (!db.productImages) {
  db.productImages = [];
}

// 清空旧数据，写入新数据
db.productImages = productImages.map((img, index) => ({
  id: `img_${Date.now()}_${index}`,
  ...img,
  createdAt: new Date().toISOString(),
}));

// 写入数据库
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log(`✅ 成功写入 ${productImages.length} 张商品图片到数据库`);
console.log("分类统计:");
const stats = {};
productImages.forEach((img) => {
  stats[img.category] = (stats[img.category] || 0) + 1;
});
Object.entries(stats).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count} 张`);
});
