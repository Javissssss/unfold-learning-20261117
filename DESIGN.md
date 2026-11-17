---
name: "Unfold"
description: "蓝灰、白色与钴蓝组成的轻量英语练习工作台；记录最终实现，不另造视觉。"
colors:
  bg: "#f3f6fa"
  rail: "#e6ecf4"
  surface: "#ffffff"
  surface-soft: "#edf2f7"
  ink: "#1e2d45"
  muted: "#52627a"
  primary: "#245ad6"
  primary-hover: "#1948b7"
  selected: "#eaf0ff"
  line: "#dbe3ef"
  control-border: "#7788a1"
  danger: "#9b343b"
  error-bg: "#fff0f1"
  warning: "#805321"
  warning-bg: "#fff5e6"
  focus: "#1646b7"
typography:
  headline:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-.02em"
  title:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.01em"
  subheading:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  input:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  english:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.8
  english-large:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.8
  button:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: ".9375rem"
    fontWeight: 600
    lineHeight: 1.4
  metadata:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: ".875rem"
    fontWeight: 400
    lineHeight: 1.5
  navigation:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: ".9375rem"
    fontWeight: 600
    lineHeight: 1.6
  step-label:
    fontFamily: "'Segoe UI','Microsoft YaHei UI','Microsoft YaHei','PingFang SC',sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.6
rounded:
  control: "8px"
  surface: "14px"
  tag: "4px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-primary-active:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: "10px 12px 10px 40px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    rounded: "{rounded.control}"
    padding: "12px"
  navigation-item-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.navigation}"
    rounded: "{rounded.control}"
    padding: "12px"
  tag:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.muted}"
    typography: "{typography.metadata}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  lesson-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.5}"
  practice-step:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.step-label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  practice-step-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.step-label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "0px"
---

# Design System: Unfold

## Overview

**Creative North Star: "安静的练习工作台"**

蓝灰地面、白色材料和钴蓝行动构成一张清楚的练习桌。界面以完成任务为中心：标题说清正在做什么，说明保持次要，原生控件保留熟悉的操作方式。它不是营销海报，也不借纸片、仪器或装饰画制造学习感。

密度通过分组、留白和文字层级控制，不通过花体或醒目标签制造层级。任务标题与正文共用普通系统无衬线字体，中英文材料保持连续的阅读节奏；强调色留给可操作、选中与确认状态。本文从最终源码提取，没有另行发明视觉选择。

**Key Characteristics:**

- 蓝灰工作区、白色内容、钴蓝行动，状态色独立。
- 同一系统字体栈，任务标题明确，英文正文宽松。
- 扁平常驻表面；阴影只标记需要独立焦点的弹窗。
- 原生表单与媒体控件，完整触控目标，清晰键盘焦点。

来源：`styles.css`、`app.js`、`index.html`，提取日期2026年11月16日。YAML保存规范值；`.impeccable/design.json`补充阴影、动作、断点和组件样例，不重复基本token。它的八步色阶只是面板预览，不是新增的产品配色。

## Colors

一种功能性钴蓝搭配冷静蓝灰中性色；错误与警告是语义状态，不是第二套装饰主色。规范值只在frontmatter定义，以下解释用途。

### Primary

- **行动钴蓝**（`primary`）：主要操作、播放、选中边界与原生勾选/进度强调。
- **深钴蓝**（`primary-hover`）：主要操作悬停、当前导航和已选中状态的文字。
- **浅蓝选中面**（`selected`）：步骤、选项、收藏状态与文字选择的轻量衬底。
- **焦点深蓝**（`focus`）：键盘焦点边线与主要操作按下状态。

### Neutral

- **蓝灰地面**（`bg`）：工作区和页面背景。
- **导航蓝灰**（`rail`）：桌面固定侧栏，与白色内容分层。
- **内容白**（`surface`）：材料、卡片、控件、弹窗及主要按钮文字。
- **轻蓝灰面**（`surface-soft`）：辅助说明、轻标签、悬停与禁用底色。
- **蓝黑墨色**（`ink`）：正文与标题；短暂状态提示的深色背景。
- **次要蓝灰**（`muted`）：来源、说明、占位文字、时间与未选中导航，不使用低对比浅灰。
- **轻分隔线**（`line`）：内容分组与卡片边界；不代替输入控件边界。
- **控件蓝灰边**（`control-border`）：按钮、输入框、关闭按钮、确认项的可识别边界。

