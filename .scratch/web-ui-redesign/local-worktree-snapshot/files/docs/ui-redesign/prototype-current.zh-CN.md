# 当前完整功能 F 原型

[English](prototype-current.md) · [功能保留基线](README.zh-CN.md) · [机器可读映射](prototype-current.json)

六个重新设计的工具现已为基线中的 **119 组工具功能**提供界面与操作入口，并接通共享导航、主题和画布控件。这是设计原型，不是正式产品实现或完整回归验收。解析、渲染、优化与导出继续复用原有引擎。本布局提案不删除既有能力。

旧[覆盖表](coverage.json)冻结在此次扩展前的审计时点，不代表当前 F 的状态。基线中的功能 ID 与保留验收仍是依据。下表为全部 128 个 ID 记录当前界面位置。

## 如何评审

已发布面向首页、共享界面与四个公开工具的[正式实施规格](../../.scratch/web-ui-redesign-implementation/spec.zh-CN.md)。下方隐藏工具条目继续作为保留／参考资料，其重设计暂缓。

运行 `pnpm dev` 后打开对应路由。桌面画布工具默认直接展示完整画布，控件浮动其上。手机通过各工具的画布／素材／预览／参数标签访问同一组控件；低频参数位于可展开的高级区。首页继续只显示四个工具；CSS 扫光和字体工具箱在首页与工具页切换菜单中均不显示入口，既有直达路由保留。

