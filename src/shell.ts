import { session } from "@rvct/phoenix"
import { connect as connectToContext, WindowMessenger } from "penpal"
import { Socket } from "phoenix"
import type { ShellConnectOptions, ShellMethods, WindowMessengerOptions } from "./types"

type RuntimeSession<TSessionSpec> = ReturnType<typeof session<TSessionSpec>>

export async function connect<TSessionSpec = unknown>(
  options: ShellConnectOptions = {},
): Promise<RuntimeSession<TSessionSpec> | null> {
  if (window.parent === window) {
    return null
  }

  const messengerOptions: WindowMessengerOptions = {
    ...options,
    remoteWindow: options.remoteWindow ?? window.parent,
  }

  const shellConnection = connectToContext<ShellMethods>({
    messenger: new WindowMessenger(messengerOptions),
  })

  try {
    const shell = await shellConnection.promise
    const bootstrap = await shell.bootstrap()

    const socket = new Socket(bootstrap.endpoint, {
      authToken: bootstrap.token,
    })

    socket.connect()

    return session<TSessionSpec>(socket, {
      topic: bootstrap.topic,
    })
  } finally {
    shellConnection.destroy()
  }
}
