import { Server, Socket } from "socket.io";
import * as jdp from "jsondiffpatch";

export interface JoinPayload {
    sessionID: string;
    clientID: string;
}

export abstract class SessionManager<T> {
    sessionlessPool: Map<string, Socket>;
    sessions: Map<string, Session<T>>;
    server: Server
    constructor(server: Server) {
        this.sessions = new Map();
        this.server = server;
        server.on("connection", (socket) => {
            socket.on("join", (payload: JoinPayload) => {
                let session = this.sessions.get(payload.sessionID)
                if (!session) {
                    session = new Session(this.createController(), payload.sessionID);
                    this.sessions.set(payload.sessionID, session);
                }
                session.addClient(payload.clientID, socket);
                console.log(session);

            });
            socket.on("disconnect", () => {
                console.log("disconnect");
            })
        });
    }
    abstract createController(): Controller<T>;
}

interface Client {
    id: string;
    socket: Socket;
}

export class Session<T> {
    sessionID: string;
    sockets: Socket[] = [];
    clients: Map<string, Client> = new Map();
    controller: Controller<T>;
    constructor(controller: Controller<T>, sessionID: string) {
        this.controller = controller;
        this.sessionID = sessionID;
    }
    addClient(clientID: string, socket: Socket) {
        if (this.clients.has(clientID)) return;
        this.clients.set(clientID, {id: clientID, socket});
        for (let key in this.controller) {
            // @ts-ignore
            if (typeof(this.controller[key]) == "function" && key != "constructor") {
                socket.on(key, (e, ack) => {
                    // @ts-ignore
                    let result = this.controller[key](e);
                    this.clients.forEach(client => {
                        let delta = this.controller.state.getDelta();
                        if (delta) {
                            console.log("Emitting: ", delta);
                            client.socket.emit("delta", delta);
                        }
                    });
                    if (result && ack) {
                        ack(result)
                    }
                    // console.log(this.controller.state);
                });
            }
        }
    }
    removeClient(clientID: string) {
        this.clients.delete(clientID);
        if (!this.clients.size) {
            return true;
        }
    }
}

export interface Serializable<T> {
    serialize(): T;
    deserialize(memento: T): this;
}

export interface Undoable {
    undo(): void;
    redo(): void;
}

export abstract class RootState<T> implements Serializable<T>, Undoable {
    deltaIndex: number = -1;
    deltaQueue: any[] = [];
    latestDelta: any;
    hasNewDelta: any;
    oldState: T;
    constructor() {
    }
    abstract serialize(): T;
    abstract deserialize(memento: T): this;
    init() {
        this.oldState = this.serialize();
    }
    undo() {
        if (this.deltaIndex < 0) {
            this.latestDelta = null;
            return;
        };
        let delta = this.deltaQueue[this.deltaIndex];
        this.latestDelta = jdp.reverse(delta);
        this.oldState = jdp.unpatch(this.oldState, delta);
        this.deserialize(this.oldState);
        this.deltaIndex--;
    }
    redo() {
        if (this.deltaIndex + 1 == this.deltaQueue.length) {
            this.latestDelta = null;
            return;
        };
        let delta = this.deltaQueue[this.deltaIndex + 1];
        this.latestDelta = delta;
        this.oldState = jdp.patch(this.oldState, delta);
        this.deserialize(this.oldState);
        this.deltaIndex++;
    }
    recordDelta() {
        while (this.deltaIndex + 1 != this.deltaQueue.length) this.deltaQueue.pop();
        this.deltaIndex++;
        let state = this.serialize();
        let delta = jdp.diff(this.oldState, state);
        this.latestDelta = delta;
        this.deltaQueue.push(delta);
        this.oldState = state;
    }
    getDelta() {
        if (!this.latestDelta) return;
        let delta = this.latestDelta;
        this.latestDelta = null;
        return delta;
    }

}

export abstract class Controller<T> {
    state: RootState<T>;
    constructor(state: RootState<T>) {
        this.state = state;
    }
}