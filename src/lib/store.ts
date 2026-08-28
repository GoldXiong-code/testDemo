// 本地存储管理 - 模拟后端数据
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

const USERS_KEY = "atoms_demo_users";
const CURRENT_USER_KEY = "atoms_demo_current_user";
const CLIENT_ID_KEY = "atoms_demo_client_id";

export function getUsers(): User[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function registerUser(email: string, password: string, name: string): { success: boolean; message: string; user?: User } {
  const users = getUsers();
  const exists = users.find((u) => u.email === email);
  if (exists) {
    return { success: false, message: "该邮箱已被注册" };
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    email,
    name,
    createdAt: new Date().toISOString(),
  };

  // 存储密码（实际项目应加密）
  const passwordsKey = "atoms_demo_passwords";
  const passwords: Record<string, string> = JSON.parse(
    localStorage.getItem(passwordsKey) || "{}"
  );
  passwords[email] = password;
  localStorage.setItem(passwordsKey, JSON.stringify(passwords));

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  return { success: true, message: "注册成功", user: newUser };
}

export function loginUser(email: string, password: string): { success: boolean; message: string; user?: User } {
  const users = getUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    return { success: false, message: "用户不存在" };
  }

  const passwordsKey = "atoms_demo_passwords";
  const passwords: Record<string, string> = JSON.parse(
    localStorage.getItem(passwordsKey) || "{}"
  );

  if (passwords[email] !== password) {
    return { success: false, message: "密码错误" };
  }

  setCurrentUser(user);
  return { success: true, message: "登录成功", user };
}

export function logoutUser() {
  setCurrentUser(null);
}

// 浏览器设备 ID：未登录用户找回历史项目用（持久化在 localStorage，首次访问生成）
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

// AI 生成模拟
export async function generateContent(
  prompt: string,
  _model: string
): Promise<string> {
  // 模拟 AI 生成延迟
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const responses: Record<string, string> = {
    product: `## 产品方案：${prompt}

### 目标用户
针对${prompt}的需求，我们建议面向以下用户群体：
- 初创企业和独立创业者
- 希望快速验证产品想法的团队
- 非技术背景的创意人士

### 核心价值主张
1. **快速验证**：在几分钟内将想法转化为可展示的原型
2. **零代码**：无需编程技能即可完成产品构建
3. **AI 驱动**：利用人工智能自动化大部分重复性工作

### 功能规划
- **第一阶段**：核心功能 MVP（最小可行产品）
- **第二阶段**：用户反馈收集与迭代
- **第三阶段**：商业化与规模化

### 定价策略
- 免费版：基础功能体验
- 专业版：$29/月，完整功能
- 企业版：$99/月，团队协作

### 下一步行动
1. 确定技术栈和架构
2. 设计用户界面原型
3. 开发核心功能
4. 内部测试与优化
5. 公测与用户反馈

需要我针对某个具体方面深入分析吗？`,

    business: `## 商业分析：${prompt}

### 市场机会
根据当前市场趋势，${prompt}领域存在以下机会：

1. **市场规模**：预计 2026 年达到 $500 亿
2. **增长速率**：年复合增长率 25%+
3. **竞争格局**：头部玩家占据 40% 份额，长尾市场仍有空间

### 竞争分析
| 竞品 | 优势 | 劣势 |
|------|------|------|
| 竞品 A | 品牌知名度高 | 价格昂贵 |
| 竞品 B | 功能全面 | 学习成本高 |
| 竞品 C | 开源免费 | 缺乏支持 |

### SWOT 分析
- **优势 (S)**：AI 驱动、低成本、快速迭代
- **劣势 (W)**：新品牌、用户基础小
- **机会 (O)**：市场增长快、用户需求旺盛
- **威胁 (T)**：大厂可能进入该领域

### 商业模式建议
推荐采用 **SaaS 订阅制**：
- 降低用户初始投入
- 提供持续收入流
- 便于产品迭代升级

### 关键指标 (KPIs)
- 月活跃用户 (MAU)
- 用户留存率 (Retention Rate)
- 客户获取成本 (CAC)
- 生命周期价值 (LTV)

需要进一步分析哪个方面？`,

    default: `## AI 生成结果

根据你的输入：**"${prompt}"**

以下是我为你生成的内容：

### 分析摘要
这个想法很有潜力。从当前市场趋势来看，类似的概念正在获得越来越多的关注。

### 关键洞察
1. **可行性评估**：从技术角度来看，这个想法是完全可行的
2. **市场潜力**：存在明确的目标用户群体
3. **竞争优势**：可以通过 AI 能力形成差异化

### 建议步骤
1. **验证阶段**：先做一个最小可行产品 (MVP) 测试市场反应
2. **用户调研**：与 10-20 位潜在用户深入交流
3. **快速迭代**：根据反馈持续改进产品
4. **逐步扩展**：验证成功后再扩大投入

### 所需资源
- 时间：预计 2-4 周完成 MVP
- 资金：初期可用免费工具和服务
- 技能：基本的产品设计思维即可

需要我针对某个方面提供更详细的建议吗？`,
  };

  // 根据关键词匹配响应类型
  const lower = prompt.toLowerCase();
  if (lower.includes("产品") || lower.includes("app") || lower.includes("网站")) {
    return responses.product;
  }
  if (lower.includes("商业") || lower.includes("市场") || lower.includes("赚钱")) {
    return responses.business;
  }
  return responses.default;
}
