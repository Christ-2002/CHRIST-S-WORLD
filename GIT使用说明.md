# Git 使用与多人协作说明（CHRIST'S WORLD）

仓库地址（公开，任何人都能看）：
**https://github.com/Christ-2002/CHRIST-S-WORLD**

本机已完成：Git 身份配置、GitHub 登录授权（账号 Christ-2002）、首次提交与推送。
以后本地改完文件，按下面的流程提交即可，不需要再配置。

---

## 一、PyCharm 里确认 Git（一般已自动识别）

1. 菜单 **File → Settings → Version Control → Git**
2. 「Path to Git executable」应为 `D:\Git\cmd\git.exe`，点右边 **Test**，能显示版本号即正常。
3. （可选）**Version Control → GitHub** 里点 `+` → Log In via GitHub，用 Christ-2002 登录一次；
   不登录也不影响提交推送（命令行授权已保存在 Windows 凭据管理器里）。
4. PyCharm 打开 Web 文件夹后会自动识别为 Git 仓库，文件名颜色变化、底部出现 Git 选项卡即正常。

## 二、日常改完网站怎么提交（PyCharm 图形操作）

每次修改的标准三步：

1. **先拉取别人的更新**：快捷键 `Ctrl + T`（或菜单 Git → Update Project），点 OK。
   多人协作时养成「开工前先拉取、提交前再拉取」的习惯，减少冲突。
2. **提交**：`Ctrl + K` 打开 Commit 窗口，勾选要提交的文件，写一句改动说明
   （例如「新增马里奥第一关」），点 Commit 旁边的小箭头选 **Commit and Push…**。
3. **推送**：弹出 Push 窗口直接点 **Push**，文件就上传到 GitHub 了。

只 Commit 没 Push 时改动只在本机；Push 之后别人才能在 GitHub 上看到、拉取到。

文件名颜色：蓝色＝改过、绿色＝新增、红色＝未跟踪（新文件记得勾选）。

## 三、命令行方式（不用 PyCharm 时）

在 Web 文件夹里打开终端：

```bash
git pull                       # 拉取最新
git add -A                     # 暂存全部改动
git commit -m "改了什么"        # 提交到本地
git push                       # 推送到 GitHub
```

## 四、邀请别人一起写网站

1. 打开 https://github.com/Christ-2002/CHRIST-S-WORLD/settings/access
2. **Add people** → 输入对方的 GitHub 用户名 → 发送邀请。
3. 对方在邮箱通知或仓库页面接受邀请后，就拥有直接推送权限。

对方第一次拿到项目（在他自己电脑上）：

- PyCharm：欢迎页 **Get from VSS / Get from VCS**，粘贴
  `https://github.com/Christ-2002/CHRIST-S-WORLD.git`，选本地文件夹，Clone。
- 或命令行：`git clone https://github.com/Christ-2002/CHRIST-S-WORLD.git`
- 对方电脑上也要执行一次（换成他自己的 GitHub 名字和邮箱）：
  ```bash
  git config --global user.name "他的用户名"
  git config --global user.email "他的邮箱"
  ```
- 之后同样按「拉取 → 修改 → 提交 → 推送」协作。

> 不想给直接推送权限的人，可以让他 Fork 仓库后改完发 Pull Request，你在网页上审核合并。

## 五、提交冲突怎么办

两个人改了同一个文件的同一处，Push 时会报冲突：

1. PyCharm 弹窗选 **Merge**；
2. 三栏对比里决定保留哪边的内容（左＝你的、右＝别人的、中间＝结果），逐个点 `>>` / `X`；
3. 保存后 Apply，再 Commit and Push。
小项目里只要养成「改之前先 Pull」，基本不会冲突。

## 六、网络与代理（重要）

- 本机已配置：**只有访问 github.com 时走 NekoBox 代理（127.0.0.1:2080）**，不影响 Gitee 等其他网站。
- 所以 **Push / Pull 前请确认 NekoBox 已开启**；没开代理时 GitHub 连接可能被重置，打开代理重试即可。
- 以后换代理软件或端口变了，更新命令：
  ```bash
  git config --global http.https://github.com.proxy http://127.0.0.1:端口号
  ```
- 想取消代理：`git config --global --unset http.https://github.com.proxy`

## 七、备注

- `.gitignore` 已忽略：`.idea/`（PyCharm 个人配置）、`_shots/`（自检截图）、临时调试文件。
  这些不会上传，每个人的 PyCharm 配置互不影响。
- 之前在 huaziHz 账号下建的空仓库（huaziHz/CHRIST-S-WORLD）已无用：
  如果是你的号，登录后在该仓库 Settings 最底部 Delete repository 删除即可；是朋友的号则不用管。
- 想在手机/别人电脑直接玩而不只是看代码：GitHub 只能托管代码，不能直接运行网页；
  要做成点链接就能玩的网站，下一步可开通 GitHub Pages（仓库 Settings → Pages，选 main 分支根目录），
  开通后访问 `https://christ-2002.github.io/CHRIST-S-WORLD/` 即可，免费、不用备案。
