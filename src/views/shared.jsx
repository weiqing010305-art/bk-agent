import React from 'react';
import { Clapperboard, Cloud, FileText, Music2, Repeat } from 'lucide-react';
import { avatarOf, TxAvatar } from './avatars.jsx';

/* 餐饮的图标与品类色调：**实现在 avatars.jsx，数据也只有那一份**（关键词表）。
   在这里转出去，是为了让"按店名出图标 / 出颜色"这条既有用法只有一个入口 ——
   概览动态、账单明细、卡片流水都从这里（或 CategoryIcon）取，不会各写一张表。
   diningLook 是语义优先、哈希兜底：星巴克认品牌色，海底捞认品类红，
   认不出品类的店名才落到哈希，且同一家店永远同一个结果。 */
export { diningIcon, diningLook } from './avatars.jsx';

/**
 * 产品层共用的视觉语言。
 *
 * 分类头像（形状系统 / 商户品牌色 / 类别兜底 / 周期徽标）全部搬到 avatars.jsx ——
 * 那是「同一笔餐饮在概览、账单、卡片页长得一样」这句话的唯一实现处。
 * 这里只留各页面真正共用的三件，抽象门槛遵 AGENTS.md §1（复用 ≥2 处）。
 */

/** 分类头像。签名不变：item = { name, category }，size 是图标边长。
    尺寸走 avatars.css 的默认值（桌面 40px / 移动 36px，§D.5），账单页与概览动态同一规格。 */
export const CategoryIcon = ({ item, size = 20 }) => <TxAvatar look={avatarOf(item)} iconSize={size}/>;

/* 订阅细分：按名字路由到不同的动效（云浮 / 光扫 / 律动），规则在 motion.css。
   动效的 key（cloud/video/music/read）与 .sub-row--* 绑定，改这里必须同时改那边。 */
export const SUB_KIND = [
  [/云|空间|网盘|iCloud|Drive|存储/i, 'cloud', Cloud],
  [/视频|影|剧|影视|Netflix/i, 'video', Clapperboard],
  [/音乐|听|歌|乐|Music/i, 'music', Music2],
  [/读书|阅|电子书|杂志/i, 'read', FileText],
];
export const subKind = name => SUB_KIND.find(([re]) => re.test(name)) || [null, 'subscribe', Repeat];

/** 金额 / 卡号显隐开关。概览主卡与卡片页共用。 */
export const EyeIcon = ({ off }) => off
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M6.7 6.7C4.6 8 3 10 3 12c1.5 3 5 5 9 5 1.3 0 2.6-.3 3.7-.7"/><path d="M9.9 5.2A9.8 9.8 0 0112 5c4 0 7.5 2 9 5-.5 1-1.2 1.9-2.1 2.7"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 12c1.5-3 5-5 9-5s7.5 2 9 5c-1.5 3-5 5-9 5s-7.5-2-9-5z"/><circle cx="12" cy="12" r="2.4"/></svg>;

/** 账单分类筛选 */
export const CATS = ['全部', '转账', '餐饮', '购物', '交通', '订阅', '收入'];
