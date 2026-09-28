import React from 'react';
import { Check } from 'lucide-react';

/** Toast — 由 main.jsx 第 272 行抽取（补回被剥离的 toast 渲染守卫）。 */
export default function Toast({ toast }) {
  if (!toast) return null;
  return <div role="status" className="toast"><Check size={16}/>{toast}</div>;
}
