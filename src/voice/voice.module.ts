import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from './track.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Track])],
  providers: [VoiceService]
})
export class VoiceModule {}
