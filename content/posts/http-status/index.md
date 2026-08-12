---
title: "Cookie Session Token JWT 这些事儿"
date: 2026-08-12T22:18:52+08:00
lastmod: 2026-08-12T22:20:44+08:00
draft: false
status: "evergreen"
topic: "networks"
categories: ["计算机网络"]
tags: ["安全"]
series: ["计算机网络基础"]
seriesOrder: 2
featured: false
summary: "本文通过对比Cookie、Session、Token和JWT四种身份认证机制，解析HTTP无状态协议下如何证明用户身份的核心问题，并给出各自适用场景与实现流程。"
related: []
---

## 为啥要有这四个？

HTTP 是**无状态协议**，需要解决：**用户登录成功之后，后续请求怎么证明我还是刚才的用户**

| 名词    | 本质                             | 放在哪里 | 谁保存状态         |
| ------- | -------------------------------- | -------- | ------------------ |
| Cookie  | 浏览器存储并自动携带的一小段数据 | 浏览器   | 不一定             |
| Session | 服务端保存的一份用户状态         | 服务端   | 服务端             |
| Token   | 客户端携带的访问凭证             | 客户端   | 看设计             |
| JWT     | 一种自包含、可签名的 Token 格式  | 客户端   | 通常服务端不存状态 |



## Cookie

### 定义和过程

Cookie 是服务器通过 `Set-Cookie` 响应头发给浏览器的一段键值数据，浏览器保存后，后续匹配域名和路径的请求会自动带上对应 Cookie 给服务器

具体过程：

![image-20260812143505045](20260812143509359.png)

### Cookie 本身不是登录状态，只是一个存储和传输机制

Cookie 里可以放：

```text
sid=abc123
theme=dark
language=zh-CN
tracking_id=xxx
```

真正决定你是否登录的，不是 Cookie 这个技术，而是 Cookie 里放了什么。

比如：`Cookie: session_id=abc123`，服务器拿到 `session_id=abc123`，再去存储设备里查找：`abc123 -> user_id=1111`，这时候才知道你是谁

### Cookie常见属性

```http
Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

| 属性              | 作用                                                  |
| ----------------- | ----------------------------------------------------- |
| HttpOnly          | JS 不能通过 `document.cookie` 读取，降低 XSS 窃取风险 |
| Secure            | 只在 HTTPS 下发送                                     |
| SameSite          | 控制跨站请求是否携带 Cookie，缓解 CSRF                |
| Max-Age / Expires | 控制 Cookie 过期时间                                  |
| Domain / Path     | 控制 Cookie 对哪些域名、路径生效                      |

### 使用场景

适合：

- 传统 Web 网站登录
- 浏览器网页状态保存
- 购物车
- 语言偏好

比如 B 站、知乎，浏览器登录后，后续请求自动带 Cookie，体验很自然



## Session

### 定义和过程

Session 是**服务器为每个登录用户保存一份状态，然后给客户端一个随机 ID。**

服务器里大概长这样：

```text
session_id = abc123

Redis:
abc123 -> {
  user_id: 10086,
  username: "zhangsan",
  role: "admin",
  expire_at: ...
}
```

客户端只保存：

```go
Cookie: session_id=abc123
```

注意：**Web 应用通常使用 Cookie 来交换 Session ID；Session ID 本身应该足够随机，避免被猜到**

完整流程：

1. 用户提交账号密码
2. 服务器校验成功
3. 服务器生成一个随机 session_id
4. 服务器把 session_id -> user_id 存到 Redis
5. 服务器通过 Set-Cookie 把 session_id 发给浏览器
6. 浏览器后续自动携带 session_id
7. 服务器根据 session_id 查 Redis，确认用户身份

类比一下：浏览器只拿钥匙编号：`abc123`，服务器保存钥匙编号对应的主人：`abc123 -> 用户1111`

![image-20260812143530993](20260812143532773.png)

Session 的核心是：**状态在服务器，客户端只拿一个 ID。**

### Session 的优缺点

**适合传统 Web：**

1. 服务端可控
2. 可以主动踢用户下线
3. 可以修改权限后立即生效
4. 可以在 Redis 里统一管理过期时间
5. Cookie 自动携带，前端不用手动处理

缺点也很明显：

1. 服务器要存状态
2. 分布式部署时需要共享 Session
3. Redis 挂了可能影响登录态
4. 跨端、开放 API、移动端不如 Token 灵活

比如有 10 台后端机器：

```text
用户第一次请求打到 A 机器，Session 存在 A
第二次请求打到 B 机器，B 不知道这个 Session
```

解决方式是 Session 统一存到 Redis 中管理，Redis 是共享存储：

```text
             ┌── A ──┐
用户 → 	   |        ├──> Redis
             └── B ──┘
                    session_123 → userId=1001
