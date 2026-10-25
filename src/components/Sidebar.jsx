import React, { useState } from 'react';
import { House, Leaf, Settings2 } from 'lucide-react';
import ModelSettings from './ModelSettings.jsx';
import './assistantDock.css';

/** 全局助手入口：不再承载业务导航和历史对话。 */
export default function Sidebar({ ctx }) {
  const { route, setRoute, closeNav } = ctx;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const go = next => { setRoute(next); closeNav(); };
  return <><aside className="assistant-dock" aria-label="青禾助手入口">
    <button className="assistant-orb" aria-label="打开青禾助手"
      aria-pressed={route === 'assistant'} onClick={() => go('assistant')}>
      <Leaf size={30} strokeWidth={1.5}/>
      <span aria-hidden="true">AI</span>
    </button>
    {route === 'overview' && <div className="assistant-greeting">
      <strong>我是青禾助手</strong>
      <p>有什么能帮到你？</p>
    </div>}
    {route !== 'overview' && <button className="assistant-home" aria-label="返回概览"
      onClick={() => go('overview')}><House size={20}/></button>}
    {ctx.backendMode && <button type="button" className="model-settings-trigger" aria-label="模型设置" title="模型设置"
      aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><Settings2 size={20}/></button>}
  </aside>{settingsOpen && <ModelSettings onClose={() => setSettingsOpen(false)}/>}</>;
}
