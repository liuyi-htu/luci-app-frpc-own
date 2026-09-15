include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-frpc-own
PKG_VERSION:=1.0.0
PKG_RELEASE:=3
PKG_LICENSE:=MIT

LUCI_TITLE:=FRP client LuCI application
LUCI_DESCRIPTION:=LuCI management page and service integration for the FRP client.
LUCI_DEPENDS:=+luci-base +jsonfilter +uclient-fetch +ca-bundle
LUCI_PKGARCH:=all
PKG_PROVIDES:=luci-app-frpc luci-app-frpc-web

define Package/luci-app-frpc-own/conffiles
/etc/config/frpc
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
