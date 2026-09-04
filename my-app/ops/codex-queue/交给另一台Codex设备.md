# 把当前项目交给 Ubuntu Codex 任务池

把这份文件直接交给另一台设备上的 Codex。你要做的是按顺序检查、接入并验收；不要索取、显示、粘贴或记录用户的账号密码、Cookie、API key 或 `auth.json` 内容。

## 已有环境

- 家庭服务器：`frankrain@192.168.110.49`
- 局域网任务池：`https://192.168.110.49:3443/codex-queue/`
- Ubuntu 项目根目录：`/home/frankrain/server/automation-workspaces`
- 任务池程序：`/home/frankrain/server/apps/codex-queue`
- 每个 Codex 账号拥有独立 `CODEX_HOME`，任务在一次性 Docker 容器中执行。
- 网页不要求账号密码；它只适用于受信家庭局域网。不要把 3765 端口或这个入口转发到公网。

## 你要完成的接入

1. 在当前设备确认项目是 Git 仓库，记录项目名称、默认分支和 `git remote get-url origin`。先保留所有未提交工作；禁止 `git reset --hard` 或覆盖用户修改。
2. 为当前 Codex 账号选择一个不含个人信息的英文标识，例如 `account-two`。在任务池网页新增账号槽位，或执行：

   ```bash
   ssh frankrain@192.168.110.49 "python3 /home/frankrain/server/apps/codex-queue/codex_queue.py --db /home/frankrain/server/data/codex-queue/queue.sqlite account-init account-two '第二个 Codex 账号'"
   ```

3. 用官方 device-auth 完成一次登录。这一步只会让用户在 OpenAI 页面确认一次，不会让任务池读取密码：

   ```bash
   ssh -t frankrain@192.168.110.49 "/home/frankrain/server/apps/codex-queue/account-login.sh account-two"
   ```

   不要自动复制本机 `auth.json`。官方文档把它视为与密码同等敏感；只有用户明确要求迁移缓存时，才能走安全复制流程。

4. 确保当前分支已经推送到 GitHub，且 Ubuntu 主机有权读取和推送该仓库。然后用一个英文项目标识把仓库克隆并登记。例如：

   ```bash
   ssh frankrain@192.168.110.49 "/home/frankrain/server/apps/codex-queue/register-project.sh my-project '我的项目' 'https://github.com/OWNER/REPO.git' master"
   ```

   如果是私有仓库但 Ubuntu 没有 GitHub 权限，停止并明确告诉用户需要为服务器配置只覆盖这个仓库的 deploy key；不要收集 GitHub 密码。

5. 打开任务池网页，选择刚才的“执行账号”和“项目”，填写目标、验收条件、不能改动的范围与首次执行时间，然后加入任务池。也可以从当前设备调用同一局域网 API，但请求体中只能包含任务文字、账号标识、项目标识、时间和可选的 Codex 会话 ID。
6. 验收：刷新网页，确认账号为“已就绪”、项目出现在下拉框、任务绑定了正确账号与项目。任务执行后检查日志、Git 提交、远端分支和项目自己的测试结果。

## 任务池的判断规则

- 成功：验证通过，生成提交并推送；循环任务按设定时间继续。
- 额度不足：等到下一个周期，不反复消耗。
- 需要用户决定、测试失败、Git 冲突或推送失败：暂停为“需要你处理”。
- worker 只读取当前项目代码；不允许扫描浏览器、键鼠输入、其他账号目录或家庭服务器上的无关文件。

完成后向用户只报告：账号标签、项目、下一次运行时间、测试/推送结果和需要用户决定的事项。不要回显任何认证材料。
