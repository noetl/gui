# Changelog

All notable changes to this project will be documented in this file.

## [1.7.0](https://github.com/noetl/gui/compare/v1.6.0...v1.7.0) (2026-05-04)

### Features

* **gateway-assistant:** direct-mode submit path (no gateway required) ([#25](https://github.com/noetl/gui/issues/25)) ([5da6b34](https://github.com/noetl/gui/commit/5da6b34229a41444fdc395ea2b472ea046f8953e)), closes [#24](https://github.com/noetl/gui/issues/24) [noetl/gui#23](https://github.com/noetl/gui/issues/23) [noetl/gui#24](https://github.com/noetl/gui/issues/24)

## [1.6.0](https://github.com/noetl/gui/compare/v1.5.0...v1.6.0) (2026-05-04)

### Features

* **gateway-assistant:** clickable connection diagnostic popover ([#24](https://github.com/noetl/gui/issues/24)) ([818b76a](https://github.com/noetl/gui/commit/818b76a788288f6bc08c7da2b315965a008f45c6)), closes [noetl/gui#19](https://github.com/noetl/gui/issues/19)

## [1.5.0](https://github.com/noetl/gui/compare/v1.4.2...v1.5.0) (2026-05-04)

### Features

* **prompt:** bare route names work as `cd <route>` shortcuts ([#23](https://github.com/noetl/gui/issues/23)) ([6acf1c0](https://github.com/noetl/gui/commit/6acf1c02c2c65889c980ab2aa7e1558f83c97aaf)), closes [noetl/gui#19](https://github.com/noetl/gui/issues/19)

## [1.4.2](https://github.com/noetl/gui/compare/v1.4.1...v1.4.2) (2026-05-01)

### Bug Fixes

* **prompt:** prefer latest MCP terminal agents ([#22](https://github.com/noetl/gui/issues/22)) ([8e220ce](https://github.com/noetl/gui/commit/8e220ceac5cb4aa19b4880bad90ccda109c9b766))

## [1.4.1](https://github.com/noetl/gui/compare/v1.4.0...v1.4.1) (2026-05-01)

### Bug Fixes

* **prompt:** render MCP tools as terminal tables ([#21](https://github.com/noetl/gui/issues/21)) ([5b0ac7c](https://github.com/noetl/gui/commit/5b0ac7c9693e36b65cb7c78fdf68f2ba3f76462a))

## [1.4.0](https://github.com/noetl/gui/compare/v1.3.2...v1.4.0) (2026-04-30)

### Features

* **prompt:** support generic MCP workspace calls ([#20](https://github.com/noetl/gui/issues/20)) ([ee8e5ec](https://github.com/noetl/gui/commit/ee8e5ecc3105b826aede8b8f9214a5628aafa1be))

## [1.3.2](https://github.com/noetl/gui/compare/v1.3.1...v1.3.2) (2026-04-29)

### Bug Fixes

* **prompt:** keep action-chip labels on one line under long descriptions ([#19](https://github.com/noetl/gui/issues/19)) ([84467f3](https://github.com/noetl/gui/commit/84467f3b6a3ed37ccabc52996d8c47dbb94ffdc0)), closes [noetl/gui#16](https://github.com/noetl/gui/issues/16) [noetl/gui#17](https://github.com/noetl/gui/issues/17) [noetl/gui#18](https://github.com/noetl/gui/issues/18)

## [1.3.1](https://github.com/noetl/gui/compare/v1.3.0...v1.3.1) (2026-04-29)

### Bug Fixes

* **catalog-run:** Copilot pass-1 review follow-up on [#16](https://github.com/noetl/gui/issues/16) ([#17](https://github.com/noetl/gui/issues/17)) ([216397f](https://github.com/noetl/gui/commit/216397f0a78c7cc873ab8a5272c43c3e7086fdc9))

## [1.3.0](https://github.com/noetl/gui/compare/v1.2.0...v1.3.0) (2026-04-29)

### Features

* **catalog:** friendly playbook run dialog backed by /ui_schema (architecture phase 4) ([#16](https://github.com/noetl/gui/issues/16)) ([d6c47ca](https://github.com/noetl/gui/commit/d6c47ca259b55dcb55554e41cd1c08beb1a9ceb8)), closes [noetl/noetl#392](https://github.com/noetl/noetl/issues/392) [#37](https://github.com/noetl/gui/issues/37)

## [1.2.0](https://github.com/noetl/gui/compare/v1.1.2...v1.2.0) (2026-04-28)

### Features

* **theme:** rebuild dark + light themes around nushell.sh aesthetic ([#14](https://github.com/noetl/gui/issues/14)) ([092bb9e](https://github.com/noetl/gui/commit/092bb9e6d7a2340bd487bb02bf2c229de3545627)), closes [#181a23](https://github.com/noetl/gui/issues/181a23) [#fbf6](https://github.com/noetl/gui/issues/fbf6) [#4eb960](https://github.com/noetl/gui/issues/4eb960) [#1a7f5](https://github.com/noetl/gui/issues/1a7f5) [#f7768](https://github.com/noetl/gui/issues/f7768) [#c2410](https://github.com/noetl/gui/issues/c2410)

## [1.1.2](https://github.com/noetl/gui/compare/v1.1.1...v1.1.2) (2026-04-28)

### Bug Fixes

* **gui:** quiet nginx and frontend login-related logs ([#13](https://github.com/noetl/gui/issues/13)) ([2fb7682](https://github.com/noetl/gui/commit/2fb768298b2fe6d75deab6405fb76cf9a12c7cce))

## [1.1.1](https://github.com/noetl/gui/compare/v1.1.0...v1.1.1) (2026-04-28)

### Bug Fixes

* remove direct MCP proxy from GUI ([#12](https://github.com/noetl/gui/issues/12)) ([7012e8d](https://github.com/noetl/gui/commit/7012e8d7cbac7f45009bd563d164497d13da5f21))

## [1.1.0](https://github.com/noetl/gui/compare/v1.0.7...v1.1.0) (2026-04-27)

### Features

* route MCP terminal commands through agents ([#11](https://github.com/noetl/gui/issues/11)) ([b1d61a1](https://github.com/noetl/gui/commit/b1d61a15b6dc4bfe8b3d76ae8af7183dbf8c4637))

## [1.0.7](https://github.com/noetl/gui/compare/v1.0.6...v1.0.7) (2026-04-26)

### Bug Fixes

* release kubernetes mcp terminal ([4a9592a](https://github.com/noetl/gui/commit/4a9592aab8207fbb491569a22b8b92e8368502ba))

## [1.0.6](https://github.com/noetl/gui/compare/v1.0.5...v1.0.6) (2026-04-26)

### Bug Fixes

* **ui:** release terminal workspace panes ([15aaaf2](https://github.com/noetl/gui/commit/15aaaf27bc10cd08ee7d6af644166c3c79c468c2))

## [1.0.5](https://github.com/noetl/gui/compare/v1.0.4...v1.0.5) (2026-03-17)

### Bug Fixes

* use canonical workload and status execution APIs ([b2d93ea](https://github.com/noetl/gui/commit/b2d93ea0adfe470f5eeabb7294bd51615654897c))

## [1.0.4](https://github.com/noetl/gui/compare/v1.0.3...v1.0.4) (2026-03-12)

### Bug Fixes

* Update release workflow AHM-4253 ([8775573](https://github.com/noetl/gui/commit/8775573d7b63fc760e55d86fc00df73e383af0cb))

## [1.0.3](https://github.com/noetl/gui/compare/v1.0.2...v1.0.3) (2026-03-12)

### Bug Fixes

* Update semantic release config AHM-4253 ([336e71a](https://github.com/noetl/gui/commit/336e71aeb0beeffc23213a08326a63f997dc3b28))

## [1.0.2](https://github.com/noetl/gui/compare/v1.0.1...v1.0.2) (2026-03-12)

### Bug Fixes

* Create build_on_release workflow AHM-4253 ([0e2b142](https://github.com/noetl/gui/commit/0e2b1425dbccac6e3ab9e8f5d771ba42828f7593))

## [1.0.1](https://github.com/noetl/gui/compare/v1.0.0...v1.0.1) (2026-03-02)

### Bug Fixes

* remove build-time gateway env from Dockerfile ([f149bd2](https://github.com/noetl/gui/commit/f149bd2eb932623ebd89fea993e6ecf6bc34df47))

## 1.0.0 (2026-03-02)

### Features

* import gui app and add image release automation ([3eebe98](https://github.com/noetl/gui/commit/3eebe9886e5de66327585a4c95b86654152bf113))
