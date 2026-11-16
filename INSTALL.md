# 过年倒计时插件 · 安装说明

给 DeepSeek Harness 加一个「倒计时」入口：左侧栏底部显示距除夕还有多少天，点开是每秒跳动的倒计时面板。

需要的东西：`dsh-spring-countdown-0.2.0.tgz` 这一个文件（18 KB）。

---

## 前提

已经装了 **DeepSeek Harness 桌面端**，并且**打开过一次**（第一次打开会初始化 `desktop` profile，插件要装进这个 profile 里）。

## 安装

把 `dsh-spring-countdown-0.2.0.tgz` 放到任意目录，在该目录打开终端，执行：

```bash
dsh plugin --profile desktop add ./dsh-spring-countdown-0.2.0.tgz
```

看到 `+ dsh-spring-countdown 0.2.0` 就是装好了。

**然后完全退出桌面端再重新打开**（⌘Q 退出，不是关窗口）。配置层变更不会热重载。

## 确认成功

侧栏底部、设置按钮上方会出现「倒计时 84天」，点开是倒计时面板。

想用命令行确认：

```bash
dsh desktop --dump-config | grep dsh-spring-countdown
```

出现 `# == dsh-spring-countdown` 这行就说明插件层已生效。

## 升级

装过旧版的话，直接拿新 tgz 再执行一次同样的 `add` 覆盖即可，不用先卸载：

```bash
dsh plugin --profile desktop add ./dsh-spring-countdown-0.2.0.tgz
```

装完同样要重启桌面端。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-spring-countdown
```

同样需要重启桌面端。

---

## 遇到问题

**`dsh: command not found`**

桌面端安装时会在 `/usr/local/bin/dsh` 建一个软链。如果没有，直接用完整路径：

```bash
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add ./dsh-spring-countdown-0.2.0.tgz
```

**`profile "desktop" does not exist`**

先手动打开一次桌面端，让它把 profile 初始化出来，再执行安装。

**装完侧栏没出现**

1. 确认是完全退出后重启（⌘Q），不是只关窗口。
2. 跑上面那条 `--dump-config` 确认插件层在。
3. 侧栏如果被折叠成窄条，入口只显示灯笼图标，鼠标移上去有提示。

**天数比预期多/少一天**

面板按本机时区算当地日历日。如果人在海外，天数会按当地日期算 —— 这是有意的，不是 bug。模型工具支持传 `timezone`（如 `America/New_York`）。

**年份超出 2050**

插件内置 2000–2050 的春节日期表，超出会明确报错而不是瞎猜。

---

## 说明

- 只支持一个插件版本，装在 `desktop` profile 下；不用它不影响桌面端任何其他功能，随时可卸。
- 春节日期以 lunar-javascript 为准，并与国务院办公厅 2027 年放假通知交叉校验过（2027-02-05 除夕、2027-02-06 正月初一）。只有 2027 年的假期天数是官方数据，其他年份按「除夕至初七」估算，面板会标注。
- 不发 npm、不走网络，装的就是这个 tarball 里的代码，可以直接解开看。
