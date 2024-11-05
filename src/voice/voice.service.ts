import { Injectable, Inject } from '@nestjs/common';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnection } from '@discordjs/voice';
import * as ytdl from 'ytdl-core';
import { Client, Guild } from 'discord.js';
import { Track } from './track.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class VoiceService {
  private connections: Map<string, VoiceConnection> = new Map();
  private queues: Map<string, Track[]> = new Map();
  private players: Map<string, any> = new Map();
  private currentTracks: Map<string, Track> = new Map();

  constructor(
    @Inject(Client) private readonly client: Client,
    @InjectRepository(Track)
    private trackRepository: Repository<Track>,
  ) {}

  getCurrentTrack(guildId: string): Track | undefined {
    return this.currentTracks.get(guildId);
  }

  joinChannel(guildId: string, channelId: string) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Гильдия не найдена.');

    const connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator: guild.voiceAdapterCreator as any,
    });

    this.connections.set(guildId, connection);
    this.queues.set(guildId, []);
    return connection;
  }

  async playAudio(guildId: string, url: string, requestedBy: string) {
    const connection = this.connections.get(guildId);
    if (!connection) throw new Error('Бот не подключен к голосовому каналу.');

    const queue = this.queues.get(guildId);
    if (!queue) throw new Error('Очередь не инициализирована.');

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title;

    const track = this.trackRepository.create({
      url,
      title,
      requestedBy,
    });
    await this.trackRepository.save(track);

    queue.push(track);

    if (!this.players.has(guildId)) {
      this.playNext(guildId);
    }
  }

  private async playNext(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) {
      this.players.delete(guildId);
      const connection = this.connections.get(guildId);
      if (connection) {
        connection.destroy();
        this.connections.delete(guildId);
      }
      return;
    }

    const track = queue.shift();
    await this.trackRepository.remove(track); 

    const connection = this.connections.get(guildId);
    if (!connection) throw new Error('Бот не подключен к голосовому каналу.');

    const stream = ytdl(track.url, { filter: 'audioonly', highWaterMark: 1 << 25 });
    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    this.players.set(guildId, player);

    player.on(AudioPlayerStatus.Idle, () => {
      this.playNext(guildId);
    });

    player.on('error', error => {
      console.error(`Ошибка воспроизведения: ${error.message}`);
      this.playNext(guildId);
    });
  }

  pause(guildId: string) {
    const player = this.players.get(guildId);
    if (player) {
      player.pause();
    }
  }

  resume(guildId: string) {
    const player = this.players.get(guildId);
    if (player) {
      player.unpause();
    }
  }

  stop(guildId: string) {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      this.queues.set(guildId, []);
    }
  }
  
  getQueue(guildId: string): Track[] {
    const queue = this.queues.get(guildId);
    return queue ? [...queue] : [];
  }
  
  skip(guildId: string) {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
    }
}
}
