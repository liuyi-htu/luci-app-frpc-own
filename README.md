# luci-app-frpc-own

A modern LuCI application for managing the FRP client on OpenWrt and ImmortalWrt.

The main package defaults to English, including on systems with the base LuCI Chinese language package installed. Install the optional `luci-i18n-frpc-own-zh-cn` package to enable Simplified Chinese when LuCI uses Chinese. Both packages remain at version **2.0.0-r1**.

## Features

- Start and stop frpc and manage autostart.
- Manage TCP, UDP, HTTP, HTTPS, STCP, SUDP, XTCP, and TCPMUX proxies and private protocol visitors.
- Save authentication separately; save proxies and visitors in their own editors.
- View read-only runtime TOML. Opening the tab regenerates the preview from saved settings while stopped, and reads the active configuration while running.
- Disable configuration and update controls while running, while allowing service shutdown and log viewing.
- Read or clear frpc and update logs. Logs exceeding 512 KiB retain their latest 256 KiB; a procd worker checks every five seconds while running.
- Update the core online or upload a `frpc` executable or archive. Only newer versions replace the existing executable.
- Display messages using native LuCI dialogs and hide scrollbars without disabling scrolling.

Backend logs are stored in English. The optional language package translates known application messages, update status, and update log messages in the browser.

## Files

| File | Purpose |
| --- | --- |
| `/etc/config/frpc` | Persistent UCI settings |
| `/tmp/frpc/runtime/frpc.toml` | Generated runtime configuration |
| `/var/log/frpc.log` | Client log |
| `/var/log/update.log` | Update log |

The device must provide `/usr/bin/frpc`. The application packages are architecture independent (`noarch`/`all`) and do not bundle the frpc executable.

Source files are in `htdocs/` and `root/`. The Chinese catalog is `po/zh_Hans/frpc-own.po`; `po/templates/frpc-own.pot` contains its English template. All application translations use the private `frpc-own` context to keep English independent of the base LuCI catalogs.

## Firmware and SDK builds

Add the repository to a matching firmware source tree:

```sh
git clone https://github.com/liuyi-htu/luci-app-frpc-own.git package/luci-app-frpc-own
make menuconfig
make package/luci-app-frpc-own/compile V=s
```

Select the application and, optionally, the Simplified Chinese translation package. With an existing SDK:

```sh
make -C /path/to/openwrt-sdk package/luci-app-frpc-own/compile V=s
```

## Local builds

```sh
./build.sh
```

The script creates dedicated SDK copies under `.build-cache/` using the adjacent `luci-app-campus-connect/.toolchains/` directory as a read-only template. Set `FRPC_SDK_TEMPLATES` to use another directory containing the SDKs and `host-tools/bin/`.

- ImmortalWrt 25.12.1, MediaTek Filogic SDK: APK packages.
- ImmortalWrt 24.10.4, x86/64 SDK: IPK packages.

Each build produces the English application and optional Chinese language package, with SHA256 files, in `dist/apk/` and `dist/ipk/`. Build logs and validation results are stored in `.build-logs/`. The build checks package versions, dependencies, scripts, translation coverage, and compiled Chinese catalogs.

## Installation

Install only the main package for English. Add the language package for Chinese:

```sh
apk add --allow-untrusted luci-app-frpc-own-2.0.0-r1.apk
apk add --allow-untrusted luci-i18n-frpc-own-zh-cn-2.0.0-r1.apk
```

On IPK-based systems, use `opkg install` with the corresponding `_2.0.0-r1_all.ipk` files. Select Chinese in LuCI and reload the page after installing the translation package. Configuration is preserved during package upgrades.
