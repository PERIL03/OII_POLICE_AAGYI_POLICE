import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
export declare const logger: pino.Logger<never, boolean>;
declare const app: import("express-serve-static-core").Express;
declare const httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { app, httpServer, io };
//# sourceMappingURL=index.d.ts.map