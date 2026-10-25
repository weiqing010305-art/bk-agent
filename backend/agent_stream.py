"""Stream validated user-facing replies, never private model reasoning or raw slots."""
import json
import time
from fastapi import HTTPException
from fastapi.responses import StreamingResponse


def event(kind, payload):
    return f"event: {kind}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def stream_reply(process):
    def generate():
        yield event('thinking', {})
        try:
            task = process()  # Existing ownership, extraction, validation and commit.
            message = task['message']
            for offset in range(0, len(message), 2):
                yield event('delta', {'text': message[offset:offset + 2]})
                time.sleep(0.025)
            yield event('complete', task)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            yield event('error', {'status': exc.status_code, 'code': detail.get('code'),
                'message': detail.get('message', '处理失败，请重试。')})
        except Exception:
            yield event('error', {'status': 503, 'message': '连接中断，请重试或查看原任务。'})
    return StreamingResponse(generate(), media_type='text/event-stream', headers={
        'Cache-Control': 'no-cache, no-store', 'X-Accel-Buffering': 'no',
    })
