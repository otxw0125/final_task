import { WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {}
  handleConnection(client: Socket) {
    const token = client.handshake.query.token as string;
    try {
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      client.join(payload.sub);
    } catch {
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {}

  sendToUser(userId: string, event: string, data: any) {
    this.server.to(userId).emit(event, data);
  }
}