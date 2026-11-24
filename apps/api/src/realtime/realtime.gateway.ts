import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { AuthUser, JwtPayload } from '../auth/auth.types';
import type { Role } from '../generated/prisma/enums';

/** Server → client events (contract "Realtime"). */
export const RealtimeEvent = {
  NotificationNew: 'notification:new',
  LeadUpdated: 'lead:updated',
  PayoutUpdated: 'payout:updated',
} as const;

export const userRoom = (userId: string) => `user:${userId}`;
export const roleRoom = (role: Role) => `role:${role}`;

interface SocketData {
  user: AuthUser;
  expiryTimer?: NodeJS.Timeout;
}

/**
 * Namespace /realtime. The client connects with `auth: { token }` (the access
 * token); the handshake is rejected if the token is missing or invalid. Each
 * socket joins `user:<id>` and `role:<ROLE>`, so services can target a person
 * or a whole role without tracking socket ids.
 */
@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(private readonly jwt: JwtService) {}

  afterInit(namespace: Namespace): void {
    // Middleware runs during the handshake: a failure here refuses the
    // connection (client receives `connect_error`).
    namespace.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token === '') {
        next(new Error('Unauthorized'));
        return;
      }
      this.jwt
        .verifyAsync<JwtPayload & { exp: number }>(token)
        .then((payload) => {
          (socket.data as SocketData).user = {
            id: payload.sub,
            role: payload.role,
          };
          this.scheduleExpiry(socket, payload.exp);
          next();
        })
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { user } = socket.data as SocketData;
    await socket.join([userRoom(user.id), roleRoom(user.role)]);
  }

  handleDisconnect(socket: Socket): void {
    clearTimeout((socket.data as SocketData).expiryTimer);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  /** One emit to several rooms: a socket in more than one gets it once. */
  emitToRooms(rooms: string[], event: string, payload: unknown): void {
    this.server.to(rooms).emit(event, payload);
  }

  /**
   * Disconnect when the access token expires; the client reconnects with a
   * fresh token. Without this a socket would stay authorised forever.
   */
  private scheduleExpiry(socket: Socket, exp: number): void {
    const msLeft = exp * 1000 - Date.now();
    (socket.data as SocketData).expiryTimer = setTimeout(() => {
      this.logger.debug(`Token expired, disconnecting socket ${socket.id}`);
      socket.disconnect(true);
    }, msLeft);
  }
}
