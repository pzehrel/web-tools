export type JsonValue = string | number | boolean | null | JsonContainer
export type JsonContainer = { [key: string]: JsonValue } | JsonValue[]

/** 只识别对象和数组，普通参数中的数字、布尔值仍按文本处理。 */
export function parseJsonContainer(text: string): JsonContainer | null {
  if (!/^\s*[[{]/.test(text))
    return null
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' ? value as JsonContainer : null
  }
  catch {
    return null
  }
}

/** 字符串字段保持文本语义；其余字段使用 JSON 字面量，保留数字、布尔和 null 类型。 */
export function parseJsonField(text: string, previous: JsonValue): JsonValue {
  if (typeof previous === 'string')
    return text
  return JSON.parse(text) as JsonValue
}

/** 使用自有属性重建对象，确保 __proto__ 等字段也能正常编辑。 */
export function replaceJsonField(container: JsonContainer, key: string, value: JsonValue): JsonContainer {
  if (Array.isArray(container))
    return container.map((item, index) => String(index) === key ? value : item)
  return Object.fromEntries(Object.entries(container).map(([name, item]) => [name, name === key ? value : item]))
}
