export const backendMode = import.meta.env.VITE_API_MODE === 'backend';

export async function api(path, body, headers = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Request': '1', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error('连接中断：请查询原操作结果后再继续。');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.detail?.message || (response.status === 422 ? '请求内容不符合要求，请检查金额和验证码。' : '后端暂不可用，请稍后重试。'));
    error.status = response.status;
    throw error;
  }
  return result;
}

export const binding = op => ({ revision: op.revision, params_hash: op.params_hash });
