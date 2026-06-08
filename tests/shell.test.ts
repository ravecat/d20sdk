import { beforeEach, describe, expect, it, vi } from "vitest"
import { shell } from "../src"

const mocks = vi.hoisted(() => {
  type Listener = (value: unknown) => void
  type ExtensionContext = {
    call: ReturnType<typeof vi.fn>
    cast: ReturnType<typeof vi.fn>
  }
  type MockSession = {
    readonly config: unknown
    readonly attach: ReturnType<typeof vi.fn>
    readonly detach: ReturnType<typeof vi.fn>
    readonly subscribe: ReturnType<typeof vi.fn>
    readonly extend: ReturnType<typeof vi.fn>
  }
  type MockConnection = {
    promise: Promise<unknown>
    destroy: ReturnType<typeof vi.fn>
  }

  class MockWindowMessenger {
    readonly options: unknown

    constructor(options: unknown) {
      this.options = options
    }
  }

  class MockSocket {
    readonly endpoint: string
    readonly options: unknown
    readonly connect = vi.fn()

    constructor(endpoint: string, options?: unknown) {
      this.endpoint = endpoint
      this.options = options
      sockets.push(this)
    }
  }

  const sessions: MockSession[] = []
  const connections: MockConnection[] = []
  const sockets: MockSocket[] = []
  let nextConnectionPromise: Promise<unknown> | null = null

  const createMockSession = (config: unknown): MockSession => {
    const state = {
      value: null,
      status: "loading",
      error: null,
      processing: {},
      errors: {},
      timeouts: {},
    }
    const sessionStore = {
      config,
      attach: vi.fn(),
      detach: vi.fn(),
      subscribe: vi.fn((listener: Listener) => {
        listener(state)

        return vi.fn()
      }),
      extend: vi.fn((defineExtension: (context: ExtensionContext) => object) => {
        const extension = defineExtension({
          call: vi.fn(),
          cast: vi.fn(),
        })

        return {
          ...sessionStore,
          ...extension,
          subscribe: vi.fn((listener: Listener) => sessionStore.subscribe(listener)),
        }
      }),
    }

    sessions.push(sessionStore)

    return sessionStore
  }

  const connect = vi.fn(() => {
    const connection = {
      promise:
        nextConnectionPromise ??
        Promise.resolve({
          bootstrap: vi.fn(() => ({
            endpoint: "wss://shell.example.com/module",
            topic: "session:abc123",
            token: "signed-token",
          })),
        }),
      destroy: vi.fn(),
    }
    connections.push(connection)

    return connection
  })

  return {
    connect,
    connections,
    session: vi.fn(createMockSession),
    sessions,
    setNextConnectionPromise(promise: Promise<unknown> | null) {
      nextConnectionPromise = promise
    },
    Socket: vi.fn(MockSocket),
    sockets,
    WindowMessenger: vi.fn(MockWindowMessenger),
  }
})

vi.mock("@rvct/phoenix", () => ({
  session: mocks.session,
}))

vi.mock("penpal", () => ({
  connect: mocks.connect,
  WindowMessenger: mocks.WindowMessenger,
}))

vi.mock("phoenix", () => ({
  Socket: mocks.Socket,
}))

