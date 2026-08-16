# LX_Music_Pro 开发日志

> 这是 AI 协作开发交接文档，方便不同 Agent 接力开发。
> **每次开发改动都必须在此文档中记录，交接时请阅读此文档才能无缝接续。**

---

## 📌 项目信息

| 项目 | 信息 |
|------|------|
| 仓库 | AsrnkHoper/lx-lxwalnut-music-mobile |
| 基础 | 基于 lx-netease-music-mobile 改版，React Native 开发 |
| 编译方式 | GitHub CI（Build=Release + Debug Build） |
| 手机路径 | /sdcard/Download/LX_Music_Pro/ |
| 版本 | 26.07.23 |

## 🔧 当前分支/状态

- **分支**：main
- **最后同步**：2026-08-15（zip 下载，无 .git 历史）

---

## 🏗️ 项目架构速览

### 技术栈

- React Native 0.73.11 + TypeScript 5.7
- 导航：react-native-navigation 7.39.2
- 状态：自建 store 模式（state/action/hook 分离）
- 存储：AsyncStorage（@key 前缀 + 版本迁移）
- 皮肤：内置主题系统 + 动态背景
- 构建：GitHub Actions CI 自动编译 APK

### 核心目录结构

```
src/
├── app.ts               # 入口，初始化流程
├── components/          # 通用组件
├── config/              # 配置
├── core/                # 核心逻辑
│   ├── player/          # 播放核心
│   ├── stats/           # 听歌统计 + AI 报告
│   ├── init/            # 初始化流程
│   ├── music/           # 音乐获取
│   ├── download.ts      # 下载
│   └── ...
├── screens/             # 页面
│   ├── Home/Views/      # 侧栏页面
│   │   ├── Stats/       # 听歌统计（含 AI 报告）
│   │   └── Setting/     # 设置
│   └── ...
├── store/               # 状态管理
├── types/               # 类型定义
└── utils/musicSdk/      # 音乐源 SDK
```

### 音乐源

酷我(kw)、酷狗(kg)、QQ音乐(tx)、网易云(wy)、咪咕(mg)、Gitcode(git)

---

## 🔑 GitHub Token 信息

| 项目 | 信息 |
|------|------|
| Token 位置 | /sdcard/Download/GITHUB_TOKEN.txt |
| 用途 | GitHub API / git push 接力开发 |
| 记录时间 | 2026-08-15 |

> ⚠️ 重要：后续 Agent 接手时，请从本地文件 /sdcard/Download/GITHUB_TOKEN.txt 读取 Token。
> 不要把 Token 写入仓库任何文件！GitHub secret scanning 会拒绝包含 Token 的提交。

---

## 🕐 开发记录

### 2026-08-15 - 项目初始化 + 源码通读

**操作**：
- GitHub zip 方式下载 main 分支代码，解压到 /sdcard/Download/LX_Music_Pro/
- 详细阅读源码 756 个文件
- 创建本交接文档 DEV_LOG.md

**遇到的问题**：
- 手机直连 GitHub clone 超时
- /sdcard FUSE 挂载不支持 git pack 写入
- 解决：改用 zip 下载 + tar 解压

---

### 2026-08-15 - 修复 AI 生成报告超时/失败问题

**问题**：点击试生成后等待 120s+，报错 AI 生成失败,请稍后重试

**根因分析**：
1. Prompt schema 中缺少 overview/time/taste 必填字段，模型输出缺失导致校验失败
2. 重试逻辑 Bug：原代码始终用第一次请求的 raw 解析，重试结果未使用
3. 错误信息被吞掉，用户看不到具体原因
4. 超时 240s 过长，加上错误重试让人等更久

**修复内容**（修改 src/core/stats/report.ts）：
1. 补全 prompt schema 示例，加入 overview/time/taste 必填字段和 number 类型说明
2. 重写重试逻辑：每次重试都用新返回结果重新校验
3. 错误透出：失败时返回具体缺失字段
4. timeoutMs 240000 → 120000

