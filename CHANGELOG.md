# Changelog

# 1.0.0 (2026-05-26)


* feat(shell)!: return a reactive runtime store ([d120872](https://github.com/ravecat/d20sdk/commit/d1208728a8672f4f29066b7e8f4f4da77534a91a))


### Bug Fixes

* **shell:** preserve phoenix runtime context ([5c3798e](https://github.com/ravecat/d20sdk/commit/5c3798e1c93fd88fea3720de178d5e65ea6ff9ac))
* update dependencies ([4353393](https://github.com/ravecat/d20sdk/commit/43533933cc04647d81dcdcf4de08b0b872291c98))


### Features

* add runtime connection APIs ([fc830b7](https://github.com/ravecat/d20sdk/commit/fc830b78f8ca013dd7fe68cd9ae2871073711a0b))


### BREAKING CHANGES

* shell() now returns a ShellRuntime synchronously instead of Promise<session | null>; standalone mode is represented by the runtime state.
