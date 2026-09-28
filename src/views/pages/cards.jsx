import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, ListFilter, Snowflake, Sun } from 'lucide-react';
import { Page, Panel } from '../parts.jsx';
import { EyeIcon } from '../shared.jsx';
import { buildCards, enrich, isHydrated } from './cardData.jsx';
import { cycle, summary } from './cardUtils.jsx';
import { CardActivity, CardCycle, CardFacts, ChannelBoard, LimitMeter, LimitRows, StatusHistory } from './cardProfile.jsx';
import { CardFace } from './cardFace.jsx';
import { CardFreezeSheet, FreezeNotice } from './cardFreeze.jsx';

/**
 * 卡片与卡包。
 *
 * 先想清楚「打开这一页想确认什么」，再决定放什么：
 *   ① 现在该刷哪张卡   → 卡包横向排列，选中的浮起并抬起视线
 *   ② 哪张卡不能用了   → 冻结卡在卡包里就是另一套材料（暗面 + 磨砂 + 徽标 + 下沉）
 *   ③ 还能花多少、什么时候还 → 额度尺（针 / 块 / 尺度）+ 账期条
 *   ④ 最近的账对不对   → 这张卡自己的明细 + 本期小结
 *
 * 「标签：值」那一版档案行已经拆掉：能用图标 + 数值说清的不写标签，能画成条的不写句子。
 * 剩下的界面文案只有：可用额度、四个档案字段的类型、渠道开关、账户操作、时间线节点。
 *
 * 状态落点：**账本**。domain 的 seed() 只发两张卡，本页首次进入时把第三张卡与每张卡的
 * 完整档案补进 bank.cards（见 cardData.jsx 的 enrich）；之后冻结、渠道开关、限额调整
 * 全部走 ctx.setBank 一次回写 —— 概览页读的是同一份账本，卡片状态因此会同步。
 */
export default function Cards({ ctx }) {
  const { bank, setBank, setToast } = ctx;
  const [selected, setSelected] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState(null);      // null | { action, phase }

  /* 一次性把初始档案补齐到账本：只补缺的卡位与缺的字段，已经写进去的状态原样保留。
     「重置演示数据」会 seed() 出一份没有档案的账本，再进本页会自动重新补齐。 */
  useEffect(() => {
    if (bank.cards.length !== 3 || !bank.cards.every(isHydrated)) {
      setBank(prev => ({ ...prev, cards: enrich(prev.cards) }));
    }
  }, [bank.cards, setBank]);

  const cards = useMemo(() => buildCards(bank.cards), [bank.cards]);
  /* 账本补齐前的那一帧：页面骨架在，内容为空。 */
  if (!cards.length) return <Page title="卡片"/>;
  const i = Math.min(selected, cards.length - 1);
  const card = cards[i];
  const frozen = card.status === 'frozen';
  const info = cycle(card.profile);
  const stat = summary(card, info);
  const over = card.channels.reduce((s, c) => s + (c.on ? c.dayUsed : 0), 0) >= card.channels.reduce((s, c) => s + (c.on ? c.dayLimit : 0), 0);

  /* 三个写入口，全部落到账本里的那一张卡上 */
  const update = fn => setBank(prev => ({ ...prev, cards: prev.cards.map(c => c.id === card.id ? fn(c) : c) }));
  const toggleChannel = cid => update(c => ({
    ...c, channels: c.channels.map(x => x.id === cid ? { ...x, on: !x.on } : x),
  }));
  const setLimit = (key, value) => {
    const at = ['noPwd', 'perTxn', 'dayLimit'].indexOf(key);
    update(c => ({ ...c, limits: c.limits.map((v, k) => (k === at ? value : v)) }));
    setToast('限额已更新');
  };
  const commit = action => {
    const freeze = action === 'freeze';
    update(c => ({
      ...c,
      status: freeze ? 'frozen' : 'active',
      history: [...c.history, {
        date: '2026-09-26', title: freeze ? '冻结' : '解冻',
        note: freeze ? '由持卡人在手机银行发起，四个渠道同时停用' : '持卡人自助解冻，恢复冻结前的开关状态',
      }],
    }));
    setToast(freeze ? '已冻结' : '已解冻');
    setSheet({ action, phase: 'done' });
  };

  /* 顶部的状态提醒只在「真的有事」时出现 */
  const alert = frozen ? 'frozen' : over ? 'capped' : null;

  return <Page title="卡片"
    aside={<button className="chip chip--icon" aria-pressed={hidden}
      aria-label={hidden ? '显示卡号与金额' : '隐藏卡号与金额'}
      onClick={() => setHidden(v => !v)}><EyeIcon off={hidden}/></button>}>

    <div className="wallet" role="tablist" aria-label="卡包">
      {cards.map((c, k) => <CardFace key={c.id} card={c} hidden={hidden} selected={k === i}
        frozen={c.status === 'frozen'} tabIndex={k === i ? 0 : -1} onSelect={() => setSelected(k)}/>)}
    </div>

    {alert && <FreezeNotice card={card} isFrozen={frozen}
      onOpen={() => setSheet({ action: frozen ? 'unfreeze' : 'freeze', phase: 'confirm' })}/>}

    <div key={card.id} className="card-detail" role="tabpanel" aria-label={card.name + ' 档案'}>
      <h2 className="card-title">{card.name.replace('青禾', '')}<span>•• {card.tail}</span></h2>

      <Panel>
        <LimitMeter card={card} hidden={hidden}/>
        <CardCycle info={info} frozen={frozen}/>
        <CardFacts card={card}/>
      </Panel>

      <ChannelBoard card={card} frozen={frozen} onToggle={toggleChannel}/>

      <div id="card-limits" className="card-limits">
        <LimitRows card={card} onLimit={setLimit} say={setToast}/>
      </div>

      <div className="card-actions">
        <button className={'freeze-btn' + (frozen ? ' is-thaw' : '')}
                aria-label={frozen ? '解除冻结' : '冻结这张卡'}
                onClick={() => setSheet({ action: frozen ? 'unfreeze' : 'freeze', phase: 'confirm' })}>
          {frozen ? <Sun size={19}/> : <Snowflake size={19}/>}
          <b>{frozen ? '解冻' : '冻结'}</b>
        </button>
        <div className="action-grid">
          <button className="action-cell" onClick={() => document.getElementById('card-limits').scrollIntoView({ block: 'center', behavior: 'smooth' })}>
            <Gauge size={19} aria-hidden="true"/><b>调整限额</b>
          </button>
          <button className="action-cell" onClick={() => ctx.setRoute('bills')}>
            <ListFilter size={19} aria-hidden="true"/><b>全部流水</b>
          </button>
        </div>
      </div>

      <CardActivity card={card} stat={stat} hidden={hidden}/>

      <Panel><StatusHistory history={card.history}/></Panel>
    </div>

    {sheet && <CardFreezeSheet card={card} action={sheet.action} phase={sheet.phase}
      onConfirm={commit} onClose={() => setSheet(null)}/>}
  </Page>;
}
