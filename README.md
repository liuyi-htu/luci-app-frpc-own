# luci-app-frpc-own

使用现代 LuCI JavaScript API 编写的 OpenWrt frpc 客户端管理插件。
<img width="2522" height="1326" alt="image" src="https://github.com/user-attachments/assets/56ee222b-cc18-411d-a905-36aed64ce209" />
<img width="2558" height="1276" alt="image" src="https://github.com/user-attachments/assets/8ce2198b-0a90-4c79-95a0-aa55681d6041" />
<img width="2552" height="1282" alt="image" src="https://github.com/user-attachments/assets/8bfb12dc-cd8b-4af9-b910-935b0185709d" />
<img width="2558" height="1274" alt="image" src="https://github.com/user-attachments/assets/e3fd9cca-a15e-40ac-8f2b-bfcf71c16f3f" />

## 功能

- 查看、启动、停止 frpc，管理开机自启
- 通过 UCI 管理 TCP、UDP、HTTP、HTTPS、STCP、SUDP、XTCP、TCPMUX 代理
- 管理 STCP、SUDP、XTCP 访问者
- 编辑、校验并原子替换 frpc TOML 配置
- 查看和清空 frpc、更新日志
- 在线更新或上传 `frpc`/`tar.gz` 更新
- 运行中修改 UCI 配置由 procd reload trigger 自动应用；保存手动 TOML 时会停止并恢复服务

运行配置固定使用 `/var/log/frpc.log`。已有日志等级和保留天数会保留，缺失时使用 `info` 和 `3` 天。

## 目录结构

```text
Makefile
htdocs/
└── luci-static/resources/view/frpc/overview.js
root/
├── etc/
│   ├── config/frpc
│   └── init.d/frpc
└── usr/
    ├── libexec/
    │   ├── frpc-enforce-log
    │   ├── frpc-ui
    │   └── frpc-update
    └── share/
        ├── luci/menu.d/luci-app-frpc-own.json
        └── rpcd/acl.d/luci-app-frpc-own.json
```


## 文件位置

- UCI 配置：`/etc/config/frpc`
- UCI 生成的运行配置：`/var/etc/frpc.toml`
- 手动 TOML 配置：`/etc/frp-stack/frpc.toml`
- frpc 日志：`/var/log/frpc.log`
- 更新日志：`/var/log/update.log`

设备需要预先提供 `/usr/bin/frpc`。

## SDK 构建

将项目复制或链接到匹配目标的 SDK：

```sh
make -C /path/to/openwrt-sdk package/luci-app-frpc-own/compile V=s
```

构建产物位于 SDK 的 `bin/packages/<架构>/base/` 或对应 feed 目录。
