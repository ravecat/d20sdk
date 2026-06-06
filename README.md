# @rvct/d20sdk

`@rvct/d20sdk` is a TypeScript adapter for connecting sandboxed d20-compatible
iframe modules to a shell application. It wraps the cross-window bootstrap
exchange and returns separate Shell connection and Phoenix session stores for
embedded modules.

## Installation

| Client | Command                                          |
| ------ | ------------------------------------------------ |
| pnpm   | `pnpm add @rvct/d20sdk @rvct/phoenix phoenix`    |
| npm    | `npm install @rvct/d20sdk @rvct/phoenix phoenix` |
| yarn   | `yarn add @rvct/d20sdk @rvct/phoenix phoenix`    |

`@rvct/d20sdk` owns the [Penpal](https://github.com/Aaronius/penpal)
cross-window connection. Applications provide the Phoenix runtime dependencies
through [`@rvct/phoenix`](https://github.com/ravecat/phoenix) and the
[`phoenix` JavaScript client](https://hexdocs.pm/phoenix/js/).

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

Embedded modules use `shell(...)` to create Shell connection and Phoenix session
stores. The first subscription requests bootstrap from the parent shell and
creates the Phoenix socket. Direct standalone launch emits a `standalone`
connection status while the session store stays in its initial loading state.
Unsubscribing from the returned stores removes only that listener; it does not
disconnect the socket or detach the Phoenix session.

```ts
import { shell } from "@rvct/d20sdk";

type GameValue = {
  turn: number;
};

type GameJoinOk = {
  turn: number;
};

const runtime = shell<GameValue>(
  {
    allowedOrigins: ["https://shell.example.com"],
  },
  {
    value: {
      turn: 0,
    },
    connect: {
      ok(_value, reply: GameJoinOk) {
        return {
          turn: reply.turn,
        };
      },
    },
  },
);

const unsubscribeConnection = runtime.connection.subscribe((connection) => {
  console.log(connection.status, connection.error);
});

const unsubscribeSession = runtime.session.subscribe((session) => {
  console.log(session.status, session.value, session.error);
});
```

Use the Phoenix-compatible session store's `extend` to expose module-specific
actions. The `call` and `cast` functions are only available inside the extension
factory. The factory should only declare methods; call or cast inside returned
methods, not while building the returned object.

```ts
import { shell } from "@rvct/d20sdk";

type GameValue = {
  turn: number;
};

type StartError = {
  reason?: string;
};

const runtime = shell<GameValue>(
  {
    allowedOrigins: ["https://shell.example.com"],
  },
  {
    value: {
      turn: 0,
    },
  },
);

const game = runtime.session.extend(({ call }) => ({
  start() {
    return call<Record<string, never>, StartError>("start", {});
  },
}));

const unsubscribeGame = game.subscribe((state) => {
  console.log(state.status, state.processing.start);
});

const startGame = () => game.start();
```

## API

The package exports runtime functions only. Store and state types are inferred
from `shell(...)`; if the consuming application owns a concrete Phoenix session
value type, it can pass that type to `shell(...)` as a generic parameter.

### `module(options)`

Shell-side API for exposing bootstrap to one embedded module window.

Options:

- `remoteWindow` - iframe `contentWindow` for the embedded module.
- `allowedOrigins` - origins allowed to communicate with this module connection.
- `bootstrap` - backend-built `endpoint`, `topic`, and `token` returned to the
  module. `endpoint` is the Phoenix socket mount endpoint, for example
  `wss://shell.example.com/module`; Phoenix appends `/websocket` internally.

The returned connection is the
[Penpal connection object](https://github.com/Aaronius/penpal). Call `destroy()`
when the iframe or component is removed.

### `shell<TValue>(options, sessionConfig?)`

Embedded-module API for connecting to a parent shell.

- `remoteWindow` - parent window for the shell application. Calling `shell()`
  without options uses `window.parent`.
- `allowedOrigins` - origins allowed to communicate with the parent shell.
  Calling `shell()` without options uses `*`; production modules should pass a
  concrete origin.

`shell(...)` returns `connection` and `session` stores. Both expose
`subscribe(listener): unsubscribe`; their listener values are inferred from the
returned stores.

In Svelte, destructure the two stores. `$connection` is the Shell/bootstrap
state; `$session` is the Phoenix session state:

```svelte
{#if $connection.status === "failed"}
  <p>{$connection.error.kind}</p>
{:else if $connection.status === "connected"}
  <p>{$session.status}</p>
  <p>{$session.value?.turn}</p>
{/if}
```

`session` is still a store object, so it can be passed to components that need
to subscribe to the same Phoenix state:

```svelte
<script lang="ts">
  import type { shell } from "@rvct/d20sdk";

  type GameValue = {
    turn: number;
  };

  let {
    session,
  }: {
    session: ReturnType<typeof shell<GameValue>>["session"];
  } = $props();
</script>

<p>{$session.status}</p>
<p>{$session.value?.turn}</p>
```

`connection` only represents the Shell/Penpal/bootstrap lifecycle:

- `loading` - the SDK is waiting for parent Shell bootstrap.
- `standalone` - the module is not running in a Shell iframe.
- `connected` - bootstrap succeeded and the Phoenix session has been attached to
  the socket/topic from Shell bootstrap.
- `failed` - Shell bootstrap failed.

`connection.status: "connected"` does not mean the Phoenix channel is ready. It
only means the SDK has attached the Phoenix session to the bootstrapped channel.
Read `$session.status` to get the Phoenix `loading`, `ready`, `stale`, or
`failed` state.

`sessionConfig` is passed through to
[`@rvct/phoenix` `session(...)`](https://github.com/ravecat/phoenix#lazy-transport-attachment)
as the session config. The SDK attaches `topic` from the shell bootstrap, so
embedded modules configure `value`, `connect`, and `events`, but not `topic`.

`TValue` is passed through to
[`@rvct/phoenix` `session(...)`](https://github.com/ravecat/phoenix#lazy-transport-attachment)
as the session `value` type. It is not the full store state and not the old
Phoenix session contract object. Actions are owned by the Phoenix session;
methods returning `call<TOk, TError>(...)` type their `$session.errors[method]`
bucket as `TError | null`. `shell(...)` is synchronous and cold: no Penpal or
Phoenix work starts until `connection` or `session` has a subscriber. A
subscription to either store starts the shell runtime once. Unsubscribing
removes the listener from that store, but it does not stop the shell runtime,
disconnect the socket, or detach the Phoenix session. Outside an iframe, the
shell connection state becomes `standalone` and `session` remains in its initial
Phoenix loading state. A failed shell bootstrap emits
`connection.status: "failed"` with `connection.error.kind: "bootstrap_error"`.

Without `sessionConfig`, the Phoenix session uses its default behavior: the
initial value is `null`, and a successful join keeps the current value unless
`connect.ok` is configured.

## References

- [`@rvct/phoenix`](https://github.com/ravecat/phoenix) provides the reactive
  `session(...)` wrapper and the `TValue` value type consumed by this package.
- [Phoenix JavaScript client](https://hexdocs.pm/phoenix/js/) provides the
  `Socket` and `Channel` primitives used after bootstrap.
- [Phoenix Channels](https://hexdocs.pm/phoenix/channels.html) define the
  server-side topics, events, replies, and broadcasts that become runtime
  contracts.
- [Penpal](https://github.com/Aaronius/penpal) provides the promise-based
  cross-window `postMessage` connection between the shell and iframe module.

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
