import { createServer } from "node:net";
import { join } from "node:path";
import { temporaryFolder } from "@arthur/core/testing";

// Why a test that starts a tmux server is skipped here, or false: a host that refuses every new Unix socket, as the job
// sandbox does, gives tmux no socket for its server. One probe at load: a listening socket in a folder of the test's own.
const probe = Promise.withResolvers<string | false>();
const server = createServer();
server.once("error", (error: NodeJS.ErrnoException) => probe.resolve(`this host refuses a Unix socket (${error.code}), so tmux cannot start a server`));
server.listen(join(temporaryFolder(), "probe.sock"), () => server.close(() => probe.resolve(false)));
export const NO_UNIX_SOCKET = await probe.promise;