| 工具        | 原型                                                          | 主要组织方式                                                 |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| URL／二维码 | [打开](http://127.0.0.1:1420/tools/url-qrcode?variant=F)      | 输入工具行、递归可编辑树、二维码与记录；没有平面解析结果摘要 |
| 帧动画      | [打开](http://127.0.0.1:1420/tools/frame-animation?variant=F) | 窄左侧参数、右侧画布、统一工具条、底部素材及其上方短播放条   |
| 点九图      | [打开](http://127.0.0.1:1420/tools/nine-patch?variant=F)      | 源图画布、独立浮动八向缩边预览，参数／CSS／记录              |
| Lottie      | [打开](http://127.0.0.1:1420/tools/lottie-preview?variant=F)  | 主画布、独立图集、浮动播放条、三个任务标签与常驻对比／导出   |
| CSS 扫光    | [打开](http://127.0.0.1:1420/tools/css-shine?variant=F)       | 预览与代码搭配紧凑参数区                                     |
| 字体工具箱  | [打开](http://127.0.0.1:1420/tools/font-toolkit?variant=F)    | 已导入文件工具行、四个任务标签、主体搭配紧凑参数区           |

首页和六个工具原型中的纯图标操作统一去掉描边，包括共享主题控件、画布按钮、HUD 控件、记录操作与树操作。主题控件同时去掉外框和内部按钮分隔线。悬停填充、选中填充、禁用状态与键盘焦点提示保留。此规则覆盖图标尺寸的 Button 和明确标注的原生图标操作；表单输入、色板、文字操作及面板边界保留现有边框。窄屏下收为图标的工具条导入操作采用同一规则。

三个主题按钮在桌面和手机上统一为 28 × 28 px，16 px 图标居中。亮暗主题的选中态均使用 secondary 填充和 foreground 前景色。

共享 F 色板使用蓝色主色、浅蓝次要色、绿色成功、红色失败、琥珀警告与青蓝提示。映射、亮暗令牌及验证边界见[语义色彩评审](color-system.zh-CN.md)。

## 记录与验收边界

URL、帧动画、点九图和 Lottie 使用独立 IndexedDB 数据库 **`web-tools-ui-PROTOTYPE-wipe-me`**。保存／加载／删除是真实操作，刷新后保留。原型不读取、迁移或覆盖产品数据库与旧 URL localStorage 记录；U23／G06 中的兼容要求仍留待正式实现。扫光／字体的基线没有项目持久化，不在此凭空增加。

`interface-wired` 表示入口调用实际处理函数／引擎，不表示每种输入和浏览器均已通过。`isolated-store` 具有相同界面，但刻意使用独立数据。`product-acceptance-deferred` 表示保留产品外壳，新设计的生产 SSG／SEO 或 Safari 独立模式验收仍待完成。这些是实现边界，不是删减范围。

## 当前界面映射

各 ID 链接到保留验收标准。下列入口是新 F 的界面位置，不替代功能规格。

### URL／二维码

桌面输入区与二维码区共用顶部网格行，高度一致；可编辑参数树独占下方第二行，记录独占第三行。宽度不超过 800px 时，各区域纵向排列。既有控件与处理逻辑保持不变。

按用户明确要求，下载交互替代历史 U17 菜单：页面直接下载纯二维码 PNG；预览弹窗对 URL 下载二维码与参数图，对纯文本下载纯二维码。生成时禁用弹窗按钮，失败在弹窗内提示。两种导出格式继续可用，不再使用下拉菜单。

[2026-10-19 自评与缺口核查](url-review.zh-CN.md)

| ID                           | 当前 F 入口                                        | 状态              |
| ---------------------------- | -------------------------------------------------- | ----------------- |
| [U01](features/url.zh-CN.md) | 输入区：URL 与查询文本                             | `interface-wired` |
| [U02](features/url.zh-CN.md) | 参数树：递归参数与 hash                            | `interface-wired` |
| [U03](features/url.zh-CN.md) | 参数树：key、value 与 base 编辑                    | `interface-wired` |
| [U04](features/url.zh-CN.md) | 行内编辑：提交、取消和新增焦点                     | `interface-wired` |
| [U05](features/url.zh-CN.md) | 参数树：新增与插入入口                             | `interface-wired` |
| [U06](features/url.zh-CN.md) | 参数树：删除确认                                   | `interface-wired` |
| [U07](features/url.zh-CN.md) | 参数树：节点拖放                                   | `interface-wired` |
| [U08](features/url.zh-CN.md) | 输入区与参数树：复制入口                           | `interface-wired` |
| [U09](features/url.zh-CN.md) | 树下方变量模板：预览与复制                         | `interface-wired` |
| [U10](features/url.zh-CN.md) | 输入工具行：示例                                   | `interface-wired` |
| [U11](features/url.zh-CN.md) | 二维码区：生成图片                                 | `interface-wired` |
| [U12](features/url.zh-CN.md) | 二维码区：图片选择、拖入与粘贴                     | `interface-wired` |
| [U13](features/url.zh-CN.md) | 输入与二维码区：空白和错误提示                     | `interface-wired` |
| [U14](features/url.zh-CN.md) | 二维码图片：放大与树状弹层                         | `interface-wired` |
| [U15](features/url.zh-CN.md) | 页面下载按钮：纯二维码 PNG                         | `interface-wired` |
| [U16](features/url.zh-CN.md) | 预览弹窗下载：二维码与参数图；纯文本回退为纯二维码 | `interface-wired` |
| [U17](features/url.zh-CN.md) | 直接下载：禁用、生成与错误状态；按用户要求移除菜单 | `interface-wired` |
| [U18](features/url.zh-CN.md) | 输入工具行：保存与选中记录更新                     | `interface-wired` |
| [U19](features/url.zh-CN.md) | 记录列表：行内重命名                               | `interface-wired` |
| [U20](features/url.zh-CN.md) | 记录列表：载入与取消选中                           | `interface-wired` |
| [U21](features/url.zh-CN.md) | 记录条目：桌面提示与手机弹层                       | `interface-wired` |
| [U22](features/url.zh-CN.md) | 记录列表：复制、删除与清空确认                     | `interface-wired` |
| [U23](features/url.zh-CN.md) | 记录列表：独立持久数据库；旧数据迁移留待正式实现   | `isolated-store`  |
| [U24](features/url.zh-CN.md) | 输入区：hash 恢复与防抖分享更新                    | `interface-wired` |
| [U25](features/url.zh-CN.md) | 输入、树和二维码空态；主动示例入口                 | `interface-wired` |

[界面源码](../../apps/web/src/ui-redesign-url.prototype.tsx)

### 帧动画

| ID                              | 当前 F 入口                                      | 状态              |
| ------------------------------- | ------------------------------------------------ | ----------------- |
| [F01](features/motion.zh-CN.md) | 导入工具行与画布拖放                             | `interface-wired` |
| [F02](features/motion.zh-CN.md) | 导入工具行：ZIP 与目录                           | `interface-wired` |
| [F03](features/motion.zh-CN.md) | 导入与素材条：追加与自然排序                     | `interface-wired` |
| [F04](features/motion.zh-CN.md) | 画布与工具行：示例                               | `interface-wired` |
| [F05](features/motion.zh-CN.md) | 素材条：勾选与全选／全不选                       | `interface-wired` |
| [F06](features/motion.zh-CN.md) | 素材条：信息、勾选与拖拽排序                     | `interface-wired` |
| [F07](features/motion.zh-CN.md) | 素材工具行：裁剪弹窗、阈值和应用／取消           | `interface-wired` |
| [F08](features/motion.zh-CN.md) | 浮动播放条与素材条：播放、进度定位、步进和快捷键 | `interface-wired` |
| [F09](features/motion.zh-CN.md) | 播放标签：FPS、时长与时间信息                    | `interface-wired` |
| [F10](features/motion.zh-CN.md) | 播放标签：双端范围与恢复全程                     | `interface-wired` |
| [F11](features/motion.zh-CN.md) | 播放标签：方向与有限／无限循环                   | `interface-wired` |
| [F12](features/motion.zh-CN.md) | 画布：平移、缩放和适配重置                       | `interface-wired` |
| [F13](features/motion.zh-CN.md) | 画布工具行：边界与背景选择                       | `interface-wired` |
| [F14](features/motion.zh-CN.md) | 播放标签：像素风                                 | `interface-wired` |
| [F15](features/motion.zh-CN.md) | 精灵图标签：行列与原分辨率 PNG 下载              | `interface-wired` |
| [F16](features/motion.zh-CN.md) | 精灵图标签：实时预览与输出尺寸                   | `interface-wired` |
| [F17](features/motion.zh-CN.md) | 代码标签：CSS／Less／SCSS、开关、选择与复制      | `interface-wired` |
| [F18](features/motion.zh-CN.md) | 项目标签：名称、保存、加载与删除                 | `interface-wired` |
| [F19](features/motion.zh-CN.md) | 导入工具行：清空素材                             | `interface-wired` |
| [F20](features/motion.zh-CN.md) | 画布、素材条、裁剪与输出：错误、空白与忙碌状态   | `interface-wired` |

[界面源码](../../apps/web/src/ui-redesign-frames-full.prototype.tsx)

帧动画桌面工作区采用 240px 左侧面板，保留播放／精灵图／代码／项目标签与常驻 PNG 导出。导入、示例、清空、重置、边界和背景合为右侧画布上方的同一工具条。序列横跨工作区底部全宽，延伸到左侧面板下方，短播放条紧邻其上方。左侧面板止于序列上方，空间不足时内部滚动。序列保留勾选、拖排、裁剪和排序；缩略图直接显示源尺寸与字节数。画布适配在预览下方为序列实测高度及播放控件留出空间，播放条保持在右侧工作区居中。短进度条随播放更新，可用指针或键盘在入选帧中定位；定位会暂停播放，不改变已配置的播放／导出范围。无帧或单帧时禁用进度定位。手机继续通过画布／素材／设置视图访问同一组控件；素材视图中的播放条也位于序列上方。按用户要求，缩略图不再跟随或高亮正在播放的帧；当前帧由进度控件反馈，点击缩略图仍会暂停并定位。此要求明确替代 F06 历史基线中的自动高亮要求，其余 F01–F20 能力仍须保留。

### 点九图

| ID                            | 当前 F 入口                                      | 状态              |
| ----------------------------- | ------------------------------------------------ | ----------------- |
| [N01](features/nine.zh-CN.md) | 导入工具行与源图画布拖放                         | `interface-wired` |
| [N02](features/nine.zh-CN.md) | 导入提示与有效替换                               | `interface-wired` |
| [N03](features/nine.zh-CN.md) | 源图画布与工具行：示例                           | `interface-wired` |
| [N04](features/nine.zh-CN.md) | 替换图片初始化参数并适配画布                     | `interface-wired` |
| [N05](features/nine.zh-CN.md) | 导入工具行：清空                                 | `interface-wired` |
| [N06](features/nine.zh-CN.md) | 参数标签：四边源像素约束输入                     | `interface-wired` |
| [N07](features/nine.zh-CN.md) | 源图画布：四条可拖动切线                         | `interface-wired` |
| [N08](features/nine.zh-CN.md) | 切线：键盘 slider 与 Shift 加速                  | `interface-wired` |
| [N09](features/nine.zh-CN.md) | 参数标签：恢复切片边距                           | `interface-wired` |
| [N10](features/nine.zh-CN.md) | 参数标签：自动像素分析                           | `interface-wired` |
| [N11](features/nine.zh-CN.md) | 参数标签：绑定／独立边框宽度                     | `interface-wired` |
| [N12](features/nine.zh-CN.md) | 参数标签：外扩                                   | `interface-wired` |
| [N13](features/nine.zh-CN.md) | 参数标签：中心填充                               | `interface-wired` |
| [N14](features/nine.zh-CN.md) | 参数标签：独立横／纵重复                         | `interface-wired` |
| [N15](features/nine.zh-CN.md) | 参数标签：中心裁剪轴、保留尺寸与裁到最小         | `interface-wired` |
| [N16](features/nine.zh-CN.md) | 源图画布：裁剪遮罩与说明                         | `interface-wired` |
| [N17](features/nine.zh-CN.md) | 面板常驻底部：裁剪 PNG 下载                      | `interface-wired` |
| [N18](features/nine.zh-CN.md) | 可移动／调整大小的 HUD：实时 border-image 与尺寸 | `interface-wired` |
| [N19](features/nine.zh-CN.md) | 预览：数字宽高、八向缩边与角点键盘操作           | `interface-wired` |
| [N20](features/nine.zh-CN.md) | 源图画布：独立平移与缩放                         | `interface-wired` |
| [N21](features/nine.zh-CN.md) | 预览：独立平移、缩放和重置                       | `interface-wired` |
| [N22](features/nine.zh-CN.md) | 双画布：初始适配与随尺寸调整的重置               | `interface-wired` |
| [N23](features/nine.zh-CN.md) | 画布控件：共用边界与主题背景                     | `interface-wired` |
| [N24](features/nine.zh-CN.md) | CSS 标签：分开写／简写与图片占位                 | `interface-wired` |
| [N25](features/nine.zh-CN.md) | 面板常驻底部与 CSS 标签：复制与反馈              | `interface-wired` |
| [N26](features/nine.zh-CN.md) | CSS 标签：局部全选与占位提示                     | `interface-wired` |
| [N27](features/nine.zh-CN.md) | 面板常驻底部：保存图片与全部输出参数             | `interface-wired` |
| [N28](features/nine.zh-CN.md) | 记录标签：名称、字节数与图片／设置恢复           | `interface-wired` |
| [N29](features/nine.zh-CN.md) | 记录标签：删除与刷新                             | `interface-wired` |

[界面源码](../../apps/web/src/ui-redesign-nine-full.prototype.tsx)

调整后的点九图工作区采用 240px 左侧面板，按切片、中心裁剪、渲染的顺序分组。边框宽度、外扩、填充与横纵重复保持展开；CSS 和记录保留独立标签。复制 CSS、保存与裁剪 PNG 下载常驻面板底部。顶部统一工具条包含图片操作、源图信息、源图视图重置及共用背景／边界控件。拉伸预览为覆盖在画布上的 HUD，初始位于右下方。拖动标题栏移动位置，拖动外框边缘／角点调整 HUD 大小；输入框和按钮不会启动拖动。HUD 几何受可用画布边界约束，视口变化后重新收敛，并提供独立的布局重置按钮。聚焦标题拖动柄或右下外框手柄后，方向键每次移动或调整 8px，Shift 为 32px。源图画布不再为 HUD 预留固定栏位。内部拉伸逻辑尺寸保持独立：数字输入（96–720 × 64–480）、内容八向缩边、角点键盘操作、内部平移／缩放和视图重置均保留。手机继续使用编辑／预览／参数与输出视图，HUD 移动和大小限制在预览区域内。HUD 位置与大小属于查看状态，不写入编辑记录。现有处理和存储逻辑不变。本次调整仅完成编译与源码检查；自动浏览器访问受策略限制，尚未重新进行浏览器交互和视觉验证。

### Lottie

| ID                              | 当前 F 入口                                                  | 状态              |
| ------------------------------- | ------------------------------------------------------------ | ----------------- |
| [L01](features/motion.zh-CN.md) | 导入工具行与画布：ZIP 或目录                                 | `interface-wired` |
| [L02](features/motion.zh-CN.md) | 导入提示：素材解析与缺失资源                                 | `interface-wired` |
| [L03](features/motion.zh-CN.md) | 工具行：示例、替换与清空                                     | `interface-wired` |
| [L04](features/motion.zh-CN.md) | 播放设置标签：播放库与渲染器                                 | `interface-wired` |
| [L05](features/motion.zh-CN.md) | 播放设置标签：meet／slice 适配                               | `interface-wired` |
| [L06](features/motion.zh-CN.md) | 预览下方紧凑播放条：播放、小数帧定位与信息                   | `interface-wired` |
| [L07](features/motion.zh-CN.md) | 播放设置标签：速度、方向与循环                               | `interface-wired` |
| [L08](features/motion.zh-CN.md) | 主预览适配桌面左面板旁的可用区域；保留平移、缩放与重置       | `interface-wired` |
| [L09](features/motion.zh-CN.md) | 画布工具行：边界与主题背景                                   | `interface-wired` |
| [L10](features/motion.zh-CN.md) | 图集优化标签：启用与实时重建                                 | `interface-wired` |
| [L11](features/motion.zh-CN.md) | 图集优化标签：图集尺寸、间距与边缘扩展                       | `interface-wired` |
| [L12](features/motion.zh-CN.md) | 图集优化标签：旋转、裁透明边与去重                           | `interface-wired` |
| [L13](features/motion.zh-CN.md) | 图集优化标签：高级 2 的幂、正方形与 alpha 控件               | `interface-wired` |
| [L14](features/motion.zh-CN.md) | 优化提示：排除的动态素材                                     | `interface-wired` |
| [L15](features/motion.zh-CN.md) | 面板常驻底部：前后指标与图集统计                             | `interface-wired` |
| [L16](features/motion.zh-CN.md) | 工具栏入口：贴附的浮动图集查看器，独立平移、缩放、重置与关闭 | `interface-wired` |
| [L17](features/motion.zh-CN.md) | 面板常驻底部：任一任务标签下真实 ZIP 导出                    | `interface-wired` |
| [L18](features/motion.zh-CN.md) | 项目记录标签：名称、保存、加载与删除                         | `interface-wired` |
| [L19](features/motion.zh-CN.md) | 面板底部消息折叠区与手机直达入口；保留忙碌和优化状态         | `interface-wired` |
| [L20](features/motion.zh-CN.md) | 手机画布／图集／参数导航；手势保留                           | `interface-wired` |

[界面源码](../../apps/web/src/ui-redesign-lottie-full.prototype.tsx)

### CSS 扫光

| ID                              | 当前 F 入口                          | 状态              |
| ------------------------------- | ------------------------------------ | ----------------- |
| [C01](features/hidden.zh-CN.md) | 预览形态选择：卡片、按钮、徽章与图片 | `interface-wired` |
| [C02](features/hidden.zh-CN.md) | 图片模式：上传与替换蒙版图片         | `interface-wired` |
| [C03](features/hidden.zh-CN.md) | 控件区：触发与方向                   | `interface-wired` |
| [C04](features/hidden.zh-CN.md) | 控件区：五项实时动效滑块             | `interface-wired` |
| [C05](features/hidden.zh-CN.md) | 控件区：三种预设                     | `interface-wired` |
| [C06](features/hidden.zh-CN.md) | 预览操作：重播与重置                 | `interface-wired` |
| [C07](features/hidden.zh-CN.md) | 代码区：完整实时 CSS 与 HTML         | `interface-wired` |
| [C08](features/hidden.zh-CN.md) | 代码工具行：复制与成功／失败反馈     | `interface-wired` |
| [C09](features/hidden.zh-CN.md) | 预览与生成 CSS：减少动态效果行为     | `interface-wired` |

[界面源码](../../apps/web/src/ui-redesign-shine-full.prototype.tsx)

### 字体工具箱

| ID                              | 当前 F 入口                                    | 状态              |
| ------------------------------- | ---------------------------------------------- | ----------------- |
| [T01](features/hidden.zh-CN.md) | 上传区：TTF／OTF／WOFF／WOFF2 与错误           | `interface-wired` |
| [T02](features/hidden.zh-CN.md) | 已导入文件工具行：信息、替换与移除             | `interface-wired` |
| [T03](features/hidden.zh-CN.md) | 四个标签：预览、字符浏览、体检与子集化         | `interface-wired` |
| [T04](features/hidden.zh-CN.md) | 预览标签：自定义文本与字号滑块                 | `interface-wired` |
| [T05](features/hidden.zh-CN.md) | 字符标签：分类与数量                           | `interface-wired` |
| [T06](features/hidden.zh-CN.md) | 字符标签：字面或 Unicode 搜索                  | `interface-wired` |
| [T07](features/hidden.zh-CN.md) | 字符网格：加载更多、选择与详情                 | `interface-wired` |
| [T08](features/hidden.zh-CN.md) | 字符详情：加入自定义子集文本                   | `interface-wired` |
| [T09](features/hidden.zh-CN.md) | 体检标签：指标与覆盖率                         | `interface-wired` |
| [T10](features/hidden.zh-CN.md) | 子集标签：三档汉字字频等级                     | `interface-wired` |
| [T11](features/hidden.zh-CN.md) | 子集标签：ASCII、标点与自定义文本              | `interface-wired` |
| [T12](features/hidden.zh-CN.md) | 子集标签：缺字提示                             | `interface-wired` |
| [T13](features/hidden.zh-CN.md) | 子集标签：WOFF2／WOFF／TTF、hinting 与 kerning | `interface-wired` |
| [T14](features/hidden.zh-CN.md) | 子集标签：全量格式转换                         | `interface-wired` |
| [T15](features/hidden.zh-CN.md) | 结果区：体积、字形数、下载与 font-face 代码    | `interface-wired` |
| [T16](features/hidden.zh-CN.md) | 上传／导出：忙碌、禁用与错误状态               | `interface-wired` |

[界面源码](../../apps/web/src/ui-redesign-font-full.prototype.tsx)

### 共享行为

| ID                              | 当前 F 入口                                                   | 状态                          |
| ------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| [G01](features/shared.zh-CN.md) | 首页与工具切换：仅四个 ready 工具；隐藏工具路由保留           | `interface-wired`             |
| [G02](features/shared.zh-CN.md) | 六个路由与保留 query／hash 的 URL 别名；工具菜单高于画布控件  | `interface-wired`             |
| [G03](features/shared.zh-CN.md) | 左侧页头：返回首页；桌面品牌与手机工具标题                    | `interface-wired`             |
| [G04](features/shared.zh-CN.md) | 页头：持久的系统／浅色／深色选择                              | `interface-wired`             |
| [G05](features/shared.zh-CN.md) | 页头：现有 GitHub 品牌 SVG 与新标签页仓库链接                 | `interface-wired`             |
| [G06](features/shared.zh-CN.md) | 共用独立持久存储；正式记录与迁移留待正式实现                  | `isolated-store`              |
| [G07](features/shared.zh-CN.md) | 画布控件与编辑／缩边手势保护                                  | `interface-wired`             |
| [G08](features/shared.zh-CN.md) | 开发原型 Seo；生产 SSG 保持，待正式实现验收新布局             | `product-acceptance-deferred` |
| [G09](features/shared.zh-CN.md) | 保留 manifest 与 standalone 元数据；Safari 独立模式检查待验收 | `product-acceptance-deferred` |

[界面源码](../../apps/web/src/ui-redesign-workspace.prototype.tsx)

## 已执行检查

- 浏览器检查覆盖首页与六工具，1440／390 宽度、亮暗主题共 28 个视图：单一页面标题、无横向溢出、无页面运行错误，画布工具没有页面级滚动。Lottie 响应式修正后另行更新了最新视图。
- URL：空态／示例、嵌套编辑、hash 重开与旧路由 hash 兼容、持久记录保存／重命名／刷新。此前还检查过树操作、变量、二维码识别／弹层与两种图片下载；本次扩展未重跑所有解析／二维码边界。
- 帧动画：ZIP／目录／导入／追加、自然排序、勾选与拖放操作、公共透明边裁剪、范围／方向／循环与键盘步进、原分辨率网格 PNG、三种代码语法、项目持久恢复（含裁剪帧）。原型单独修复了裁剪后仍沿用 SVG 文件名的帧恢复问题，按 PNG 字节识别；正式实现也需要覆盖这个回归。
- 点九图：导入与错误恢复、切线拖动／键盘约束、自动分析、独立宽度／外扩／填充／重复、全部八向预览缩边、独立视图、分开写／简写与剪贴板、两轴／X／Y 裁剪 PNG（测试输入对应 63×77／81×160／240×81）、项目刷新／加载／删除、手机高级参数。
- Lottie：通过真实 Canvas 像素或可解码 SVG 图片核对四种引擎／渲染器组合；ZIP／目录、示例、全部优化控件、图集缩放／重置、真实 ZIP 内容与重新导入、缺数据／缺图恢复、命名记录跨刷新与参数恢复。
- 扫光：四种形态、图片导入、触发／方向、预设／重置、真实剪贴板 CSS＋HTML，含文件名与减少动态效果规则。
- 字体：TTF 导入、四个标签、Unicode 搜索／详情／自定义子集、真实 TTF 和 WOFF2 子集下载、全量转换、体检与文字预览。WOFF2 使用真实 WASM 路径。其他输入／输出组合仍需系统检查。
- 本轮不认证真实设备触屏／捏合、每种图片／字体格式、多张大型图集、动态素材／复杂动画视觉保真、Safari 独立模式或正式旧记录迁移。原引擎对应操作路径继续保留，这些检查仍须在正式验收前完成。

截图与导出样本位于[设计临时目录](../../.scratch/web-ui-redesign)。临时浏览器检查脚本位于已忽略的 `.playwright-cli/` 目录。最终仓库检查与源码保留对照见[验证结果](prototype-validation.json)。

[视觉方向票](../../.scratch/web-ui-redesign/issues/03-visual-direction.md)继续等待用户评审；本次交付不代表视觉方案已获认可或开始产品部署。

## Lottie 任务面板评审

2026-10-18 用户选择任务标签：图集优化／播放设置／项目记录，资源对比与 ZIP 导出在独立的面板底部保持可见。全部任务面板保持挂载，标签切换保留编辑值和高级选项状态。方向键及 Home／End 在任务标签间导航，不切换原型方向。导入、示例和清空共用一个项目工具行；项目信息替代重复工具标题。该选择确认了这一组织方式，不代表 Lottie 整页视觉设计已最终通过。

专项检查覆盖三个标签在 1440／390、亮暗主题下的布局，滚动时指标／导出常驻、参数保留、命名记录跨刷新、记录标签下真实 ZIP 下载，以及手机画布／图集／播放。导出包包含 `data.json` 和 `atlas-1.png`。前文关于其他引擎／格式／设备的验收边界继续有效。

## Lottie 工具栏与图集位置评审

用户否定任务标签旁的载入状态，以及文件信息／重置／视图控件的分散摆放。该状态描述整个项目，并不属于相邻的项目记录标签，现已移除。导入／导出／优化过程反馈与错误仍由原有内容层呈现。工具栏现为一条对齐的横行：文件操作、项目信息、重置／边界／背景／图集控件。重置占据稳定位置，不再在操作后另行浮出。背景选择器从对应控件下方展开。

图集位置提案将常驻左下角的横条改为工具栏入口。桌面展开时，浮动查看器位于工具栏右侧下方、邻近优化面板，并提供关闭操作。独立图集平移／缩放／重置、多图查看和原始数据继续保留。手机仍由“图集”视图进入，桌面展开状态不会覆盖画布或参数视图。素材消息放在播放条上方，与工具栏和图集入口分开。本提案仍待视觉评审。

检查覆盖 1440／1024／768／701／700／390／320 宽度的按钮对齐与视口边界、十个桌面／手机亮暗视图、图集开关与定位、独立视图操作、原任务标签、命名记录刷新／恢复／删除、真实 ZIP 导出，以及缺图警告与有效项目恢复。这些检查不替代前文更广泛的验收边界。

## Lottie 左侧面板与紧凑播放条

用户要求侧边面板移到左侧，并缩短、重新摆放播放进度条。桌面的三个任务标签、设置、资源对比与导出现位于左侧浮动面板。项目工具栏排列在其右侧的可用工作区，图集查看器仍从工具栏右端下方展开。动画在这块可用预览区域内适配并居中，初始内容不被移位后的面板挡住。画布背景继续贯通浮动界面背后。

播放条在该预览区下方居中，桌面最大 440px，手机最大 320px，空间不足时继续收窄。播放、小数帧定位与帧数的含义保持不变。已检查 320 到 1440 的七档宽度、十份桌面／手机亮暗截图、定位／播放／暂停／重置、图集入口和手机导出可见性，无页面运行错误或溢出。此前更广泛的验收边界继续有效。

根据用户进一步要求，桌面面板由 280px 收至 240px。工作区偏移和播放条居中跟随同一个宽度值。资源指标保留全部前后数值，窄桌面面板中采用标签在上、数值在下的排列；手机继续使用响应式面板宽度。

## 共享页头修正

用户报告工具菜单被 Lottie 工具栏覆盖，要求返回首页位于左侧，并指出 GitHub 错用了外链箭头。指针命中检查复现菜单问题：URL／帧动画链接部分区域命中了画布工具栏。共享 F 页头现高于浮动画布控件，打开模态弹窗时退到遮罩下方。菜单相对右侧导航组定位，窄屏也保持在视口内。返回首页位于左侧组首位；手机显示返回与工具标题，首页继续显示品牌。GitHub 复用站点现有 SVG，不增加依赖。

专项复现为 `.playwright-cli/prototype-header-repro.cjs`，修复前报告菜单链接被遮挡，修复后链接无遮挡。共享页头浏览器检查覆盖六工具、1440／390／320、亮暗主题，核对全部菜单行的指针命中、真实工具切换与返回首页、GitHub 图标／目标、首页目录保留，以及帧裁剪弹窗继续高于页头。本次修正原型行为，正式产品文件保持不变。

## Lottie 素材消息收进面板

消息现位于常驻面板底部、资源对比与导出上方。警告默认收起并显示数量，处理失败默认展开。完整详情继续可滚动查看，长路径换行。短屏限制展开高度，确保导出可见。切换任务标签保留展开状态。

手机存在问题时，用紧凑的消息／失败入口替代项目信息槽位，点击进入参数区、展开详情并聚焦标题。有效项目清除已解决消息并恢复项目信息。检查覆盖十四条长缺失资源消息、导入失败及恢复、1440x900／390x844／320x667 亮暗视图、十二份展开／收起截图与导出可见性。前文更广泛的验收边界继续有效。
