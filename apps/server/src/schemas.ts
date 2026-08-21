import { z } from 'zod'

/** 请求侧校验 schema（响应侧不做运行时校验，见 docs/BACKEND.md 版本配对决策） */

export const toolQuerySchema = z.object({
  tool: z.string().min(1).max(64),
})

export const idParamSchema = z.object({
  id: z.string().min(1).max(64),
})

/** multipart 表单：file 与 payload 二选一的约束在 handler 里判（zod 表达不了跨字段） */
export const saveFormSchema = z.object({
  toolId: z.string().min(1).max(64),
  id: z.string().min(1).max(64).optional(),
  payload: z.string().optional(),
  mimeType: z.string().min(1).max(128).optional(),
  meta: z.string().optional(),
  file: z.instanceof(File).optional(),
})

export type ToolQuery = z.infer<typeof toolQuerySchema>
export type IdParam = z.infer<typeof idParamSchema>
export type SaveForm = z.infer<typeof saveFormSchema>
