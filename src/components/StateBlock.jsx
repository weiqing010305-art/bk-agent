import React from 'react';
import { TriangleAlert } from 'lucide-react';
import '../styles/state.css';

/**
 * 空 / 错 / 加载 —— 三态的唯一实现。
 *
 * 口径照众安银行**真实上线**的字串表（doc/research/za-design-and-wealth.md §A.4）：
 *   空：`[4 字状态] + [1 个按钮回主路径]`，**不写「你可以试试…」这类引导句**
 *       （ZA 原文：頁面不見了 / 暫無任務，盡請期待 / 檔案不存在 / 暫無記錄）
 *   错：`[拟人化短标题] + [错误码独立一行] + [1 个动作]`，**不解释技术原因**
 *       （ZA 原文：服務器開小差了 / 錯誤碼：{code} / 刷新）
 *   载：**零文字**。887 条 i18n 里与加载有关的只有 3 条，且全部与 PDF 文件有关 ——
 *       常规加载不占文案预算，形态自己说明自己。
 *
 * 插画按报告 §A.5 不引入：ZA 的 105 条图片资产里 70+ 投给了抽奖领奖，常规空态只有 1 张。
 * 这里只用一枚 44px 的图标底座 —— 说的是「这里没有东西」，不是「我很伤心」。
 */

const reload = () => window.location.reload();

/** 空状态。title 是 4 字状态（≤6 字），action 是唯一那条出路。 */
export const Empty = ({ icon: Icon, title, action, onAction, children }) => (
  <div className="state" role="status">
    {Icon && <span className="state-mark" aria-hidden="true"><Icon size={20}/></span>}
    <p className="state-title">{title}</p>
    {children}
    {action && <button type="button" className="a2ui-btn a2ui-btn--secondary" onClick={onAction}>{action}</button>}
  </div>
);

/** 错误状态。code 是真实定位码（surface id / 页面 id）—— 报障时念的就是它。 */
export const Failed = ({ title = '页面开小差了', code, action = '刷新', onAction = reload }) => (
  <div className="state state--error" role="alert">
    <span className="state-mark" aria-hidden="true"><TriangleAlert size={20}/></span>
    <p className="state-title">{title}</p>
    {code && <p className="state-code">错误码：{code}</p>}
    <button type="button" className="a2ui-btn a2ui-btn--secondary" onClick={onAction}>{action}</button>
  </div>
);

/** 加载状态：一副骨架，一个字都没有。
 *  骨架与抖光的样式只有一份实现，在 styles/app.css 的 .surface-skeleton / .sk 里。 */
export const Loading = () => (
  <div className="surface-skeleton" role="status" aria-label="正在生成">
    <span className="sk sk--head"/>
    <span className="sk sk--line"/>
    <span className="sk sk--line sk--short"/>
    <span className="sk sk--line sk--short"/>
  </div>
);
