# FullCombo Shark!

![Releases](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ffantastic-packages.github.io%2Freleases%2F25.12%2Fpackages%2Fx86_64%2Fluci%2Findex.json&query=%24.packages.luci-app-fchomo&label=releases&style=flat-square&color=73eba0)
[![License](https://img.shields.io/github/license/fcshark-org/openwrt-fchomo?style=flat-square)](./LICENSE)
![Stars](https://img.shields.io/github/stars/fcshark-org/openwrt-fchomo?style=flat-square&color=ea4aaa)
[![Discussions](https://img.shields.io/github/discussions/fcshark-org/openwrt-fchomo?style=flat-square)](https://github.com/fcshark-org/openwrt-fchomo/discussions)
[![Static](https://img.shields.io/badge/chat-on%20Telegram-blue?style=flat-square)](https://t.me/fc_shark)
<!-- ![Codesize](https://img.shields.io/github/languages/code-size/fcshark-org/openwrt-fchomo?style=flat-square) -->

## Features

- Gateway Transparent proxy
- Gateway FullCone NAT
- Access control Whitelist/Blacklist
- Routing control based on Port/IP/Domain
- Complete DNS hijacking prevents any 53 port query behavior that bypasses the gateway
- DNS requests intelligent routing based on EDNS-Client-Subnet/Policy
- Based on mihomo documentation, fully visual configuration GUI

## Requirements

- OpenWrt >= 24.10
- firewall4

## Known issues

- The **Routing rule** and **Sub rule** of the old version LuCI app have been migrated from `mihomo` format to `json` format.\
  If find `option oldentry` in `/etc/config/fchomo` file, the selected options may not be migrated correctly.\
  You need to manually reset the selected config and remove the `oldentry` option when you are done.

## Screenshots

![global](assets/img/global.png "global")

## Simplified architecture diagram

<details><summary>Expand/Collapse</summary>

``` mermaid
flowchart TD
  subgraph Firewall
    direction TB
    subgraph fw_inpot[Input]; rawin[Raw traffic]; end
    subgraph fw_outpot[Output]; lo; direct[Direct]; mihomoin[Mihomo in]; end
    rawin --firewall--> flow{Subnet/Local traffic ?}
    flow --Subnet--> acl_listen
    flow --Local--> proxy_router{Proxy routerself ?}
      proxy_router --Yes--> acl_dst
      proxy_router --No --> direct
    subgraph acl[Access Control]
      direction TB
      acl_listen{Src-interface filter} --> dns_hijack
      acl_listen --> direct
      dns_hijack{dport is 53 ?} --Redirect to dnsmasq--> lo
      dns_hijack --No --> acl_src
      acl_src{Src-address filter} --> acl_dst
      acl_src --> direct
      acl_dst{Dst-address filter} --> acl_dport
      acl_dst --> direct
      acl_dport{Dst-port filter
Always redirect port 53} --> mihomoin
      acl_dport --> direct
    end
  end
  subgraph DNS
    direction TB
    subgraph dns_inpot[Input]; dnsreq[Any DNS request to **local:53**]; end
    subgraph dns_outpot[Output]; mihomodns[Minomo DNS]; otherdns[Other DNS]; end
    dnsreq <--> dnsmasq[DNSmasq]
    dnsmasq <--Upstearm--> mihomodns
    dnsmasq <--Upstearm--> otherdns
    dnsmasq-full --Set ipset--> e[NFTables direct/proxy/cn/gfw ipset]
  end
```
</details>

## Releases

You can find the prebuilt-ipks [here](https://fantastic-packages.github.io/packages/)

## Installation

If you have trouble downloading resource files after initial installation, you can upload the [initial resource pack][].

## Example config

Used to override `/etc/config/fchomo`

[bypasscn](./luci-app-fchomo/docs/example/bypasscn.config)</br>
[gfwlist](./luci-app-fchomo/docs/example/gfwlist.config)

## Fullcone Configuration

<details><summary>Direct</summary>

1. add `Dst-address` to `Global > Access Control > Custom Direct list` (domain requires `dnsmasq-full`)
2. (Optional) remove `Dst-port` on `Global > Access Control > Routing Control > Routing port (UDP)`
3. accept input `Dst-port` on `Network > Firewall > Traffic Rules`, requires the upstream link is Fullcone
</details>

<details><summary>Proxy</summary>

1. (Optional) add `Dst-address` to `Global > Access Control > Custom Proxy list` (domain requires `dnsmasq-full`)
2. add `Dst-port` on `Global > Access Control > Routing Control > Routing port (UDP)`
3. add rule to `Client > Routing rule`, requires the dest `Proxy group` is Fullcone link
</details>

## Build

``` bash
# Take the x86_64 platform as an example
tar xjf openwrt-sdk-23.05.3-x86-64_gcc-12.3.0_musl.Linux-x86_64.tar.xz
# Go to the SDK root dir
cd openwrt-sdk-*-x86_64_*
# First run to generate a .config file
make menuconfig
./scripts/feeds update -a
./scripts/feeds install -a
# Get Makefile
git clone --depth 1 --branch master --single-branch --no-checkout https://github.com/fcshark-org/openwrt-fchomo.git package/openwrt-fchomo
pushd package/openwrt-fchomo
umask 022
git checkout
popd
# Select the package LuCI -> Applications -> luci-app-fchomo
make menuconfig
# Start compiling
make package/luci-app-fchomo/compile V=s BUILD_LOG=y -j$(nproc)
```

[initial resource pack]: https://github.com/fcshark-org/openwrt-fchomo/raw/refs/heads/initialpack/initial.tgz
