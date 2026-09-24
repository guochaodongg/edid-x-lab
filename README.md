# EDID-X-LAB · EDID 工具箱

对 [edidcraft.com](https://edidcraft.com/) 全部功能的**完整复刻**：解析（Decoder）、生成（Encoder）、校验（Validator）、时序计算（Timing Calculator），外加一页 EDID 速成课。

- **纯静态**：`index.html` + `css/` + `js/`，可直接放到 GitHub Pages / Cloudflare Pages / 任意静态服务器。
- **前端实现**：解析、生成、校验与时序计算全部由浏览器端 JavaScript 完成。

| 项 | 值 |
| --- | --- |
| 在线地址 | <https://guochaodongg.github.io/edid-x-lab/> |
| GitHub 仓库（主） | <https://github.com/guochaodongg/edid-x-lab> |
| Gitee 仓库（国内镜像） | <https://gitee.com/guochaodong_admin/edid-x-lab> |
| 本地目录名 | `edid-x-lab` |

> 项目名、仓库名与本地目录名统一为 **edid-x-lab**（页面品牌名写作 **EDID-X-LAB**）；本文所有命令示例都以目录名 `edid-x-lab` 为准。

---

## 1. 功能清单

| 标签页 | 能力 |
| --- | --- |
| **解析** | 基础块全字段（厂商 PNP、产品、序列号、制造日期、数字/模拟输入、屏幕尺寸、Gamma、DPMS、sRGB、色度坐标 + CIE 1931 色度图）、既定时序、标准时序、4 个描述符（DTD / 0xFC 名称 / 0xFF 序列号 / 0xFE 文本 / 0xFD 范围限制 / 0x10 空）、CEA-861 全部数据块、DisplayID 分节、VTB、块映射表；带字段提示的分块十六进制查看器 |
| **生成** | 可视化表单组包：厂商/产品/序列号、日期与版本、数字（位深/接口/颜色编码）或模拟（电平/同步方式）输入、DPMS 与特性位、色度坐标（一键 sRGB / D65）、17 项既定时序、最多 8 组标准时序、4 个可切换类型的描述符槽位、可增删的 CEA / DisplayID / VTB / 块映射扩展块；校验和自动计算，实时十六进制预览 + 自校验结果 |
| **校验** | 结构、固定头、块长度、逐块校验和、扩展块数量一致性、日期范围、色度合法性与 sRGB 一致性、时序自洽、描述符格式（文本终止符、范围限制填充、CVT 参数）、CEA/VSDB/HDR/色度块一致性；按**错误 / 警告 / 提示**三级报告 |
| **时序计算** | VESA **CVT 1.1**（标准消隐）与 **CVT 1.2**（RB / RBv2 / RBv3）、**GTF 1.1**（含隔行与缩边）；输出完整参数表、消隐结构图、X11 `Modeline`、`xrandr --newmode` / `--addmode`，以及可直接写进 DTD 的 18 字节 |
| **学习 EDID** | 8 节速成课：EDID 是什么、基础块字节地图、四种描述符、18 字节 DTD 逐字节解释、CEA-861 与 DisplayID、CVT/GTF 原理、常见坑、参考资料 |
| **关于** | 项目介绍、部署说明、开发说明、清除草稿 |

附加能力：拖放 `.bin` / `.hex` / `.txt` / `.dat` / `.edid` 文件、粘贴任意十六进制文本（空格/换行/逗号/`0x` 前缀自动忽略）、`.bin/.hex` 导出、复制到剪贴板、打印 / 存 PDF、深色/浅色主题、自动保存草稿到 `localStorage`、**解析结果一键送进生成器**。

---

## 2. 目录结构

```
edid-x-lab/
├── index.html              # 页面骨架 + 内联 SVG 图标 + 各标签页内容
├── css/
│   └── styles.css          # 设计系统（浅色/深色变量、组件、打印样式）
├── js/
│   ├── edid-core.js        # 常量表 + 工具（校验和、色度、厂商码、VIC 表…）
│   ├── timing.js           # CVT / GTF 计算、Modeline、xrandr
│   ├── vtc-data.js         # DMT(88) 与 CEA-861 VIC(154) 标准时序数据表
│   ├── video-timings.js    # 多标准时序计算：CVT/RB、DMT/VIC 查表、带宽核算
│   ├── edid-decoder.js     # 字节流 → 结构化对象
│   ├── edid-encoder.js     # 模型 → 字节流（含 7 套预设）
│   ├── edid-validator.js   # 结构 / 语义校验，分级报告
│   ├── edid-report.js      # 结构化对象 → HTML 片段（纯字符串，无 DOM 依赖）
│   └── app.js              # 界面接线：标签页、表单、草稿、导出
└── README.md
```

脚本按 `core → timing → decoder → encoder → validator → report → app` 的顺序加载，**顺序不能改**（都是普通 `<script>`，不是 ES module）。

---

## 3. 部署状态与更新流程（GitHub Pages）

### 3.1 当前部署信息

| 项 | 值 |
| --- | --- |
| 在线地址 | <https://guochaodongg.github.io/edid-x-lab/> |
| 仓库 | <https://github.com/guochaodongg/edid-x-lab>（公开） |
| 分支 | `master` |
| Pages 源 | `/`（根目录） |
| HTTPS | 已强制 |

站点文件就在仓库**根目录**（`index.html` + `css/` + `js/`），所以访问路径最短、没有多余的一层目录。

### 3.2 日常更新

```bash
cd edid-x-lab
git add -A
git commit -m "描述这次改了什么"
git push
```

GitHub Pages 会在推送后**自动重新构建**（约 30–90 秒），不需要手动点任何按钮 —— 这一点比 Gitee Pages 省事得多。

### 3.3 从零部署到别的仓库（换账号或换名字时）

```bash
cd edid-x-lab
git init -b master
git add .
git commit -m "EDID-X-LAB: EDID toolkit"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin master
```

然后在仓库 **Settings → Pages** 里把 **Source** 设为 `Deploy from a branch`，**Branch** 选 `master` + `/(root)`，保存即可。

### 3.4 几点提醒

- 本项目全部用**相对路径**引用资源，所以放在子目录（如 `/edidcraft/`）里也能正常工作。
- 仓库里加一个空的 `.nojekyll` 文件可以跳过 Jekyll 处理（本项目的资源目录不以 `_` 开头，其实不加也没问题）。
- 想绑定自定义域名：同一页面的 **Custom domain** 填域名，然后在域名解析里加一条 `CNAME` 记录指向 `<用户名>.github.io`。
- 更新内容只需 `git push`，Pages 会自动重新构建。

---

## 4. 为什么没有部署到 Gitee Pages

**Gitee Pages 已经停服，无法再使用**，所以本项目最终落在 GitHub Pages。这不是配置问题：

- Gitee 官方没有发公告，但用户咨询客服得到的答复是：**Gitee Pages 功能已经下线、无法再使用**，建议迁移到 GitHub 等平台。
- 实测 `/pages` 路由在**任何**仓库上都返回 404；`*.gitee.io` 域名下**所有**站点都是 404（包括此前正常运行、别人文档里还写着"可直接免费托管"的第三方站点）。
- 仓库页的「服务」菜单里已经没有 Pages 入口了。

> 网上仍有文章说"Gitee Pages 并未下线"，其中不少是 AI 生成的内容农场 —— 有的甚至描述"Settings → Pages 页面"和 `.gitee/pages.yml` 配置，那是 GitHub 的形态，Gitee 从来没有这两个东西。实测结果和客服答复才是准的。

如果你想把 Gitee 仓库留作国内镜像，它仍然有效：<https://gitee.com/guochaodong_admin/edid-x-lab>，
推送用 `git push gitee master`（本项目本地已把 Gitee 配成一个名为 `gitee` 的远程）。

---

## 5. 部署到其他静态托管

因为是纯静态文件，以下平台都可以直接用（构建命令留空、输出目录填 `edid-x-lab` 或 `.`）：

- **Cloudflare Pages** / **Netlify** / **Vercel** — 拖拽文件夹即可
- **对象存储** — 阿里云 OSS、腾讯云 COS、七牛等，开启静态网站托管后上传整个目录
- **自建 nginx** — 把目录扔进站点根目录即可，无需任何 rewrite 规则

---

## 6. 复用引擎（二次开发）

引擎文件都是普通脚本，会挂到 `window` 上，可以脱离界面单独使用：

```html
<script src="js/edid-core.js"></script>
<script src="js/timing.js"></script>
<script src="js/edid-decoder.js"></script>
<script src="js/edid-encoder.js"></script>
<script src="js/edid-validator.js"></script>
<script>
  // 二进制 → 结构化对象
  var report = EDIDDecoder.decode(bytes);        // { ok, base, extensions, ... }

  // 模型 → 二进制（校验和自动生成）
  var model = EDIDEncoder.defaultModel();        // 也可以先套用预设
  EDIDEncoder.FORMAT_PRESETS['4k'].apply(model);
  var out = EDIDEncoder.encode(model);           // { bytes, hex, warnings }

  // 校验
  var check = EDIDValidator.validate(bytes);
  // { isValid, status, errors[], warnings[], info[], summary, messages, decoded }

  // 时序
  var t = EDIDTiming.computeCVT({ width: 2560, height: 1440, refreshRate: 144, rbVersion: 2 });
  EDIDTiming.modeline(t);
  EDIDTiming.xrandrNewmode(t);
</script>
```

主要导出：

| 全局对象 | 内容 |
| --- | --- |
| `EDIDCore` | 常量表（`ESTABLISHED`、`CEA_VIDEO_CODES`、`SPEAKER_ALLOCATION`…）与工具（`bytesToHex`、`checksum`、`manufacturerFromBytes`、`chromaToXy`、`sRGBChromaticity`、`establishedKey`…） |
| `EDIDTiming` | `computeCVT`、`computeGTF`、`verticalSyncFor`、`modeName`、`modeline`、`xrandrNewmode`、`xrandrAddMode`、`xrandrAddOutput`、`timingRows`、`compare(cvt, gtf)`、`PRESETS` |
| `EDIDDecoder` | `decode(bytes)`、`decodeHexString(hex)`、`parseBase`、`parseDescriptor`、`parseDTD` |
| `EDIDEncoder` | `encode(model)`、`defaultModel()`、`defaultDTD()`、`dtdFromTiming()`、`packDTD()`、`ceaHdExtension()`、`cea4kExtension()`、`FORMAT_PRESETS`（`1080p` / `1440p` / `4k` / `ultrawide` / `laptop` / `legacy` / `hdr`） |
| `EDIDValidator` | `validate(bytes)`、`checkDTD(dtd)` |
| `EDIDReport` | `decodeReport`、`validationReport`、`timingReport`、`hexViewer`、`chromaPlot`、`kv`、`card`、`chip`、`tableHtml`、`esc` |

---

## 7. 自测

> 发布仓库只包含 `index.html` + `css/` + `js/`，**不含测试脚本**。下面的两种方式都不需要安装任何第三方包，可随时用来验证引擎是否完好。

### 7.1 Node 里跑一遍（推荐）

引擎文件是普通脚本，用 `vm.runInThisContext` 在同一个全局上下文里依次加载即可（它们靠 `window`/`global` 互相引用，所以**必须共享同一个上下文**）：

```js
// check.js —— 放在 edid-x-lab/ 下，执行：node check.js
const fs = require('fs'), vm = require('vm');
['edid-core', 'timing', 'edid-decoder', 'edid-encoder', 'edid-validator', 'edid-report']
  .forEach(f => vm.runInThisContext(fs.readFileSync('js/' + f + '.js', 'utf8'), { filename: f }));

// 1) 7 套预设：组包 → 自校验，应当零错误
Object.keys(EDIDEncoder.FORMAT_PRESETS).forEach(key => {
  const m = EDIDEncoder.defaultModel();
  EDIDEncoder.FORMAT_PRESETS[key].apply(m);
  const out = EDIDEncoder.encode(m);
  const v = EDIDValidator.validate(out.bytes);
  console.log(key.padEnd(10), out.bytes.length + 'B', v.status, 'err=' + v.errors.length, 'warn=' + v.warnings.length);
});

// 2) 编解码往返：encode → decode，厂商/产品码应当一致
const m = EDIDEncoder.defaultModel();
EDIDEncoder.FORMAT_PRESETS['4k'].apply(m);
const bytes = EDIDEncoder.encode(m).bytes;
const d = EDIDDecoder.decode(bytes);
console.log(d.ok, d.base.manufacturer, d.base.productCode);

// 3) 时序：CVT 与 GTF 对比
const cvt = EDIDTiming.computeCVT({ width: 2560, height: 1440, refreshRate: 144, rbVersion: 2 });
const gtf = EDIDTiming.computeGTF({ width: 2560, height: 1440, refreshRate: 144 });
console.log(EDIDTiming.modeline(cvt));
console.log(EDIDTiming.compare(cvt, gtf).recommendation);
```

### 7.2 浏览器控制台里跑一遍

打开页面后按 F12，在控制台直接输入（引擎已挂在 `window` 上）：

```js
Object.keys(EDIDEncoder.FORMAT_PRESETS).map(k => {
  const m = EDIDEncoder.defaultModel();
  EDIDEncoder.FORMAT_PRESETS[k].apply(m);
  const v = EDIDValidator.validate(EDIDEncoder.encode(m).bytes);
  return k + ' → ' + v.status + ' / err=' + v.errors.length;
});
```

### 7.3 界面层

界面（`app.js`）依赖真实 DOM，需要 [jsdom](https://www.npmjs.com/package/jsdom) 才能自动化。jsdom **不是**项目依赖，装在目录之外即可，避免污染这个纯静态仓库：

```bash
mkdir /tmp/edid-domtest && cd /tmp/edid-domtest && npm install jsdom
NODE_PATH=/tmp/edid-domtest/node_modules node your-dom-test.js
```

Windows 上把 `NODE_PATH` 换成 `C:\...\edid-domtest\node_modules` 即可。

---

## 8. 已知边界

- **DisplayID** 只解析到“分节”层级（标签/版本/长度/偏移），不做逐节内容解释；生成器也按分节字节原样写入。
- **VTB** 与**块映射表**同样只做结构与标签层面的处理。
- **HDMI Forum VSDB**（OUI `C4-5D-D8`）只读版本号，不展开其全部能力位。
- 音频数据块最多 10 个描述符；标准时序最多 8 组；描述符固定 4 个槽位——这些都是 EDID 规范本身的限制。
- 校验规则以 VESA 规范与 Linux `edid-decode` 的判定为参照，但个别厂商的“非标但可用”做法可能被报为警告，请结合实际情况判断。
- **时序对比**页中 CEA-861 / DMT 列只覆盖标准表内收录的模式；表内个别条目（如 DMT 0x0F）在参考数据源中即不完整，会显示“—”。自定义模式只约束总消隐量与像素时钟，前后沿按 CVT-RB 布局确定性地分配。隔行模式下 CVT 系列显示场有效行数（规范定义），CEA-861 / DMT 显示整帧行数。

---

## 9. 说明

本项目的代码与文案为独立实现，功能对标 edidcraft.com。「时序对比」页的功能对标 Tom Verbeure 的
Video Timings Calculator（其 DMT/VIC 标准时序数据与 CVT 公式来自 VESA/CTA 公开规范，算法经交叉验证对齐）。
EDID / CEA-861 / DisplayID / CVT / GTF 的具体细节请以 VESA 与 CTA 官方规范为准。
