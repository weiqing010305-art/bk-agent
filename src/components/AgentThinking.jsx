import React from 'react';
import { LoaderCircle } from 'lucide-react';

export default function AgentThinking() {
  return <div className="agent-thinking" role="status" aria-label="思考中">
    <LoaderCircle size={20} className="agent-thinking-icon" aria-hidden="true"/>
    <span>思考中</span>
    <span className="agent-thinking-dots" aria-hidden="true"><i/><i/><i/></span>
  </div>;
}
