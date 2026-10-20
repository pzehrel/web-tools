# 确定设计方案的完成标准与实现交接边界

ID: 06
Labels: wayfinder:grilling
Type: grilling
Status: open
Assignee: unassigned
Parent: ../map.md
Blocked by: 04, 05

## Question

什么证据足以说明重设计方案已经完整、得到用户认可，可以进入正式实现？

在[用代表工具验证工作台布局与主要操作链路](04-workbench-interaction.md)与[确定共享组件与交互状态的一致性规则](05-shared-interaction-system.md)之后，确定全站页面和关键状态的覆盖要求、代表任务的验证方式、桌面与小屏及亮暗主题的检查范围，以及方案交接时必须包含的原型、规范、未决问题和兼容性要求。

明确后续实现应验证的功能保留、SSG 水合、SEO、旧路由和本地数据约束；本票决定验收要求，不把规划期未执行的产品测试写成已通过。只有新出现的工具特例与状态决策全部解决、地图不再有待决事项时，才能宣告到达终点。

功能范围已由[全工具功能保留基线](../../../docs/ui-redesign/README.zh-CN.md)固定。验收方案按其功能 ID 关联新 UI 位置与运行检查，覆盖原型当前缺失的能力；不得把本次源码核查或原型截图当作正式实现回归通过。
