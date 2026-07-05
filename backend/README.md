# 返乡（Return Home）— 后端服务

人生倒计时应用的后端 API 服务，使用 Node.js + Express + better-sqlite3 构建。

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express 4.x
- **数据库**: SQLite (better-sqlite3) — WAL 模式
- **日志**: morgan
- **ID 生成**: nanoid

## 目录结构

```
backend/
├── server.js          # 入口文件
├── package.json
├── README.md
├── db/
│   └── database.js    # 数据库初始化与连接
├── controllers/
│   ├── userController.js   # 用户相关业务逻辑
│   └── entryController.js  # 记录相关业务逻辑
├── routes/
│   ├── users.js       # 用户路由
│   └── entries.js     # 记录路由
├── middleware/
│   └── errorHandler.js     # 统一错误处理
└── data/              # SQLite 数据文件（自动创建）
    └── return-home.db
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 启动服务

```bash
# 生产模式
npm start

# 开发模式（文件变更自动重启）
npm run dev
```

服务默认运行在 `http://localhost:3000`。

### 3. 配置

通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `DB_PATH` | `./data/return-home.db` | 数据库文件路径 |

## API 文档

### 健康检查

```
GET /api/health
```

### 用户管理

#### 创建用户

```
POST /api/users
Content-Type: application/json

{
  "birthDate": "1990-01-15",    // 必填，YYYY-MM-DD
  "name": "张三",               // 可选
  "lifeExpectancy": 80          // 可选，默认80
}
```

#### 获取用户信息

```
GET /api/users/:id
```

#### 更新用户信息

```
PUT /api/users/:id
Content-Type: application/json

{
  "name": "新名字",    // 可选
  "birthDate": "1990-06-15",  // 可选
  "lifeExpectancy": 85        // 可选
}
```

#### 获取人生统计

```
GET /api/users/:id/stats
```

响应示例：
```json
{
  "remainingDays": 19519,
  "passedDays": 9701,
  "totalDays": 29220,
  "progressPercent": 33.2,
  "deathDate": "2070-01-15",
  "age": 36
}
```

### 记录管理

#### 获取记录列表

```
GET /api/entries?userId=<id>&date=2026-07-04
GET /api/entries?userId=<id>&page=1&limit=20
```

#### 获取月度日历摘要

```
GET /api/entries/:userId/calendar?year=2026&month=7
```

#### 新增记录

```
POST /api/entries
Content-Type: application/json

{
  "userId": "xxx",
  "date": "2026-07-04",    // 可选，默认为当天
  "content": "去公园散步，天气很好",
  "satisfaction": 4,       // 可选，1-5星，默认为3
  "category": "生活"       // 可选
}
```

#### 修改记录

```
PUT /api/entries/:id
Content-Type: application/json

{
  "content": "修改后的内容",
  "satisfaction": 5
}
```

#### 删除记录

```
DELETE /api/entries/:id
```

## 数据库

- 数据库文件自动创建在 `data/` 目录下
- 使用 WAL 模式，支持更高的并发读写
- 启动时自动建表，无需手动初始化

### 表结构

#### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | nanoid 生成 |
| name | TEXT | 用户名，可选 |
| birth_date | TEXT NOT NULL | 出生日期 YYYY-MM-DD |
| life_expectancy | INTEGER DEFAULT 80 | 预期寿命 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### entries 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | nanoid 生成 |
| user_id | TEXT FK | 关联 users.id |
| date | TEXT NOT NULL | 记录日期 YYYY-MM-DD |
| content | TEXT NOT NULL | 记录内容，最多500字 |
| satisfaction | INTEGER | 1-5 星评分 |
| category | TEXT | 分类标签，可选 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
