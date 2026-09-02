import { redis } from "../libs/redis.ts";

export interface UserLocationPayload {
  userId: string;
  username: string;
  avatarUrl?: string | undefined;
  latitude: number;
  longitude: number;
  updatedAt: number;
}

const ROOM_LOCATION_TTL_SECONDS = 60 * 60 * 5; // 5 horas de retenção máxima por rolê

export class LocationService {
  private static getKey(roomId: string) {
    return `room:${roomId}:locations`;
  }

  // Atualiza a coordenada de um usuário e renova o TTL da sala
  static async updateLocation(
    roomId: string,
    data: UserLocationPayload,
  ): Promise<void> {
    const key = this.getKey(roomId);
    await redis
      .multi()
      .hset(key, data.userId, JSON.stringify(data))
      .expire(key, ROOM_LOCATION_TTL_SECONDS)
      .exec();
  }

  // Retorna o snapshot com todos os participantes ativos da sala
  static async getRoomLocations(
    roomId: string,
  ): Promise<UserLocationPayload[]> {
    const key = this.getKey(roomId);
    const rawData = await redis.hgetall(key);

    if (!rawData || Object.keys(rawData).length === 0) {
      return [];
    }

    return Object.values(rawData).map((item) => JSON.parse(item));
  }

  // Remove o usuário do mapa ao pausar o compartilhamento ou sair
  static async removeUserLocation(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const key = this.getKey(roomId);
    await redis.hdel(key, userId);
  }
}