**提交状态**：report.ts 的 blob 已创建，但 DEV_LOG.md 因包含 Token 被 secret scanning 拒绝

**下一步**：重新提交（DEV_LOG.md 已修复不含 Token）

---

### 2026-08-15 - 修复报告档案馆覆盖问题

**问题**：生成多份报告后，档案馆只保留最新一份，之前的被覆盖

**根因**：addReportToArchive 中有"同周期覆盖"逻辑（filter 掉同周期旧报告），同一周内多次生成会互相覆盖

**修复内容**：
1. report.ts：ArchiveItem 接口加 id 字段；addReportToArchive 改为每次生成都保留（通过唯一 id 去重而非覆盖），最多 30 份
2. ReportView.tsx：档案馆列表 key 改用 item.id；展示生成日期和时间，便于区分同周期多份报告

**提交状态**：待提交
---

### 2026-08-16 - 修复热力图色阶不重算 + 统计页不实时刷新

**问题**：
1. 删除热力图某天数据后，色阶基准（maxMonthDuration）不重算，若删掉当月最长日，其余格子颜色整体偏浅
2. 停留在统计页时，新的播放结算/删除不会自动刷新概览与排行

**根因**：
1. `MonthHeatMap.tsx` 删除后只更新 `heatMap`，未重算 `maxMonthDuration`
2. 统计模块写库后没有触发 UI 刷新事件，统计页只监听 `playHistoryUpdated`

**修复内容**：
1. `src/screens/Home/Views/Stats/MonthHeatMap.tsx`：删除成功后基于新 `heatMap` 重算 `maxMonthDuration`
2. `src/event/appEvent.ts`：新增 `statsUpdated` 事件
3. `src/core/player/stats.ts`：`addStatsRecord` / `deleteStatsDay` / `clearStats` / `backfillStatsFromHistory` 写库后触发 `statsUpdated`
4. `src/screens/Home/Views/Stats/index.tsx`：监听 `statsUpdated`，自动刷新概览与排行

**验证**：`npx tsc --noEmit` 基线 252 条存量错误，修复后 252 条，零新增错误

---

### 2026-08-16 - 热力图自动刷新 + 年翻页按钮

**问题**：
1. 统计页热力图在播放结算后不自动刷新，需要手动切月刷新
2. 月度热力图只有月翻页按钮，需要加年翻页按钮

**修复内容**：
1. `src/screens/Home/Views/Stats/MonthHeatMap.tsx`：新增 `refreshKey` state，监听 `statsUpdated` 事件后自增，触发当月热力图与选中日账本重载；月份切换新增年翻页按钮 `<<` `>>`（`changeMonthBy(-12)` / `changeMonthBy(12)`，图标 `chevron-left-2` / `chevron-right-2`，下一年超过当前月时禁用）

**验证**：`npx tsc --noEmit` 基线 252 条存量错误，修复后 252 条，零新增错误

---

### 2026-08-16 - 本周报告展示优化

**优化内容**：
1. 动态卡中文化：StoryFlow 内置 19 项卡型元数据（中文名 + emoji + 配色 + 一句解读），`deep_night` 显示为「🌙 深夜高墙」，`surprise` 显示为「✨ 惊喜卡」；代码标识符不变
2. 点卡详情：封面卡/动态卡/海报卡均生成 `letter`，点按卡面上滑查看详情（AI 文案 + 数据依据 + 周期）
3. 海报卡：新增「保存到相册」（`react-native-view-shot` 截图 + `saveLocalImageToPictures` 写入 Pictures/LX-N-Music）和「重新生成文案」（确认弹窗 + 回调 ReportView 重新生成）
4. 新增依赖：`react-native-view-shot@4.0.0`

**验证**：`npx tsc --noEmit` 基线 252 条存量错误，修复后 252 条，零新增错误
