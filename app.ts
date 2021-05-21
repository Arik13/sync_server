import "module-alias/register";
import * as jdp from "jsondiffpatch";

import { createServer } from "http";
import { Server, Socket } from "socket.io";
import * as uniqid from "uniqid"
import { Session, SessionManager } from "./Framework/Session";
import { AppSessionManager, SessionController, SessionState } from "./Test/GameSession";

const httpServer = createServer();
export const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:8080",
    }
});

let sessionManager = new AppSessionManager(io);
httpServer.listen(3000);