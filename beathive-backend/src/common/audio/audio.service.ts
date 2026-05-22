// src/common/audio/audio.service.ts
import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as mm from 'music-metadata';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  // ─── Generate preview 30 detik ──────────────────────────

  async generatePreview(
    inputBuffer: Buffer,
    inputFormat: string,
  ): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `${uuidv4()}.${inputFormat}`);
    const outputPath = path.join(tmpDir, `${uuidv4()}-preview.mp3`);

    try {
      // Tulis input ke file sementara
      fs.writeFileSync(inputPath, inputBuffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .duration(30)          // Potong jadi max 30 detik
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .audioFrequency(44100)
          .audioChannels(2)
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      return fs.readFileSync(outputPath);
    } finally {
      // Bersihkan file sementara
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }

  // ─── Generate waveform data untuk visualizer ────────────

  async generateWaveform(
    inputBuffer: Buffer,
    inputFormat: string,
    bars = 100, // jumlah bar yang dirender di frontend
  ): Promise<number[]> {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `${uuidv4()}.${inputFormat}`);
    const rawPath = path.join(tmpDir, `${uuidv4()}.raw`);

    try {
      fs.writeFileSync(inputPath, inputBuffer);

      // Konversi ke raw PCM 8-bit mono
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFrequency(8000)   // sample rate rendah — cukup untuk waveform
          .audioChannels(1)
          .audioCodec('pcm_u8')
          .format('u8')
          .on('end', resolve)
          .on('error', reject)
          .save(rawPath);
      });

      const raw = fs.readFileSync(rawPath);
      return this.rawToWaveform(raw, bars);
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    }
  }

  // ─── Get durasi audio dalam milidetik ───────────────────

  async getDuration(inputBuffer: Buffer, inputFormat: string): Promise<number> {
    // music-metadata: akurat untuk MP3 VBR/CBR, WAV, OGG, FLAC, dll
    try {
      const fmt = inputFormat.toLowerCase();
      const mimeType = fmt === 'mp3' ? 'audio/mpeg' : fmt === 'wav' ? 'audio/wav' : fmt === 'ogg' ? 'audio/ogg' : fmt === 'flac' ? 'audio/flac' : `audio/${fmt}`;
      const metadata = await mm.parseBuffer(inputBuffer, { mimeType });
      const durationSec = metadata.format.duration;
      if (durationSec && durationSec > 0) {
        this.logger.debug(`Duration via music-metadata: ${Math.round(durationSec * 1000)}ms`);
        return Math.round(durationSec * 1000);
      }
    } catch (e: any) {
      this.logger.debug(`music-metadata failed: ${e.message}`);
    }

    // Fallback ke FFmpeg
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `${uuidv4()}.${inputFormat}`);
    try {
      fs.writeFileSync(inputPath, inputBuffer);
      return await new Promise((resolve) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            this.logger.debug(`FFprobe tidak tersedia: ${err.message}`);
            resolve(0);
            return;
          }
          const durationSec = metadata.format.duration || 0;
          resolve(Math.round(durationSec * 1000));
        });
      });
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
  }

  // ─── DEPRECATED — kept for reference only, no longer called ──────

  private getDurationFromHeader(buffer: Buffer, format: string): number {
    try {
      const fmt = format.toLowerCase();

      if (fmt === 'wav' || fmt === 'wave') {
        return this.getWavDuration(buffer);
      }

      if (fmt === 'mp3') {
        return this.getMp3DurationEstimate(buffer);
      }

      if (fmt === 'ogg') {
        return this.getOggDuration(buffer);
      }
    } catch {
      // ignore — fallback ke FFmpeg
    }
    return 0;
  }

  private getWavDuration(buffer: Buffer): number {
    if (buffer.length < 44) return 0;
    // Cek "RIFF" dan "WAVE" signature
    if (buffer.toString('ascii', 0, 4) !== 'RIFF') return 0;
    if (buffer.toString('ascii', 8, 12) !== 'WAVE') return 0;

    // Scan chunks untuk fmt dan data
    // WAV fmt chunk layout (offsets from chunk header start):
    //  +0  : "fmt " (4 bytes)
    //  +4  : chunk size (4 bytes)
    //  +8  : audio format (2 bytes, PCM=1)
    //  +10 : num channels (2 bytes)
    //  +12 : sample rate (4 bytes)   ← bukan byte rate!
    //  +16 : byte rate (4 bytes)     ← ini yang kita butuhkan
    //  +20 : block align (2 bytes)
    //  +22 : bits per sample (2 bytes)
    let byteRate = 0;
    let i = 12;
    while (i + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', i, i + 4);
      const chunkSize = buffer.readUInt32LE(i + 4);

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        byteRate = buffer.readUInt32LE(i + 16); // byte rate, bukan sample rate
      }

      if (chunkId === 'data' && byteRate > 0) {
        const dataBytes = buffer.readUInt32LE(i + 4);
        return Math.round((dataBytes / byteRate) * 1000);
      }

      i += 8 + chunkSize;
      if (chunkSize % 2 !== 0) i++; // WAV chunks are word-aligned
    }
    return 0;
  }

  private getMp3DurationEstimate(buffer: Buffer): number {
    // ─── Tabel bitrate per MPEG version & layer ──────────────
    // Index 0 = free, 15 = bad → skip keduanya
    const bitrateTable: Record<string, number[]> = {
      // MPEG1 Layer 3
      '11-01': [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],
      // MPEG1 Layer 2
      '11-10': [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384,0],
      // MPEG1 Layer 1
      '11-11': [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448,0],
      // MPEG2/2.5 Layer 3
      '00-01': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],
      '10-01': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],
      // MPEG2/2.5 Layer 2
      '00-10': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],
      '10-10': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],
      // MPEG2/2.5 Layer 1
      '00-11': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,0],
      '10-11': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,0],
    };

    const sampleRateTable: Record<string, number[]> = {
      '11': [44100, 48000, 32000],  // MPEG1
      '10': [22050, 24000, 16000],  // MPEG2
      '00': [11025, 12000, 8000],   // MPEG2.5
    };

    // Samples per frame per MPEG version & layer
    const samplesPerFrameTable: Record<string, number> = {
      '11-01': 1152,  // MPEG1 Layer 3
      '11-10': 1152,  // MPEG1 Layer 2
      '11-11': 384,   // MPEG1 Layer 1
      '10-01': 576,   // MPEG2 Layer 3
      '10-10': 1152,  // MPEG2 Layer 2
      '10-11': 384,   // MPEG2 Layer 1
      '00-01': 576,   // MPEG2.5 Layer 3
      '00-10': 1152,  // MPEG2.5 Layer 2
      '00-11': 384,   // MPEG2.5 Layer 1
    };

    // ─── Cari frame sync pertama ─────────────────────────────
    let firstFrameOffset = -1;
    let mpegVer = '';
    let layerBits = '';
    let sampleRate = 0;
    let samplesPerFrame = 0;

    for (let i = 0; i < Math.min(buffer.length - 4, 512 * 1024); i++) {
      if (buffer[i] !== 0xFF) continue;
      const b1 = buffer[i + 1];
      if ((b1 & 0xE0) !== 0xE0) continue;

      const verBits = ((b1 >> 3) & 0x03).toString(2).padStart(2, '0');
      const lBits = ((b1 >> 1) & 0x03).toString(2).padStart(2, '0');
      if (verBits === '01' || lBits === '00') continue; // reserved

      const srIdx = (buffer[i + 2] >> 2) & 0x03;
      if (srIdx === 3) continue;

      const srArr = sampleRateTable[verBits];
      if (!srArr) continue;

      firstFrameOffset = i;
      mpegVer = verBits;
      layerBits = lBits;
      sampleRate = srArr[srIdx];
      samplesPerFrame = samplesPerFrameTable[`${verBits}-${lBits}`] || 1152;
      break;
    }

    if (firstFrameOffset < 0 || sampleRate === 0) return 0;

    // ─── Cek Xing/VBRI header di frame pertama ──────────────
    // Xing header biasanya ada di offset tertentu dari frame pertama
    const xingDuration = this.tryXingVbriDuration(
      buffer, firstFrameOffset, mpegVer, layerBits, sampleRate, samplesPerFrame,
    );
    if (xingDuration > 0) return xingDuration;

    // ─── Fallback: sampling beberapa frame untuk rata-rata bitrate ──
    const key = `${mpegVer}-${layerBits}`;
    const brTable = bitrateTable[key];
    if (!brTable) return 0;

    let totalBitrate = 0;
    let frameCount = 0;
    const maxSample = 64; // sample max 64 frame untuk estimasi
    let offset = firstFrameOffset;

    while (offset < buffer.length - 4 && frameCount < maxSample) {
      if (buffer[offset] !== 0xFF || (buffer[offset + 1] & 0xE0) !== 0xE0) {
        offset++;
        continue;
      }

      const b1 = buffer[offset + 1];
      const curVer = ((b1 >> 3) & 0x03).toString(2).padStart(2, '0');
      const curLayer = ((b1 >> 1) & 0x03).toString(2).padStart(2, '0');
      if (curVer !== mpegVer || curLayer !== layerBits) { offset++; continue; }

      const brIdx = (buffer[offset + 2] >> 4) & 0x0F;
      const srIdx = (buffer[offset + 2] >> 2) & 0x03;
      const padding = (buffer[offset + 2] >> 1) & 0x01;

      if (brIdx === 0 || brIdx === 15 || srIdx === 3) { offset++; continue; }

      const br = brTable[brIdx] * 1000;
      if (!br) { offset++; continue; }

      totalBitrate += br;
      frameCount++;

      // Hitung frame size dan lompat ke frame berikutnya
      const curSr = (sampleRateTable[mpegVer] || [])[srIdx] || sampleRate;
      let frameSize: number;
      if (layerBits === '11') {
        // Layer 1
        frameSize = Math.floor((12 * br / curSr + padding) * 4);
      } else {
        // Layer 2 & 3
        const spf = samplesPerFrame;
        frameSize = Math.floor(spf * br / (8 * curSr)) + padding;
      }

      if (frameSize < 1) { offset++; continue; }
      offset += frameSize;
    }

    if (frameCount === 0) return 0;

    const avgBitrate = totalBitrate / frameCount;
    const dataSizeBytes = buffer.length - firstFrameOffset;
    const durationMs = Math.round((dataSizeBytes * 8 * 1000) / avgBitrate);

    if (durationMs > 100 && durationMs < 3600000) return durationMs;
    return 0;
  }

  /**
   * Cari Xing atau VBRI header di frame pertama MP3 untuk durasi akurat pada file VBR.
   */
  private tryXingVbriDuration(
    buffer: Buffer,
    frameOffset: number,
    mpegVer: string,
    layerBits: string,
    sampleRate: number,
    samplesPerFrame: number,
  ): number {
    // Xing header offset tergantung MPEG version dan channel mode
    const channelMode = (buffer[frameOffset + 3] >> 6) & 0x03;
    let xingOffset: number;
    if (mpegVer === '11') {
      // MPEG1
      xingOffset = channelMode === 3 ? 17 : 32; // mono vs stereo
    } else {
      // MPEG2/2.5
      xingOffset = channelMode === 3 ? 9 : 17;
    }

    const searchStart = frameOffset + 4 + xingOffset;

    // Cari "Xing" atau "Info" tag
    for (const tag of ['Xing', 'Info']) {
      if (searchStart + 4 > buffer.length) continue;
      const found = buffer.toString('ascii', searchStart, searchStart + 4);
      if (found === tag) {
        const flags = buffer.readUInt32BE(searchStart + 4);
        if (flags & 0x01) {
          // Bit 0 = jumlah frame tersedia
          const totalFrames = buffer.readUInt32BE(searchStart + 8);
          if (totalFrames > 0 && totalFrames < 100000000) {
            const durationMs = Math.round((totalFrames * samplesPerFrame / sampleRate) * 1000);
            if (durationMs > 100 && durationMs < 3600000) {
              this.logger.debug(`Duration via Xing/Info header: ${durationMs}ms (${totalFrames} frames)`);
              return durationMs;
            }
          }
        }
      }
    }

    // Cari VBRI header (selalu di offset 36 dari frame start)
    const vbriOffset = frameOffset + 4 + 32;
    if (vbriOffset + 26 <= buffer.length) {
      const vbriTag = buffer.toString('ascii', vbriOffset, vbriOffset + 4);
      if (vbriTag === 'VBRI') {
        const totalFrames = buffer.readUInt32BE(vbriOffset + 14);
        if (totalFrames > 0 && totalFrames < 100000000) {
          const durationMs = Math.round((totalFrames * samplesPerFrame / sampleRate) * 1000);
          if (durationMs > 100 && durationMs < 3600000) {
            this.logger.debug(`Duration via VBRI header: ${durationMs}ms (${totalFrames} frames)`);
            return durationMs;
          }
        }
      }
    }

    return 0;
  }

  private getOggDuration(buffer: Buffer): number {
    // Cari granule position di Ogg page header untuk estimasi durasi
    // Ogg page header: OggS magic (4), version (1), type (1), granule (8 LE), ...
    for (let i = 0; i < buffer.length - 27; i++) {
      if (buffer.toString('ascii', i, i + 4) !== 'OggS') continue;
      // Read granule position (int64 LE at offset 6 from page start)
      // Use only lower 32 bits for reasonable durations
      const granuleLo = buffer.readUInt32LE(i + 6);
      if (granuleLo > 0) {
        // Vorbis default sample rate is 44100, but we don't know exactly
        // Use 44100 as estimate
        return Math.round((granuleLo / 44100) * 1000);
      }
    }
    return 0;
  }

  // ─── Helper: raw PCM → array bar heights ────────────────

  private rawToWaveform(raw: Buffer, bars: number): number[] {
    const samplesPerBar = Math.floor(raw.length / bars);
    const result: number[] = [];

    for (let i = 0; i < bars; i++) {
      let sum = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, raw.length);

      for (let j = start; j < end; j++) {
        // PCM u8: 128 = silence, 0/255 = peak
        sum += Math.abs(raw[j] - 128);
      }

      const avg = sum / (end - start);
      // Normalkan ke range 4–28 (cocok untuk tampilan di frontend)
      const normalized = Math.round(4 + (avg / 128) * 24);
      result.push(Math.min(28, Math.max(4, normalized)));
    }

    return result;
  }
}
