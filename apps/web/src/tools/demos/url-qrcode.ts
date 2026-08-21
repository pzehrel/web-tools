/**
 * 链接解析示例：OAuth 授权链接，redirect_uri 内嵌回调地址，回调里再嵌订单详情路径，外加 hash 路由。
 * 嵌套层级多，最能体现递归展开参数的价值。
 */
export const DEMO_URL = `https://auth.example.com/oauth/authorize?client_id=shop-web&response_type=code&redirect_uri=${
  encodeURIComponent(`https://shop.example.com/oauth/callback?next=${
    encodeURIComponent('/order/detail?id=1024&from=分享卡片')
  }`)
}&state=a1b2c3#/consent?source=banner`