### Semantic States

- **错误暗红**（`danger`）与**错误浅红面**（`error-bg`）：错误、删除类行动和录音时间状态。
- **警告棕**（`warning`）与**警告浅暖面**（`warning-bg`）：保存、冲突或隐私提醒；不只依赖颜色说明问题。

**The Action Color Rule.** 钴蓝标记行动、选中和明确确认状态；绿色不再作为主视觉，普通说明不借用强调色。

已测的文字组合按WCAG相对亮度口径达到4.5:1，控件边界/焦点组合达到3:1；这不代表所有状态、读屏或全设备认证。新增组合仍需验证。

## Typography

**UI / Body Font:** `--font-ui`中的本机字体栈；无外部字体请求。没有独立display字体，h1是任务标题，不是海报展示字。

**Character:** 朴素、稳定、可连续阅读。英文与中文不切换装饰性字族；等宽字体仅用于实际代码/配置片段，时间与数量使用表格数字。

### Hierarchy

| 角色 | 用途与实际尺度 |
|---|---|
| Headline | 页级任务标题，28px / 1.3 / 650；移动页标题24px，学习页标题22px |
| Title | 内容分组标题，20px / 1.4 / 650 |
| Subheading | 材料卡与表达标题，18px / 1.45 / 600 |
| Body / Input | 普通中文正文16px / 1.6 / 400；文本输入16px / 1.5，不随窄屏缩小 |
| English | 英文文章与展开原文，18px / 1.8；大字模式20px / 1.8，最大70ch |
| Button | 通用按钮15px / 1.4 / 600；small为14px，不降低44px触控高度 |
| Metadata | 卡片元数据及轻标签14px / 1.5；其他辅助说明按组件保留其既有行距 |
| Navigation | 桌面导航15px / 1.6 / 600；手机底部短标签13px |
| Step label | 桌面步骤16px / 1.6 / 600；手机15px，窄屏末级文字14px |

h1与h2仅使用已实现的轻负字距。品牌字标可用700字重，但不把它扩大为新的展示字体体系。阅读标题的局部尺寸保留在相应组件，不统一成一个巨型展示标题。

**The Reading Measure Rule.** 英文材料使用宽松行距与最长70ch的正文；字号切换只改变阅读正文，不把按钮挤小。

## Layout

桌面是固定窄侧栏与流动主区。主区最大宽度1184px，常规内边距为上32px、左右40px、下40px；学习材料最大820px，复习会话最大740px。侧栏默认208px。主练习与较轻入口不必做成同重量卡片。

采用实际4px基础间隔及8/12/16/20/24/32/40px复用尺度。紧密相关的标签、控件放在一起，内容段之间留更大的间隔。材料卡常用20px，播放器和设置24px，主要阅读/复习区32px；手机收紧容器留白，不缩小输入字体或关键触控目标。

| max-width断点 | 已实现的变化 |
|---|---|
| 1120px | 侧栏184px，主区左右24px；场景卡从三列变两列 |
| 880px | 首页、记录、设置和选做区域按各自规则收为单列 |
| 700px | 侧栏变底部五栏导航，最小64px并计安全区；主区左右16px，场景单列；记录主按钮移到标题下方 |
| 370px | 隐藏顶栏日期，表单行变单列，步骤间距收紧 |
| 340px | 播放器改为两列，104px原生倍速选择独占下一行，不裁切1.15× |

底部导航占用的空间由工作区下内边距补偿；状态提示移至导航上方。标题旁的主行动不折词，手机可改成上下布局。搜索图标固定18px，文字起点保留40px逻辑内边距；不能用减字号修复重叠。

## Elevation & Depth

常驻内容通过蓝灰地面、白色表面和细分隔建立层次，没有卡片悬浮阴影。弹窗是唯一复用的抬升表面：使用`--shadow-dialog`的向下柔化阴影，背后以半透明蓝黑遮罩隔离任务。短暂状态提示靠实心蓝黑底色区分，不加装饰光晕。

### Shadow Vocabulary

