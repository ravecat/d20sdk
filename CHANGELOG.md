# Changelog

# [1.1.0](https://github.com/ravecat/d20sdk/compare/1.0.0...1.1.0) (2026-06-08)


### Bug Fixes

* keep shell bridge alive after bootstrap ([f9c1c2d](https://github.com/ravecat/d20sdk/commit/f9c1c2d69a505b77ca5cf001882c2e99ceaf5b36))
* use attachable Phoenix sessions ([89a0ace](https://github.com/ravecat/d20sdk/commit/89a0ace989a98b0f73ac8fa9ec725d8556fb2dad))
* use deferred sessions ([8f419c7](https://github.com/ravecat/d20sdk/commit/8f419c72db260f7fa397d6287afa4d33a1d6d9f4))


### Features

* expose shell session after bootstrap ([94ec223](https://github.com/ravecat/d20sdk/commit/94ec2238323f9cfd4a2550bed866ad40641abf54))
* expose shell session as direct store ([948aeb2](https://github.com/ravecat/d20sdk/commit/948aeb26806e06920681a3e3175fdf8bd8d47de9))
* reduce shell API to runtime exports ([a183d84](https://github.com/ravecat/d20sdk/commit/a183d8445a767d4371127f506b1059036b6bd4f9))
* split shell connection and session stores ([991f446](https://github.com/ravecat/d20sdk/commit/991f4462bcdae51eba624e107256a8229da4462b))

# 1.0.0 (2026-05-26)


* feat(shell)!: return a reactive runtime store ([d120872](https://github.com/ravecat/d20sdk/commit/d1208728a8672f4f29066b7e8f4f4da77534a91a))


### Bug Fixes

* **shell:** preserve phoenix runtime context ([5c3798e](https://github.com/ravecat/d20sdk/commit/5c3798e1c93fd88fea3720de178d5e65ea6ff9ac))
* update dependencies ([4353393](https://github.com/ravecat/d20sdk/commit/43533933cc04647d81dcdcf4de08b0b872291c98))


### Features

* add runtime connection APIs ([fc830b7](https://github.com/ravecat/d20sdk/commit/fc830b78f8ca013dd7fe68cd9ae2871073711a0b))


### BREAKING CHANGES

* shell() now returns a ShellRuntime synchronously instead of Promise<session | null>; standalone mode is represented by the runtime state.
