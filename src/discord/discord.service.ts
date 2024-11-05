import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { VoiceService } from '../voice/voice.service';
import * as ytdl from 'ytdl-core';
import * as dotenv from 'dotenv';
import { Track } from 'src/voice/track.entity';

dotenv.config();

@Injectable()
export class DiscordService implements OnModuleInit {
  constructor(
    @Inject(Client) private readonly client: Client,
    private readonly voiceService: VoiceService,
  ) {}
  
  onModuleInit() {
    this.client.on('ready', () => {
      console.log(`Logged in as ${this.client.user.tag}!`);
    });
    

    this.client.on('messageCreate', async message => {
      if (message.author.bot) return;

      const args = message.content.trim().split(/ +/);
      const command = args.shift().toLowerCase();

      if (command === '!join') {
        const channel = message.member?.voice.channel;
        if (channel) {
          try {
            this.voiceService.joinChannel(message.guild.id, channel.id);
            message.reply('Подключился к голосовому каналу!');
          } catch (error) {
            console.error(error);
            message.reply('Не удалось подключиться к голосовому каналу.');
          }
        } else {
          message.reply('Вы должны быть в голосовом канале!');
        }
      }

      if (command === '!play') {
        const channel = message.member?.voice.channel;
        if (!channel) {
          return message.reply('Вы должны быть в голосовом канале, чтобы использовать эту команду.');
        }
      
        const url = args[0];
        if (ytdl.validateURL(url)) {
          try {
            await this.voiceService.playAudio(message.guild.id, url, message.author.username);
            message.reply('Добавил трек в очередь!');
          } catch (error) {
            console.error(error);
            message.reply('Произошла ошибка при добавлении трека.');
          }
        } else {
          message.reply('Неверный URL YouTube.');
        }
      }      

      if (command === '!queue') {
        const queue = this.voiceService.getQueue(message.guild.id);
        if (queue.length === 0) {
          message.reply('Очередь пуста.');
        } else {
          const trackList = queue.map((track, index) => `${index + 1}. ${track.title} (запросил: ${track.requestedBy})`).join('\n');
          message.reply(`**Очередь воспроизведения:**\n${trackList}`);
        }
      }

      if (command === '!pause') {
        this.voiceService.pause(message.guild.id);
        message.reply('Воспроизведение приостановлено.');
      }

      if (command === '!resume') {
        this.voiceService.resume(message.guild.id);
        message.reply('Воспроизведение возобновлено.');
      }

      if (command === '!skip') {
        this.voiceService.skip(message.guild.id);
        message.reply('Трек пропущен.');
      }

      if (command === '!stop') {
        this.voiceService.stop(message.guild.id);
        message.reply('Воспроизведение остановлено и очередь очищена.');
      }

      if (command === '!nowplaying') {
        const currentTrack = this.voiceService.getCurrentTrack(message.guild.id);
        if (currentTrack) {
          const embed = new EmbedBuilder()
            .setTitle('Сейчас воспроизводится')
            .setDescription(`[${currentTrack.title}](${currentTrack.url})`)
            // .addFields('Запросил', currentTrack.requestedBy, true)
            .setColor('#0099ff');
      
          message.reply({ embeds: [embed] });
        } else {
          message.reply('Сейчас ничего не воспроизводится.');
        }
    }
    });

    this.client.login(process.env.DISCORD_TOKEN);
  }
}