- **Dialog**（`--shadow-dialog`）：需要独立焦点的已有弹窗；精确值保存在sidecar的`extensions.shadows`，不加入不受支持的YAML属性。

**The Flat Workspace Rule.** 常驻材料不抬升、不在悬停时漂浮；需要保护焦点的弹窗才使用柔化阴影。

动作仅用于状态变化：按钮背景/边界及toast透明度使用160ms和已实现的缓出曲线。无重复入场、动态假波形或装饰加载动画；`prefers-reduced-motion`关闭这些transition。动作值由sidecar扩展记录。

## Shapes

控件使用轻圆角（8px），内容和弹窗使用较柔和表面角（14px）。轻标签与导航计数采用较紧角（4px），这是现有复用的字面值，不是新增CSS变量。圆形仅用于有序步骤的小编号，不扩展为页面装饰或大进度环。

内容边界为1px轻分隔线；可操作边界用较深控件色。弹窗外层无边框，以阴影表达抬升，标题分隔线只区分内部结构。图标均为内联SVG，标准20px、1.7px线宽、圆线端；搜索18px，完成/局部提示16px。字母U是品牌字标，不以Unicode符号代替功能图标。

## Components

### Buttons

直接、稳定，不用漂浮动作。通用按钮最小44×44px，内边距10px 16px，圆角8px；主要播放与首页行动可提高到48px。可增长高度，不把44px写成不可伸展的固定高度。

- **Primary:** 钴蓝底、白字；hover为深钴蓝，active为焦点深蓝。
- **Secondary:** 白底、蓝黑字、深控件边；hover轻蓝灰，active轻分隔面。
- **Ghost:** 透明底、次要蓝灰字，横向12px；hover轻蓝灰并转正文色，仍保留触控目标。
- **Danger:** 白底、暗红字与边，hover浅红面；确认或恢复方式由任务决定，不仅改变颜色。
- **Disabled / Focus:** 原生disabled禁止操作并使用not-allowed光标；基础按钮有轻蓝灰禁用配色。变体颜色存在既有级联差异，不把它写成统一禁用配色规则。键盘focus-visible为2px焦点深蓝、3px间隔，不移除可见焦点。

### Chips / Tags

轻标签提供材料来源或元数据，不是假按钮。轻蓝灰底、次要字、4px圆角、3px 8px内边距；允许长文本换行。现有可切换tab/收藏仍用44px按钮，不伪装成窄标签。非交互标签不发明hover或active状态。

### Cards / Containers

材料卡白底、14px圆角、轻分隔边与20px内边距，无hover抬升。标题、说明与末尾行动的层级不同；点击明确按钮，不把整个article伪装为链接。较大的阅读、复习和播放器按既有尺度增加留白，不无限嵌套卡片。

### Inputs / Fields

白底、深控件边、8px圆角，最小44px高；文本输入16px / 1.5，textarea可纵向调整。搜索保留18pxSVG与40px文字起点，图标不接收点击。占位文字使用次要色且不降低透明度；caret与原生勾选强调来自主色。错误说明写出问题与恢复动作。

原生select、radio、checkbox和range不改为无键盘支持的自绘控件。倍速select宽104px、最小48px高；进度条保留键盘拖动和真实时间。本文记录样式，不把控件操作当作能力评分证据。

### Navigation

桌面按钮最小48px，选中为白底和深钴蓝字，hover轻蓝灰。手机为固定底部五栏、短标签与20px图标，按钮最小64px高，选中使用浅蓝面。当前项有`aria-current="page"`，数量只作为真实到期计数，不制造营销徽章。

### Practice Steps

有序步骤信息值得保留编号：桌面三栏、最小52px高，手机48px。当前步浅蓝底、钴蓝边、深蓝字，编号转为钴蓝底白字；已完成显示绘制的对勾。步按钮可直接到达，不根据成绩锁定。小屏先收间隔和布局，不裁切状态。

### Dialogs / State Recovery

现有产品采用原生`dialog.showModal()`；最大宽640px且距视口两侧至少16px。外层padding为0，完整白底sticky标题覆盖顶部与两侧，独立`.modal-body`承载滚动内容。桌面标题内边距24px/24px/12px，正文20px/24px/24px；手机正文20px。关闭按钮44×44px、不收缩；小屏最高为`100dvh - 32px`。

