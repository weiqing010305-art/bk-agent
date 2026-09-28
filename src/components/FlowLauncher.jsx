import React from 'react';
import { ArrowLeftRight, BarChart3, RotateCcw, Sparkles } from 'lucide-react';
import { SURFACES } from '../agent/planner.js';

const ICONS = { transfer: ArrowLeftRight, bills: BarChart3, subscriptions: RotateCcw, occasion: Sparkles };

/**
 * 常驻入口：**这个对话框现在能开的业务面**，不是导航菜单。
 *
 * 7 条减到 4 条，理由分三种，不是"看着多"：
 *  · 定时转账 / AA 收款 —— 点下去开不出来。runAction() 直达 planner 的 BUILDERS，
 *    而这两个 id 在 BUILDERS 里没有条目，于是落到 unknown 面，把同一排业务又画了一遍。
 *    一个说了做不到的入口比没有入口更糟。它们本来就活在转账第一步里（那里有「预约转账」「AA 收款」），
 *    在对话框里说「下个月 1 号自动给房东转房租」也能走到同一条路。
 *  · 卡片 —— 与左侧导航同名同义，是一次状态查看，不是这次对话里的一件事。
 *  · 留下的四条各自代表一类：钱怎么动、钱花在哪、钱被谁扣、日子怎么过。
 *
 * 没有标题 —— 一排带图标的按钮紧贴输入框，位置本身就说明了它是什么（用位置代替文字指引）。
 * 也没有「4 步」：那是流程内部的事，流程自己会用进度条说。
 */
const KEEP = ['transfer', 'bills', 'subscriptions', 'occasion'];

export default function FlowLauncher({ ctx }) {
  const { startTransfer, runAction, busy } = ctx;
  return <div className="launcher" role="group" aria-label="常用业务">
    <div className="launcher-row">
      {SURFACES.filter(s => KEEP.includes(s.id)).map(s => {
        const Icon = ICONS[s.id] || ArrowLeftRight;
        return <button
          key={s.id}
          className="flow-chip"
          disabled={busy}
          onClick={() => (s.id === 'transfer' ? startTransfer() : runAction(s.id))}
        >
          <i aria-hidden="true"><Icon size={13}/></i>
          {s.label}
        </button>;
      })}
    </div>
  </div>;
}
