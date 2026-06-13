/**
 * file-magic.util.ts
 *
 * Validasi file header (magic bytes) dari buffer file.
 * Mencegah file berbahaya (PHP, EXE, dll) yang disamarkan dengan ekstensi audio.
 *
 * Format signatures:
 *  WAV  → "RIFF" (0x52 49 46 46) at offset 0
 *  MP3  → "ID3"  (0x49 44 33) at offset 0  OR  0xFF 0xFB/0xF3/0xF2 (MPEG sync word)
 *  OGG  → "OggS" (0x4F 67 67 53) at offset 0
 *  FLAC → "fLaC" (0x66 4C 61 43) at offset 0
 */
export function validateAudioMagicBytes(buffer: Buffer, declaredExt: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  const ext = declaredExt.toLowerCase().replace('.', '');

  switch (ext) {
    case 'wav': {
      // WAV: starts with "RIFF" then 4 bytes size then "WAVE"
      const riff = buffer.slice(0, 4).toString('ascii');
      const wave = buffer.length >= 12 ? buffer.slice(8, 12).toString('ascii') : '';
      return riff === 'RIFF' && wave === 'WAVE';
    }

    case 'mp3': {
      // ID3 tag header
      if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
      // MPEG sync word: 0xFF followed by 0xFB, 0xF3, or 0xF2
      if (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2)) return true;
      // Some encoders skip ID3 and start directly with frame sync 0xFFE or 0xFFF
      if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
      return false;
    }

    case 'ogg': {
      // OGG: "OggS"
      return buffer.slice(0, 4).toString('ascii') === 'OggS';
    }

    case 'flac': {
      // FLAC: "fLaC"
      return buffer.slice(0, 4).toString('ascii') === 'fLaC';
    }

    default:
      // Unknown extension — reject
      return false;
  }
}

/**
 * Sanitasi nama file upload: hapus path traversal, null bytes,
 * dan karakter berbahaya. Kembalikan nama file yang aman.
 */
export function sanitizeFilename(originalname: string): string {
  return originalname
    .replace(/\.\./g, '')        // hapus path traversal (..)
    .replace(/\//g, '')          // hapus forward slash
    .replace(/\\/g, '')          // hapus backslash
    .replace(/\x00/g, '')        // hapus null bytes
    .replace(/[<>:"'|?*]/g, '')  // hapus karakter berbahaya Windows
    .replace(/\s+/g, '_')        // spasi jadi underscore
    .slice(0, 200);              // batas panjang nama file
}
