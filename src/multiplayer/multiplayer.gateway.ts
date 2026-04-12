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
import { AIService } from 'src/ai/ai.service';
import { UsersService } from '../users/users.service';

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
  private lastSaveTimes = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly aiService: AIService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
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

      try {
        const payload = this.jwtService.verify(token);
        client.data.role = 'player';
        await this.initializePlayer(client, payload);
      } catch (e) {
        console.error('❌ Error de verificación JWT:', e.message);
        client.disconnect();
      }
    } catch (e) {
      console.error('❌ Error general en handleConnection:', e.message);
      client.disconnect();
    }
  }

  private async initializePlayer(client: Socket, payload: any) {
    // 💾 Cargar persistencia desde DB
    const dbUser = await this.usersService.findById(payload.sub);

    const player: Player = {
      id: client.id,
      userId: payload.sub,
      username: payload.username,
      position: dbUser
        ? { x: dbUser.pos_x, y: dbUser.pos_y, z: dbUser.pos_z }
        : { x: 0, y: 0, z: 0 },
      rotation: dbUser ? { y: dbUser.rot_y } : { y: 0 },
      animation: 'idle',
    };

    this.players.set(client.id, player);

    client.emit(
      'current-players',
      Array.from(this.players.values()).map((p) => ({
        id: p.id,
        username: p.username,
        position: p.position,
        rotation: p.rotation,
        animation: p.animation ?? 'idle',
      })),
    );

    client.broadcast.emit('player-joined', player);
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    try {
      const payload = this.jwtService.verify(data.token);
      client.data.role = 'player';
      await this.initializePlayer(client, payload);
    } catch (e) {
      console.error('❌ Error de autenticación dinámica:', e.message);
    }
  }


  async handleDisconnect(client: Socket) {
    const player = this.players.get(client.id);

    if (player) {
      console.log('🚫 Cliente desconectado:', player.username);

      // 💾 Guardado final al desconectar (AWAITED para evitar race conditions)
      if (player.position && player.position.x !== 0) {
        await this.usersService
          .updatePosition(player.userId, player.position, player.rotation)
          .catch((err) => console.error('Error en guardado final:', err));
      }

      this.players.delete(client.id);
      this.lastSaveTimes.delete(client.id);
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

    // 🕒 Throttled Save (cada 2 segundos) para no saturar la DB a 30Hz
    const now = Date.now();
    const lastSave = this.lastSaveTimes.get(client.id) || 0;
    if (now - lastSave > 2000) {
      this.lastSaveTimes.set(client.id, now);
      this.usersService.updatePosition(player.userId, player.position, player.rotation)
        .catch(err => console.error('Error guardando posición:', err));
    }
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
  async handleLogout(@ConnectedSocket() client: Socket) {
    const player = this.players.get(client.id);

    if (player) {
      console.log('👋 Logout voluntario:', client.id);

      // 💾 Guardado final al cerrar sesión (AWAITED)
      if (player.position && player.position.x !== 0) {
        await this.usersService
          .updatePosition(player.userId, player.position, player.rotation)
          .catch((err) =>
            console.error('Error guardando posición en logout:', err),
          );
      }

      this.players.delete(client.id);
      this.lastSaveTimes.delete(client.id);
      this.server.emit('player-left', client.id);
    }

    // 👇 SOLO CAMBIAMOS ROL, NO CERRAMOS SOCKET
    client.data.role = 'spectator';
  }

  @SubscribeMessage('ai-message')
  async handleAIMessage(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const player = this.players.get(client.id);
    const username = player?.username || 'Invitado';

    console.log(`[IA] 📥 Petición de ${username}: "${data.message}"`);

    try {
      const onlinePlayers = Array.from(this.players.values())
        .map(p => p.username)
        .join(', ');
      
      const context = `Jugadores conectados actualmente: ${onlinePlayers || 'Ninguno'}.`;

      console.log(`[IA] 🚀 Consultando Gemini...`);
      const response = await this.aiService.ask(data.message, context);
      console.log(`[IA] ✅ Respuesta enviada.`);

      client.emit('ai-response', {
        text: response,
      });

    } catch (err) {
      console.error('❌ [IA] ERROR:', err);
      client.emit('ai-response', {
        text: '⚠️ Error: No pude procesar tu solicitud. Verifica la API KEY o conexión.',
        isError: true
      });
    }
  }
}