键盘Tab/Shift+Tab在首尾循环；Escape、关闭按钮与遮罩外点击可退出，关闭后焦点返回触发控件。AI取消后旧结果不复开。保存失败/跨标签冲突属于持续恢复信息，不只用短暂toast；可恢复的移除提供撤销，覆盖和删除另行确认。

sidecar弹窗样例只展示静态结构，不模拟锁焦点、AI或保存；这些行为留在实际`app.js`。记录已有帮助弹窗的外观，不规定所有帮助内容都必须模态呈现。

### Continued Audio · 2026年11月17日

音频对象独立于页面重绘。同课的听、读、用及场景库等站内页面切换不中断音频，浏览器隐藏标签也不主动暂停；新课与明确停止动作例外。离开听力步骤后，在主区顶端显示`continued-player`：原课英文标题、真实时间、暂停/续播和回到听力。无播放或播放结束时隐藏，不默认占位，也不自动跳到下一课。

此条保持白色表面、1px控件边与8px圆角，无阴影。内边距12px/16px，组间16px；320px收为上下两组而非挤小按钮。停留在顶部时使用sticky与8px偏移，不改动底部导航。时间使用14px次要文字及表格数字；标题16px/600，按钮沿用44px最小目标。控件文案直接说行动，没有装饰波形或新字体。

听力音源标签为「AI场景对话 · 非真人」。详细来源与关闭/刷新边界按需展开；不以神经合成冒充真人。系统媒体控制通过可用的Media Session能力增强，失败不影响本页操作；麦克风隐藏时仍停止，保持隐私边界。

### 2026年11月18日 · 第五轮增补

**音频质量。** 母带改为标准 RBJ biquad 均衡（削减 100–300 Hz 浑浊、提升 900–2500 Hz 清晰度与 2.5–6 kHz 临场感），配合 fp32 权重与按实测重选的音色。同一批场景的客观对比：浑浊度 14.1→2.9，清晰频段能量 0.029→0.191，临场频段 0.027→0.119，频谱质心 775→1152 Hz。不把指标改善写成“人耳审音通过”。

**持续播放与跨页条。** 播放器对象在路由切换间复用，不重建；离开听力页时顶部出现跨页条（标题、真实时间、暂停/续播、回到听力）。浏览器挂起后回到页面自动续播，新课替换与明确停止例外。

**逐句与跟读。** 原文每句为可点播放单元，高亮跟随；单句循环在句内回跳。跟读模式播一句、留等长空白、再进入下一句，状态条说明当前第几句与阶段；按 `playbackRate` 折算留白。

**划词与生词。** 选中英文浮出工具条（释义 / 收藏生词 / 朗读）；释义卡展示词条、内置释义、上下文；生词入库带释义与复习日期。生词标签页每行可直接发起回想复习，先给释义与挖空语境，翻看才露词形。

**主题与字号。** 支持跟随系统 / 浅色 / 深色，深色使用中性蓝灰而非纯黑；字号改为根字号（93.75% / 100% / 112.5%）驱动全局，不再是只作用于正文的局部规则。

**已删除的冗余。** 场景库顶部主题标签行与筛选栏的「主题」下拉重复，删除下拉；字号选项原标注 16/18/22px 与全局缩放不符，改为较小/标准/较大。

## Do's and Don'ts

### Do:

- Do 保持中英文共用本机无衬线栈，以字号、字重和留白建立层级。
- Do 保留44px最小触控目标、16px输入字体和可见键盘焦点。
- Do 先改布局和文字优先级，再收间隔；窄屏控件可独占下一行。
- Do 让次要说明按需展开，错误信息同时提供恢复入口。
- Do 以实际媒体、记录和状态生成反馈，新颜色组合继续验证对比度。

### Don't:

- Don't 恢复绿色主视觉、花体任务标题、渐变标题或装饰性假波形。
- Don't 把轻分隔色用于输入边界，或以缩小字体掩盖裁切与重叠。
- Don't 为常驻卡片增加漂浮阴影、嵌套卡片和统一重复入场。
- Don't 把静态标签、示例组件、打卡或播放点击包装成已完成的功能与能力证据。
- Don't 把sidecar预览色阶当成规范主色，或把现有帮助弹窗推广为所有说明的默认模式。
