# @rvct/d20sdk

`@rvct/d20sdk` is a TypeScript package scaffold for d20 runtime integration code.

Runtime APIs are added in separate commits so the initial project structure
stays independent from implementation details.

## Prerequisites

Required dependencies:

- Node.js `>=24`
- pnpm

Recommended:

<details>
<summary>Prepare Nix environment</summary>

Official docs:

- [Nix installation](https://nixos.org/download/)
- [Nix flakes](https://nix.dev/concepts/flakes)
- [direnv installation](https://direnv.net/docs/installation.html)
- [direnv shell hook](https://direnv.net/docs/hook.html)
- [nix-direnv](https://github.com/nix-community/nix-direnv)

Linux multi-user Nix install:

```sh
sh <(curl --proto '=https' --tlsv1.2 -L https://nixos.org/nix/install) --daemon
```

Enable flakes:

```sh
mkdir -p ~/.config/nix
printf "experimental-features = nix-command flakes\n" >> ~/.config/nix/nix.conf
```

Optional direnv and nix-direnv setup through Nix:

```sh
nix profile install nixpkgs#direnv nixpkgs#nix-direnv
mkdir -p ~/.config/direnv
printf 'source $HOME/.nix-profile/share/nix-direnv/direnvrc\n' >> ~/.config/direnv/direnvrc
```

Add the direnv hook for your shell, then restart the shell. For bash:

```sh
printf 'eval "$(direnv hook bash)"\n' >> ~/.bashrc
```

For other shells, use the [direnv hook docs](https://direnv.net/docs/hook.html).

</details>

<br>

- Enter the environment with `nix develop`, or run `direnv allow` once and let
  direnv load it automatically.
- The flake provides Node.js, pnpm, Git, Just, and repository check tooling.

Manual setup:

- Install and configure Node.js manually.
- Install pnpm `10.26.2` and Just when running the project commands outside the
  Nix shell.

Local development variables can be placed in `envs/.env`. Use
`envs/.env.example` as the tracked template.

Install dependencies and run checks:

```sh
just setup
just check
```

## Commands

| Command          | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `just setup`     | Install project dependencies.                |
| `just check`     | Run lint and TypeScript checks.              |
| `just lint`      | Run Biome and README formatting checks.      |
| `just typecheck` | Run TypeScript without emitting files.       |
| `just format`    | Format TypeScript, JSON, and Markdown.       |
| `just lint-fix`  | Apply Biome fixes and format Markdown files. |

## Testing and Checks

```sh
just check
```

## License

MIT. See [LICENSE](LICENSE).
