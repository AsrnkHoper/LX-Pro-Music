# LX Music Pro

> 基于 React Native 的音乐软件 —— **懂你的、专业的、漂亮的音乐伙伴。**
> 站在巨人肩膀上,但不止于"代替"大厂音乐软件。

## 📋 团队协作须知

本文档是给**所有开发者**的第一份指引。加入前请通读。

### 分支结构(2026-08-18 起)

```
v2-rebuild(默认/主开发线) ← 现在在这开发
  └─ feature/你的功能 → PR → review → 合入
main(经验存档:旧版自研 Stats/AI/策划,可参考不可改)
dev(旧集成分支,已停用)
```

> ⚠️ **v2-rebuild 是默认分支**,所有新开发从这里开分支。main 是经验库(琥珀旧版成果存档,仅供参考)。

### 项目结构(上游最新版)

```
lx-lxwalnut-music-mobile/
├── src/                    源码(上游 lx-music-mobile 全功能)
│   ├── screens/            页面(播放/歌单/搜索/播放历史等)
│   ├── core/               核心逻辑
│   ├── components/         通用组件
│   └── ...
├── docs/                   团队文档
│   ├── 产品愿景与设计原则.md ← 北极星:八大维度
│   ├── 团队开发方案.md       ← 协作流程
│   ├── 颜值线.md / 功能线.md / 优化线.md  ← 方向参考
│   ├── 萌新协作傻瓜手册.md
│   └── (你的名字)/         你的文档放这里
└── .github/CODEOWNERS      文件主人(改别人文件需要 review)
```

### 开发流程

```mermaid
graph LR
    A[feature 分支] -->|PR| B[v2-rebuild]
    B -->|琥珀验收| C[出包/装机测试]
```

1. 从 `v2-rebuild` 拉 `feature/你的功能名` 分支
2. 在**自己的文件域**内开发(见 CODEOWNERS)
3. commit → push → **开 PR 到 v2-rebuild**
4. 等 review(改别人代码 → 需文件主人 approve)+ CI 通过
5. 琥珀真机验收 → 合入

### 核心规则

| 规则 | 说明 |
|---|---|
| **不跨域改代码** | 改文件前先 `git log -- <文件>` 看谁动过;改别人域的文件需 PR review |
| **CODEOWNERS** | 仓库已配自动防护,改不属于自己的文件 → PR 必须经 owner approve |
| **docs/ 文档** | 队友文档免 review(自己目录自由编辑),`docs/` 根共享文档大家维护 |
| **feature 分支** | 不直接 push v2-rebuild,必须走 PR |
| **tsc 零错误** | 提交前确保 `npx tsc --noEmit` 通过;无法本地跑 → CI 自动验证 |

### 快速上手

```bash
# 环境
node 18+  |  npm install

# 拉分支
git fetch origin
git checkout -b feature/xxx origin/v2-rebuild

# 改代码 → commit → 推
git add 你模块的文件
git commit -m "feat(模块): 做了什么(琥珀拍板)"
git push origin feature/xxx

# 开 PR 到 v2-rebuild
# 等 CI 通过 + review → 合入
```

> 无法本地跑 tsc? 推分支后 GitHub CI 自动验证,PR 里看结果即可。

### 目录

- 详细策划与愿景 → `docs/` 下的团队文档(见上)
- 历史成果(琥珀旧版自研 Stats/AI)→ `main` 分支(存档)

---

**LX Music Pro — 让音乐不只是听。**