import { Server } from "socket.io";
import { SessionManager, Session, Controller, RootState } from "../Framework/Session";

export interface SessionState {
    arr: string[];
}

export class AppSessionManager extends SessionManager<SessionState> {
    constructor(server: Server) {
        super(server);
    }
    createController() {
        return new SessionController();
    }
}

export class SessionController extends Controller<SessionState> {
    state: SessionTree;
    constructor() {
        super(new SessionTree());
    }
    load() {
        return this.state.serialize();
    }
    test(test: string) {
        this.state.arr.push(test);
        this.state.recordDelta();
    }
    undo() {
        this.state.undo();
    }
    redo() {
        this.state.redo();
    }
}
export class SessionTree extends RootState<SessionState> implements SessionState {
    arr: string[] = [];
    constructor() {
        super();
        this.init();
    }
    serialize() {
        return {
            arr: this.arr.map(x => x),
        }
    }
    deserialize(memento: SessionState) {
        this.arr = memento.arr.map(x => x);
        return this;
    }
}