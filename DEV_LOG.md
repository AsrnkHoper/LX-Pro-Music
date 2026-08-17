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
4. 新增依赖：`react-native-view-shot@3.8.0`（4.0.0 首次 CI 编译失败：Java 引用 Fabric UIBlock 不兼容 RN 0.73，已回退 3.8.0）

**验证**：`npx tsc --noEmit` 基线 252 条存量错误，修复后 252 条，零新增错误

---

### 2026-08-16 - 本周报告视觉重做

**反馈**：
1. 海报保存只保存了最后一张卡片（应该保存独立海报）
2. 点卡详情页看不清（面板透明、文字叠在卡片上）
3. 卡片视觉需要优化

**修复**：
1. `StoryFlow.tsx` 新增 `PosterVisual`：独立 3:4 海报版式（音乐色背景 + headline + 三数字 + ai_copy + highlight + 周期签名），`ViewShot` 只捕获海报视觉
2. 详情面板加实底背景（跟随主题）+ ScrollView 可滚动，标题/正文分层
3. 动态卡重做：主色装饰圆 + 彩色标签行（点+文字），AI 标题 24 加粗当主角，正文 15/22，数据依据小字沉底

**验证**：`npx tsc --noEmit` 基线 252 条存量错误，修复后 252 条，零新增错误

---

### 2026-08-16 - 交互补全：详情面板/卡片变体/档案馆管理/账本备份

**详情页看不清**：`AnimatedSlideUpPanel` 增加 `height` prop；StoryFlow 详情面板改 70% 高 + 不透明 `c-content-background` 实底 + 正文 `c-font` 15

**卡片排版固定**：动态卡按 `card_key+周期+序号` 哈希选择 3 种排版变体（标题上/正文上/居中引言），装饰圆位置随变体变化

**档案馆管理**：
1. 新增删除（ConfirmAlert 确认后删除并刷新）
2. 新增导出/导入：`lx_report_archive.lxmc`，导入按 id 去重合并，最多 30 份

**账本数据导入导出**：
1. `core/player/stats.ts` 新增 `exportStatsData` / `importStatsData`
2. 统计页底部新增「账本数据备份」：导出/导入 `lx_stats.lxmc`（daily/song/events 三表）

**验证**：`npx tsc --noEmit` 基线 252 条存量错误，修复后 252 条，零新增错误

---

### 2026-08-16 - 交互打磨：面板动画+圆角/卡片5变体/归档删除修复/导入不限格式/账本含报告/点播

**面板动画生硬**：`AnimatedSlideUpPanel` 动画 duration 300/250ms，面板加圆角 16

**卡片布局不够分散**：排版变体 3→5，装饰圆增加右下/居中，`cardMain` justifyContent 分散

**档案馆删除无反应**：`pendingDeleteId` 改用 `useRef` 修复闭包 stale

**导入无法选中 .lxmc**：导入不再传 `filter`，允许系统文件选择器显示所有文件

**账本不含报告档案**：`Stats/index` 导出/导入同步处理 `getReportArchive` / `importReportArchive`

**热力图/排行可点播**：`MonthHeatMap` 账本每首歌可点击播放；`Stats/index` 歌曲排行可点击播放；通过 `addTempPlayList` + `play()` 实现

**验证**：`npx tsc --noEmit` 基线 252 条，修复后 252 条，零新增

---

### 2026-08-18 - 稳定性与体验优化

**问题**：
1. 下载队列在大量任务时存在递归风险，极端场景下可能导致崩溃
2. 播放停止后状态残留，出现幽灵播放现象
3. 网络请求超时处理不统一，偶发请求失败体验不稳定
4. 播放地址失效时无自动容错，单首歌卡住影响连续播放
5. WebDAV 同步偶发失败后需要手动重试，后台同步中断

**修复**：
1. `src/core/download.ts`：调整下载队列处理逻辑，避免递归栈溢出
2. `src/core/player/player.ts`：修复停止状态残留问题
3. `src/utils/request.js`：统一网络超时与错误处理，移除调试输出
4. `src/core/player/player.ts`：播放取地址失败时自动重试，仍失败则跳过当前歌曲
5. `src/core/sync/webdavSync.ts`：同步失败后自动重试，减少手动操作

**验证**：构建并安装后启动正常，播放与同步场景已可用

**记录人**：蓝莓派