```

### 使用场景

适合：

- 传统浏览器网站
- 后台管理系统
- 权限要求强、需要随时踢下线的系统
- 登录状态强依赖服务端控制的系统

比如企业管理后台、银行后台



## Token

### 定义和流程

Token 是**用户登录成功后，服务器发给客户端一个访问凭证，客户端后续请求时带上这个凭证。**

这是常见的请求方式：

```http
Authorization: Bearer xxxxx
```

Bearer 的意思是“谁持有这个令牌，谁就可以使用它”，所以它必须通过 HTTPS 等方式保护，避免泄露。

Token 可以是：

- 随机字符串：abc123xyz
- JWT：header.payload.signature
- 自定义加密字符串
- OAuth access token

所以，**Token 是大类，JWT 是 Token 的一种实现格式。**

以下是具体流程：

1. 用户登录
2. 服务器校验账号密码
3. 服务器生成 token
4. 返回给客户端
5. 客户端保存 token
6. 后续请求在 Header 里带上 token
7. 服务端校验 token
8. 校验通过，允许访问资源

例如：

```http
GET /api/user/profile
Authorization: Bearer eyJhbGciOiJIUzI1Ni...
```



### Token 分类

**Opaque Token：不透明 Token**

是一串看不懂的字符串：`a8f9x2kls02mx92`，客户端看不懂，服务器也不能单凭借这个直接知道用户是谁，必须查数据库或者 Redis，找到具体 Token 对应的用户 ID。它很像 Session ID，本质上还是服务端保存状态

**Self-contained Token：自包含 Token**

里面直接携带用户信息，比如 JWT：

```JSON
{
  "user_id": 10086,
  "role": "admin",
  "exp": 1720000000
}
```

服务器只要验证签名和过期时间，就能知道用户是谁。



### 使用场景

Token 适合：

- 前后端分离
- 移动 App
- 小程序
- 开放 API
- 第三方授权



## JWT

### 定义和结构

JWT 全称是 JSON Web Token，是**一种紧凑的、URL 安全的令牌格式，用来在双方之间传递一组 JSON 声明**

这是 JWT 的结构：`Header.Payload.Signature`，头部、载荷、签名

Header 描述**这个 JWT 用什么算法签名：**

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

Payload 描述**用户信息和过期时间：**

```json
{
  "sub": "10086",
  "name": "zhangsan",
  "role": "admin",
  "exp": 1720000000
}
```

Signature **防止篡改：**

比如服务端使用密钥签名：

```go
signature = HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

用户可以看到 Payload，但不能改。因为一改 Payload，签名就对不上。

需要注意：**JWT 不是加密，是签名**

> JWT 默认只是 Base64URL 编码 + 签名，不等于加密。Payload 通常是可以被解码看到的，所以不要放密码、身份证号、手机号完整明文等敏感信息

### 具体流程

服务端收到 JWT 之后，会做：

1. 拆成 Header、Payload、Signature
2. 根据 Header 确认签名算法
3. 用服务端密钥重新计算签名
4. 比较签名是否一致
5. 检查是否过期、检查相关字段声明是否合法
6. 通过后认为用户身份可信



### 优缺点

JWT 的最大优势是：**服务端可以不保存登录状态：因为用户信息、过期时间、权限信息全在 JWT 中，服务端验证签名即可**

适合：

- 前后端分离
- 微服务网关
- 开放 API
- 跨服务传递身份信息

比如：

```text
用户请求网关 -> 网关验证 JWT -> 转发给订单服务
订单服务也能从 JWT 里拿 user_id
```



JWT 的缺点是：**一旦签发，在过期前默认很难主动失效。**

比如用户退出登录、修改密码、账号被封，如果你完全不查服务端状态，那么已经发出去的 JWT 在过期前仍然可能有效。

解决办法：

- 退出登录，JWT 还能用：给 JWT 加一个唯一 ID `jti`，用户退出登录，把`jti`放入 Redis 黑名单，之后每次请求都要查询黑名单
- 修改密码，封禁账号，JWT 还能用：给 JWT 加一个版本号，用户改密码，就把版本号加一



## 总结

### Cookie + Session 方案

![Cookie+Session](20260812151615877.png)

核心是：**客户端只拿 ID，服务端保存状态**

### Token 方案

![Token方案](20260812152338253.png)

核心是：**客户端拿访问凭证，服务端校验凭证**

### JWT 方案

![JWT 方案](20260812152415703.png)

核心是：**Token 自己携带信息，服务端靠签名校验真假**



### 一句话总结

Cookie 是浏览器自动携带数据的机制；Session 是服务端保存登录状态，通常用 Cookie 保存 session_id；Token 是客户端携带的访问凭证，适合 API 和前后端分离；JWT 是一种自包含、带签名的 Token，优点是服务端可以少存状态，缺点是主动失效比较麻烦。传统 Web 常用 Cookie + Session，前后端分离和移动端常用 Token，微服务和 SSO 场景常用 JWT。
