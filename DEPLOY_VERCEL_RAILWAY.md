# Vercel + Railway 内测发布指南

本文档用于把当前项目发布成可邀请内测用户访问的测试版本。

## 1) 目标架构

- 前端：Vercel（静态站点，`apps/web`）
- 后端：Railway（Nest API，`apps/api`）
- 数据：Railway 持久化卷上的 SQLite（`/data/dev.db`）

> 说明：当前 Prisma schema 使用 SQLite。若后续切到 Postgres，再做单独迁移。

## 2) 部署后端（Railway）

1. 在 Railway 新建项目并连接此仓库。
2. 确保仓库根目录包含 `railway.json`（已提供）。
3. 在 Railway 项目里添加 **Volume**（挂载路径建议：`/data`）。
4. 配置环境变量：

   - `DATABASE_URL=file:/data/dev.db`
   - `ENCRYPTION_KEY=<32字节base64>`
   - `PORT=3002`（可不填，Railway 也会注入）
   - `CORS_ORIGIN=https://<你的vercel域名>`

5. 触发部署。启动命令会自动执行：

   - `prisma generate`
   - `prisma migrate deploy`
   - `node dist/main`

6. 记录生成的后端公网域名，例如：

   - `https://your-api-production-domain.railway.app`

## 3) 部署前端（Vercel）

1. 在 Vercel 导入同一仓库。
2. Vercel 会读取根目录 `vercel.json`（已提供）。
3. 设置前端环境变量：

   - `VITE_API_URL=https://your-api-production-domain.railway.app`

4. 触发部署，拿到前端域名（例如 `https://xxx.vercel.app`）。
5. 回到 Railway，把 `CORS_ORIGIN` 更新为这个前端域名，重新部署后端一次。

## 4) 发布前自检清单

- 打开前端首页是否正常加载
- 添加并验证交易所账户是否可用
- 同步任务能否完成（进度条能走完）
- 交易列表是否可滚动加载更多
- 日历与交易列表是否同步
- 删除账户是否正常

## 5) 给内测用户的建议说明

- 仅使用只读 API Key（不要开启提现）
- Binance 需要合约读取权限（USDM）
- 网络无法访问 Binance 时，可先用 VPN/代理测试
- 如报错，提供截图 + 操作时间 + 账户类型（BINANCE/BYBIT）

## 6) 本地构建验证命令

```bash
npm -w apps/api run build
npm -w apps/web run build
```

