# 对话实验室

Codex Proxy RS 独立插件，支持选择模型、编辑和保存固定多轮对话、生成随机对话预览，手动发送并查看流式回复、Token 用量和请求 ID

[下载插件](https://github.com/lostinyouu/codex-proxy-conversation-plugin/releases/latest)

## 使用

宿主要求 `>=3.44.0, <4.0.0`，支持清单 v2、RPC v7、管理能力 v2 和页面模型桥 v2，安装包平台须与宿主服务器一致

1. 在宿主「插件管理」选择 GitHub 来源，填写 `lostinyouu/codex-proxy-conversation-plugin`，选择 Release 中与宿主平台匹配的 `.tar.gz` 安装包，也可从 [Releases](https://github.com/lostinyouu/codex-proxy-conversation-plugin/releases) 下载后上传，校验文件为对应 `.sha256`
2. 安装并启用后，打开「对话实验室」，选择已有的客户端 Key 和该 Key 可用的模型
3. 选择预设或新建，按顺序编辑系统、用户和助手消息
4. 固定对话可直接发送，随机模板先点击「生成预览」，确认实际内容后发送，「换一组」会重新生成
5. 点击「保存预设」持久化当前模板，点击「停止生成」取消正在执行的请求

每次发送将整组消息作为一次 Responses 请求的上下文，返回一轮模型回复，预置的助手消息也会作为上下文发送
选择预设、生成预览、保存模板均不调用模型，点击发送才使用所选 Key 的模型权限、账号范围与额度，页面只持有 Key ID
当前回复保留在页面内，刷新后清空，保存预设只保存模板

当前提供 Linux x86_64 安装包，GitHub 自动生成的 Source code 归档只包含源码
使用指定版本时填写 Release 标签，例如 `v0.1.0`，标签留空时读取最新稳定版

### 随机变量

| 写法 | 结果 |
| --- | --- |
| `{{choice:太空|深海|森林}}` | 从非空选项中随机选择一项 |
| `{{number}}` | 1–10000 的随机整数 |
| `{{uuid}}` | 本次生成的随机 UUID |

同名变量在同组消息中保持一致，固定模式保留所有文本原样，随机模式遇到未知变量会提示错误
发送使用当前预览，编辑模板后须重新生成预览，不会在发送时悄悄更换内容

预设保存在当前插件实例的私有状态中，最多 32 个，每个预设最多 32 条消息，单条消息最多 16 KiB UTF-8 字节，总量最多 256 KiB
多页面保存使用版本校验，冲突时保留当前编辑内容，可先复制需要的内容，再点击「重新载入」读取最新版本

## 开发

需要 Rust 1.99.1、Node.js 24、pnpm 12.10.1

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

独立开发预览使用模拟模型，并将预设保存在浏览器，不代表宿主安装、持久化或真实上游已通过验收
生产构建不包含模拟桥，页面由宿主加载，宿主提供标题、主题和模型调用链路

```bash
pnpm --dir frontend lint
pnpm --dir frontend build
cargo fmt --manifest-path backend/Cargo.toml --check
cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path backend/Cargo.toml --locked
```

### 构建安装包

```bash
cargo install --locked --git https://github.com/zyycn/codex-proxy-rs.git \
  --rev 8c8618aa0f841638262262e3338c115bc075f125 codex-proxy-plugin-cli --root .tools
bash scripts/package
```

也可通过 `PLUGIN_CLI=/path/to/cpr-plugin bash scripts/package` 使用兼容工具，脚本参数可指定已准备好工具链与链接器的目标平台
输出为 `dist/` 中的 `.tar.gz` 和 `.sha256`，源码修改后需要重新构建、打包和切换已安装版本

## 源码入口

| 文件 | 职责 |
| --- | --- |
| `plugin.json` | 身份、管理页面、静态资源和私有状态声明 |
| `backend/src/main.rs` | 公开 SDK 会话与管理处理器注册 |
| `backend/src/management.rs` | Key、模型目录与预设读写 API |
| `backend/src/presets.rs` | 预设内容与容量校验 |
| `frontend/src/components/PresetPanel.vue` | 编辑、预览和保存模板 |
| `frontend/src/composables/useGeneration.ts` | 模型调用、取消与结果状态 |
| `frontend/src/utils/responses.ts` | 官方示例复用的 JSON/SSE 读取 |

仅声明 `management` 能力，无请求处理绑定，模型调用经 `window.codexProxyPlugin.models.responses` 进入普通 Responses 链路
插件只通过公开 SDK 与页面桥访问宿主，不依赖宿主内部源码或数据库

## 来源与许可

工程、主题接入和 Responses 读取参考 [官方插件工作台](https://github.com/zyycn/codex-proxy-plugins/tree/b02d267a19fd39bd004f408a685c4db51b555c99/examples/workbench)，相关代码按 Apache-2.0 许可使用，见 [LICENSE](LICENSE)
共享控件来自 [codex-proxy-ui](https://github.com/zyycn/codex-proxy-ui)，正式版本与 SDK 均由锁文件固定
