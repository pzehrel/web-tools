/** 身份模型：登录用户或匿名设备，二者必有其一（由 identity 中间件保证） */
export interface Identity {
  userId?: string
  deviceId?: string
}

export function identityOf(i: Identity) {
  if (i.userId)
    return { kind: 'user' as const, value: i.userId }
  return { kind: 'device' as const, value: i.deviceId! }
}
