include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-frpc-own
PKG_VERSION:=2.0.0
PKG_RELEASE:=14
PKG_LICENSE:=MIT

LUCI_TITLE:=FRP client LuCI application
LUCI_DESCRIPTION:=LuCI management page and service integration for the FRP client.
LUCI_DEPENDS:=+luci-base +jsonfilter +uclient-fetch +ca-bundle
LUCI_PKGARCH:=all
PKG_PROVIDES:=luci-app-frpc luci-app-frpc-web

define Package/luci-app-frpc-own/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/frpc-web stop 2>/dev/null || true
/etc/init.d/frpc-web disable 2>/dev/null || true
killall frpc-web 2>/dev/null || true
rm -f /etc/init.d/frpc-web /usr/bin/frpc-web /etc/config/frpc-web /etc/config/frpc-web.apk-new
rm -f /usr/lib/lua/luci/controller/frpc.lua /usr/lib/lua/luci/view/frpc.htm
rm -f /usr/lib/lua/luci/controller/frpc_web.lua /usr/lib/lua/luci/view/frpc-web.htm /usr/share/luci/menu.d/frpc-web.json
rm -f /var/log/server.log
rm -f /var/etc/frpc.toml /usr/bin/frpc.new /etc/frp-stack/.frpc.toml.tmp
rm -f /tmp/frpc-runtime.toml /tmp/frpc-config-upload /tmp/frpc-upload.tar.gz /tmp/frpc-update.status
mkdir -p /tmp/frpc/runtime /tmp/frpc/uploads /tmp/frpc/update /tmp/frpc/verify /tmp/frpc/enforce
chmod 0700 /tmp/frpc /tmp/frpc/runtime /tmp/frpc/uploads /tmp/frpc/update /tmp/frpc/verify /tmp/frpc/enforce
uci -q get frpc.main.config_mode >/dev/null || { uci set frpc.main.config_mode='uci'; uci commit frpc; }
chmod 0600 /etc/config/frpc
chmod 0755 /etc/init.d/frpc /usr/libexec/frpc-ui /usr/libexec/frpc-update /usr/libexec/frpc-enforce-log
/etc/init.d/frpc enable
rm -f /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/rpcd restart 2>/dev/null || true
exit 0
endef

define Package/luci-app-frpc-own/conffiles
/etc/config/frpc
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
