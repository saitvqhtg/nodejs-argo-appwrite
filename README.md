# nodejs-argo-appwrite

## 部署

- 到appwrite官网创建账号
- 部署一个 `sites`
- fork 本仓库并链接仓库
- 框架: 选 `other`
- 安装命令: `npm install`
- 构建命令: `npm run build && npm run start`
- 设置环境变量
  - UUID
  - ARGO_DOMAIN
  - ARGO_AUTH
  - NEZHA_SERVER
  - NEZHA_KEY

## 保活

运行仓库的工作流，默认15分钟运行一次，需要以下 action 仓库机密

- APPWRITE_PROJECT_ID: 项目ID
- APPWRITE_SITE_ID: 站点site的ID
- APPWRITE_API_KEY: api key，创建时勾选所有权限
- GIT_TOKEN: 仓库个人访问令牌
