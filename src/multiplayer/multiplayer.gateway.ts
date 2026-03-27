/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

interface Player {
  id: string;        // socket.id
  userId: number;    // id del usuario (DB)
  username: string;  // username real
  position?: any;
  rotation?: any;
  animation?: string;
  ray?: any;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class MultiplayerGateway //Aqui comienza ------------------
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private players = new Map<string, Player>();

  constructor(private readonly jwtService: JwtService) {}

    handleConnection(client: Socket) {
  try {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      client.data.role = 'spectator';

      client.emit(
        'current-players',
        Array.from(this.players.values()).map(p => ({
          id: p.id,
          username: p.username,
          position: p.position,
          rotation: p.rotation,
          animation: p.animation ?? 'idle', // 🔥 CLAVE
        })),
      );
      return;
    }

    const payload = this.jwtService.verify(token);

    client.data.role = 'player';

    const player: Player = {
      id: client.id,
      userId: payload.sub,
      username: payload.username,
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 },
      animation: 'idle', // 🔥 IMPORTANTE
    };

    this.players.set(client.id, player);

    client.emit(
      'current-players',
      Array.from(this.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        position: p.position,
        rotation: p.rotation,
        animation: p.animation ?? 'idle',
      })),
    );

    client.broadcast.emit('player-joined', player);
  } catch {
    client.disconnect();
  }
}


    handleDisconnect(client: Socket) {
    const player = this.players.get(client.id);

    if ( player) {
      console.log('🚫 Cliente desconectado:', player.username);
      this.players.delete(client.id);
      this.server.emit('player-left', client.id);
    }
  }

  //Reenvíe los jugadores cuando el cliente esté listo.
  @SubscribeMessage('request-current-players')
handleRequestPlayers(@ConnectedSocket() client: Socket) {
  client.emit(
    'current-players',
    Array.from(this.players.values()).map(p => ({
      id: p.id,
      username: p.username,
      position: p.position,
      rotation: p.rotation,
      animation: p.animation ?? 'idle', // 🔥 CLAVE
    })),
  );
}


    @SubscribeMessage('update-position')
  handleUpdatePosition(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    if (client.data.role !== 'player') return;

    const player = this.players.get(client.id);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation;
    player.animation = data.animation;
    player.ray = data.ray;

    const payload = {
      id: client.id,
      position: data.position,
      rotation: data.rotation,
      animation: data.animation,
      ray: data.ray,
      username: player.username,
    };

    // Igual que antes: enviar a todos
    client.broadcast.emit('player-moved', payload);
  }

    @SubscribeMessage('move') handleMove(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    client.broadcast.emit('remoteMove', {
      id: client.id,
      position: data.position,
      rotation: data.rotation,
    });
  }

    @SubscribeMessage('chat-message')
  handleChat(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const player = this.players.get(client.id);
    if (!player) return;

    console.log(`💬 Chat de ${player.username}:`, data.message);

    this.server.emit('chat-message', {
      id: client.id,
      username: player.username,
      message: data.message,
    });
  }

  @SubscribeMessage('logout')
handleLogout(@ConnectedSocket() client: Socket) {
  const player = this.players.get(client.id);

  if (player) {
    console.log('👋 Logout voluntario:', client.id);
    this.players.delete(client.id);
    this.server.emit('player-left', client.id);
  }

  // 👇 SOLO CAMBIAMOS ROL, NO CERRAMOS SOCKET
  client.data.role = 'spectator';
}


}