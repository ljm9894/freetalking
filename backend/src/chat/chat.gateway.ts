import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5500'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  connectedClients: { [socketId: string]: boolean } = {};
  clientNickname: { [socketId: string]: string } = {};
  roomUsers: { [key: string]: string[] } = {};

  handleConnection(client: Socket): void {
    if (this.connectedClients[client.id]) {
      client.disconnect(true);
      return;
    }
    this.connectedClients[client.id] = true;
  }

  handleDisconnect(client: Socket): void {
    delete this.connectedClients[client.id];
    Object.keys(this.roomUsers).forEach((room) => {
      const index = this.roomUsers[room]?.indexOf(
        this.clientNickname[client.id],
      );
      if (index !== -1) {
        this.roomUsers[room].splice(index, 1);
        this.server
          .to(room)
          .emit('userLeft', { userId: this.clientNickname[client.id], room });
        this.server
          .to(room)
          .emit('userList', { room, userList: this.roomUsers[room] });
      }
    });
    Object.keys(this.roomUsers).forEach((room) => {
      this.server
        .to(room)
        .emit('userList', { room, userList: this.roomUsers[room] });
    });
    this.server.emit('userList', {
      room: null,
      userList: Object.keys(this.connectedClients),
    });
  }
  @SubscribeMessage('setUserNick')
  handleSetUserNick(client: Socket, nick: string): void {
    this.clientNickname[client.id] = nick;
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, room: string): void {
    if (client.rooms.has(room)) {
      return;
    }
    client.join(room);
    if (!this.roomUsers[room]) {
      this.roomUsers[room] = [];
    }
    this.roomUsers[room].push(this.clientNickname[client.id]);
    this.server
      .to(room)
      .emit('userJoined', { userId: this.clientNickname[client.id], room });
    this.server
      .to(room)
      .emit('userList', { room, userList: this.roomUsers[room] });
    this.server.emit('userList', {
      room: null,
      userList: Object.keys(this.connectedClients),
    });
  }
  @SubscribeMessage('exit')
  handleExit(client: Socket, room: string): void {
    if (!client.rooms.has(room)) {
      return;
    }
    client.leave(room);
    const index = this.roomUsers[room]?.indexOf(this.clientNickname[client.id]);
    if (index !== -1) {
      this.roomUsers[room].splice(index, 1);
      this.server
        .to(room)
        .emit('userLeft', { userId: this.clientNickname[client.id], room });
      this.server
        .to(room)
        .emit('userList', { room, userList: this.roomUsers[room] });
    }
    Object.keys(this.roomUsers).forEach((room) => {
      this.server
        .to(room)
        .emit('userList', { room, userList: this.roomUsers[room] });
    });

    this.server.emit('userList', {
      room: null,
      userList: Object.keys(this.connectedClients),
    });
  }
  @SubscribeMessage('getUserList')
  handleGetUserList(client: Socket, room: string): void {
    this.server
      .to(room)
      .emit('userList', { room, userList: this.roomUsers[room] });
  }
  @SubscribeMessage('uploadImage')
  handleSendMessageWithImage(
    client: Socket,
    data: { message: string; image: string; room: string },
  ): void {
    console.log('message' + data.message);
    console.log('image' + data.image);
    this.server.to(data.room).emit('messageWithImage', {
      userId: this.clientNickname[client.id],
      message: data.message,
      image: data.image,
      room: data.room,
    });
  }
}
