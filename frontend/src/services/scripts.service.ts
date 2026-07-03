import apiClient from '@/lib/axios'
import type { Script, ClientContext, ScriptWithHook } from '@/types'

interface AllScriptsResponse {
  success: boolean
  count: number
  scripts: ScriptWithHook[]
}

interface GenerateScriptResponse {
  success: boolean
  script: Script
  durationMs: number
  note?: string
}

interface ScriptForIdeaResponse {
  success: boolean
  script: Script
}

export async function generateScript(
  ideaId: string,
  clientContext: ClientContext,
): Promise<Script> {
  const { data } = await apiClient.post<GenerateScriptResponse>('/api/scripts/generate', {
    ideaId,
    clientContext,
  })
  return data.script
}

export async function getAllScripts(): Promise<ScriptWithHook[]> {
  const { data } = await apiClient.get<AllScriptsResponse>('/api/scripts')
  return data.scripts
}

export async function getScriptForIdea(ideaId: string): Promise<Script | null> {
  try {
    const { data } = await apiClient.get<ScriptForIdeaResponse>(
      `/api/scripts/by-idea/${ideaId}`,
    )
    return data.script
  } catch (err) {
    const apiErr = err as { status?: number }
    if (apiErr.status === 404) return null
    throw err
  }
}
