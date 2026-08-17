# LX Music Pro

> 基于 React Native 的音乐软件 —— **懂你的、专业的、漂亮的音乐伙伴。**
> 站在巨人肩膀上,但不止于"代替"大厂音乐软件。

## 📋 团队协作须知

本文档是给**所有开发者**的第一份指引。加入前请通读。

### 项目结构

```
lx-lxwalnut-music-mobile/
├── src/                    源码
│   ├── core/               核心(统计/AI/播放) — 琥珀负责
│   ├── screens/            页面(统计/设置/播放) — UI 开发者
│   ├── components/         通用组件 — UI 开发者
│   ├── plugins/            插件(歌词/存储) — 播放开发者
│   └── config/             配置 — 设置开发者
├── docs/                   文档
│   ├── hoper/              琥珀策划文档(策划设计/愿景/进度报告等)
│   └── (你的名字)/         你的文档放这里
├── .github/                
│   ├── workflows/          CI 配置
│   └── CODEOWNERS          文件主人(改别人文件需要 review)
└── tools/                  辅助脚本
```

### 开发流程

```mermaid
graph LR
    A[feature 分支] -->|PR| B[dev 分支]
    B -->|琥珀验收| C[main 分支]
    C -->|CI 出包| D[装机测试]
```

1. 从 `dev` 拉 `feature/你的功能名` 分支
2. 在**自己的文件域**内开发(见 CODEOWNERS)
3. commit → push → **开 PR 到 dev**
4. 等待 review(改别人文件 → 需文件主人 approve)
5. 合入 dev → 琥珀真机验收 → 合入 main

### 核心规则

| 规则 | 说明 |
|---|---|
| **不跨域改代码** | 改文件前先 `git log -- <文件>` 看谁动过; 改别人域的文件需 PR review |
| **CODEOWNERS** | 仓库已配自动防护,改不属于自己的文件 → PR 必须经 owner approve |
| **feature 分支** | 不直接 push main/dev,必须走 PR |
| **tsc 零错误** | 提交前确保 `npx tsc --noEmit` 通过; 无法本地跑 → CI 自动验证 |
| **文档同步** | 改完代码同步更新 `docs/hoper/` 下对应文档 |

### 快速上手

```bash
# 环境
node 18+  |  npm install

# 拉分支
git fetch origin
git checkout -b feature/xxx origin/dev

# 改代码 → commit → 推
git add 你模块的文件
git commit -m "feat(模块): 做了什么(琥珀拍板)"
git push origin feature/xxx

# 开 PR 到 dev
# 等 CI 通过 + review → 合入
```

> 无法本地跑 tsc? 推分支后 GitHub CI 自动验证,PR 里看结果即可。

### 目录

- 详细策划文档 → [`docs/hoper/`](docs/hoper/)
- 产品愿景 → [`产品愿景与设计原则.md`](docs/hoper/产品愿景与设计原则.md)
- 开发进度 → [`开发进度报告.md`](docs/hoper/开发进度报告.md)
- 团队方案 → [`团队开发方案.md`](docs/hoper/团队开发方案.md)

---

**LX Music Pro — 让音乐不只是听。**