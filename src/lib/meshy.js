import { studioHeaders } from './studioKey'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function handle(res) {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.message || 'Meshy request failed')
  return data
}

export async function createPreviewTask({ prompt, artStyle = 'realistic', negativePrompt }) {
  const res = await fetch(`${API_BASE}/api/meshy/text-to-3d`, {
    method: 'POST',
    headers: studioHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt, artStyle, negativePrompt }),
  })
  return handle(res)
}

export async function refineTask(taskId) {
  const res = await fetch(`${API_BASE}/api/meshy/text-to-3d/${taskId}/refine`, {
    method: 'POST',
    headers: studioHeaders(),
  })
  return handle(res)
}

export async function getTaskStatus(taskId) {
  const res = await fetch(`${API_BASE}/api/meshy/text-to-3d/${taskId}`, { headers: studioHeaders() })
  return handle(res)
}

export async function pollUntilDone(taskId, { onProgress, intervalMs = 3000, timeoutMs = 300000 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const data = await getTaskStatus(taskId)
    onProgress?.(data)
    if (data.status === 'SUCCEEDED') return data
    if (data.status === 'FAILED' || data.status === 'CANCELED') {
      throw new Error(`Meshy task ${data.status.toLowerCase()}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Meshy task timed out')
}

export async function generateModel({ prompt, artStyle, negativePrompt, onProgress }) {
  const preview = await createPreviewTask({ prompt, artStyle, negativePrompt })
  const previewResult = await pollUntilDone(preview.result, {
    onProgress: (d) => onProgress?.({ stage: 'preview', ...d }),
  })

  const refine = await refineTask(previewResult.id)
  const refineResult = await pollUntilDone(refine.result, {
    onProgress: (d) => onProgress?.({ stage: 'refine', ...d }),
  })

  return refineResult
}
