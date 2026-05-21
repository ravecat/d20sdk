# @rvct/d20sdk

`@rvct/d20sdk` is a TypeScript runtime adapter for connecting sandboxed
d20-compatible iframe modules to a shell application. It wraps the cross-window
bootstrap exchange and returns a reactive runtime session for embedded modules.

## Installation

| Client | Command                                          |
| ------ | ------------------------------------------------ |
| pnpm   | `pnpm add @rvct/d20sdk @rvct/phoenix phoenix`    |
| npm    | `npm install @rvct/d20sdk @rvct/phoenix phoenix` |
| yarn   | `yarn add @rvct/d20sdk @rvct/phoenix phoenix`    |

`@rvct/d20sdk` owns the Penpal cross-window connection. Applications provide the
Phoenix runtime dependencies through `@rvct/phoenix` and `phoenix`.

## Usage

Shell applications use `module(...)` for each iframe they embed. The shell owns
the iframe element and the backend-generated bootstrap data.

```ts
import { module } from "@rvct/d20sdk";

if (!iframe.contentWindow) {
  throw new Error("Module iframe window is not available");
}

const connection = module({
  remoteWindow: iframe.contentWindow,
  allowedOrigins: ["https://module.example.com"],
  bootstrap: {
    endpoint: "wss://shell.example.com/module",
    topic: "session:abc123",
    token: "signed-token",
  },
});

connection.promise.catch((error: unknown) => {
  console.error(error);
});

const cleanup = () => {
  connection.destroy();
};
```

Embedded modules use `shell(...)` to request bootstrap from their parent shell
and create a runtime session. Direct standalone launch returns `null`.

```ts
import { shell } from "@rvct/d20sdk";

const runtime = await shell({
  allowedOrigins: ["https://shell.example.com"],
});

const unsubscribe = runtime?.subscribe((state) => {
  console.log(state.status, state.value, state.error);
});
```

## API

The package does not export application-specific runtime session type aliases.
If the consuming application owns a concrete Phoenix session contract, it can
pass that type to `shell(...)` as a generic parameter.

### `module(options)`

Shell-side API for exposing bootstrap to one embedded module window.

Options:

- `remoteWindow` - iframe `contentWindow` for the embedded module.
- `allowedOrigins` - origins allowed to communicate with this module connection.
- `bootstrap` - backend-built `endpoint`, `topic`, and `token` returned to the
  module. `endpoint` is the Phoenix socket mount endpoint, for example
  `wss://shell.example.com/module`; Phoenix appends `/websocket` internally.

The returned connection is the Penpal connection object. Call `destroy()` when
the iframe or component is removed.

### `shell<TSessionSpec>(options)`

Embedded-module API for connecting to a parent shell.

- `remoteWindow` - parent window for the shell application. Calling `shell()`
  without options uses `window.parent`.
- `allowedOrigins` - origins allowed to communicate with the parent shell.
  Calling `shell()` without options uses `*`; production modules should pass a
  concrete origin.

`TSessionSpec` is passed through to `@rvct/phoenix` `session(...)` and controls
the typed runtime state, events, and actions. `null` means the module is running
outside an iframe. A failed shell bootstrap rejects the promise.

## Prerequisites

Required dependencies:

- Node.js `>=24`

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
`envs/.env.example` as the template.

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