type ShellConnectionState = {
  status: string
  error: unknown
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const last = <TValue>(values: TValue[]) => values[values.length - 1]

const setEmbeddedWindow = () => {
  const parentWindow = {} as Window
  const currentWindow = {
    parent: parentWindow,
  } as Window

  vi.stubGlobal("window", currentWindow)

  return { currentWindow, parentWindow }
}

describe("shell adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mocks.connections.length = 0
    mocks.sessions.length = 0
    mocks.sockets.length = 0
    mocks.setNextConnectionPromise(null)
  })

  it("should stay cold until a returned store is subscribed", () => {
    setEmbeddedWindow()

    const runtime = shell({
      allowedOrigins: ["https://shell.example.com"],
    })
    const createdSession = mocks.sessions[0]

    expect(mocks.session).toHaveBeenCalledTimes(1)
    expect(createdSession?.detach).not.toHaveBeenCalled()
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.Socket).not.toHaveBeenCalled()

    runtime.session.subscribe(() => {})

    expect(createdSession?.detach).toHaveBeenCalledTimes(1)
    expect(mocks.connect).toHaveBeenCalledTimes(1)
  })

  it("should bootstrap and attach the Phoenix session without destroying the Penpal bridge", async () => {
    const { parentWindow } = setEmbeddedWindow()
    const bootstrap = {
      endpoint: "wss://shell.example.com/module",
      topic: "session:game",
      token: "module-token",
    }
    const remoteShell = {
      bootstrap: vi.fn(() => bootstrap),
    }
    mocks.setNextConnectionPromise(Promise.resolve(remoteShell))
    const runtime = shell(
      {
        allowedOrigins: ["https://shell.example.com"],
      },
      {
        value: { count: 0 },
      },
    )
    const connectionStates: ShellConnectionState[] = []

    runtime.connection.subscribe((state) => {
      connectionStates.push(state)
    })
    await flushPromises()

    const createdSession = mocks.sessions[0]
    const socket = mocks.sockets[0]
    const connection = mocks.connections[0]

    expect(mocks.WindowMessenger).toHaveBeenCalledWith({
      allowedOrigins: ["https://shell.example.com"],
      remoteWindow: parentWindow,
    })
    expect(remoteShell.bootstrap).toHaveBeenCalledTimes(1)
    expect(mocks.Socket).toHaveBeenCalledWith(bootstrap.endpoint, {
      authToken: bootstrap.token,
    })
    expect(socket?.connect).toHaveBeenCalledTimes(1)
    expect(createdSession?.attach).toHaveBeenCalledWith(socket, {
      topic: bootstrap.topic,
    })
    expect(connection?.destroy).not.toHaveBeenCalled()
    expect(last(connectionStates)).toEqual({
      status: "connected",
      error: null,
    })
  })

  it("should expose standalone status outside an iframe", () => {
    const currentWindow = {} as Window
    Object.defineProperty(currentWindow, "parent", {
      value: currentWindow,
    })
    vi.stubGlobal("window", currentWindow)

    const runtime = shell()
    const connectionStates: ShellConnectionState[] = []

    runtime.connection.subscribe((state) => {
      connectionStates.push(state)
    })

    expect(mocks.sessions[0]?.detach).toHaveBeenCalledTimes(1)
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.Socket).not.toHaveBeenCalled()
    expect(last(connectionStates)).toEqual({
      status: "standalone",
      error: null,
    })
  })

  it("should detach and report failed when bootstrap fails", async () => {
    setEmbeddedWindow()
    const cause = new Error("bootstrap failed")
    mocks.setNextConnectionPromise(Promise.reject(cause))
    const runtime = shell()
    const connectionStates: ShellConnectionState[] = []

    runtime.connection.subscribe((state) => {
      connectionStates.push(state)
    })
    await flushPromises()

    expect(mocks.sessions[0]?.detach).toHaveBeenCalledTimes(2)
    expect(mocks.sessions[0]?.attach).not.toHaveBeenCalled()
    expect(last(connectionStates)).toEqual({
      status: "failed",
      error: {
        kind: "bootstrap_error",
        cause,
      },
    })
  })

  it("should start once when connection and session stores are both subscribed", () => {
    setEmbeddedWindow()
    const runtime = shell()

    runtime.connection.subscribe(() => {})
    runtime.session.subscribe(() => {})

    expect(mocks.connect).toHaveBeenCalledTimes(1)
    expect(mocks.sessions[0]?.detach).toHaveBeenCalledTimes(1)
  })

  it("should start when an extended session store is subscribed", () => {
    setEmbeddedWindow()
    const runtime = shell()
    const game = runtime.session.extend(() => ({
      start() {
        return "started"
      },
    }))

    game.subscribe(() => {})

    expect(mocks.connect).toHaveBeenCalledTimes(1)
    expect(game.start()).toBe("started")
  })
})
