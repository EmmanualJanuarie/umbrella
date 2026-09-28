const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

class IncrementalSha256 {
  private readonly state = INITIAL_STATE.slice();
  private readonly block = new Uint8Array(64);
  private blockLength = 0;
  private bytesHashed = 0;
  private finished = false;

  update(input: Uint8Array) {
    if (this.finished) throw new Error("SHA-256 digest has already been finalized");
    this.bytesHashed += input.byteLength;

    let offset = 0;
    while (offset < input.byteLength) {
      const length = Math.min(64 - this.blockLength, input.byteLength - offset);
      this.block.set(input.subarray(offset, offset + length), this.blockLength);
      this.blockLength += length;
      offset += length;

      if (this.blockLength === 64) {
        this.compress(this.block);
        this.blockLength = 0;
      }
    }
  }

  digestHex() {
    if (this.finished) throw new Error("SHA-256 digest has already been finalized");
    this.finished = true;

    const bitLength = this.bytesHashed * 8;
    this.block[this.blockLength++] = 0x80;

    if (this.blockLength > 56) {
      this.block.fill(0, this.blockLength);
      this.compress(this.block);
      this.blockLength = 0;
    }

    this.block.fill(0, this.blockLength, 56);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    const view = new DataView(this.block.buffer);
    view.setUint32(56, high, false);
    view.setUint32(60, low, false);
    this.compress(this.block);

    return Array.from(this.state)
      .map((word) => word.toString(16).padStart(8, "0"))
      .join("");
  }

  private compress(block: Uint8Array) {
    const words = new Uint32Array(64);
    const view = new DataView(block.buffer, block.byteOffset, 64);
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const sigma0 =
        rotateRight(previous15, 7) ^
        rotateRight(previous15, 18) ^
        (previous15 >>> 3);
      const sigma1 =
        rotateRight(previous2, 17) ^
        rotateRight(previous2, 19) ^
        (previous2 >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = Array.from(this.state);
    for (let index = 0; index < 64; index += 1) {
      const safeE = e ?? 0;
      const safeA = a ?? 0;
      const sum1 = rotateRight(safeE, 6) ^ rotateRight(safeE, 11) ^ rotateRight(safeE, 25);
      const choice = (safeE & (f ?? 0)) ^ (~safeE & (g ?? 0));
      const temp1 = ((h ?? 0) + sum1 + choice + (ROUND_CONSTANTS[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const sum0 = rotateRight(safeA, 2) ^ rotateRight(safeA, 13) ^ rotateRight(safeA, 22);
      const majority = (safeA & (b ?? 0)) ^ (safeA & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = ((d ?? 0) + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    const values = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 8; index += 1) {
      this.state[index] = ((this.state[index] ?? 0) + (values[index] ?? 0)) >>> 0;
    }
  }
}

export async function hashFileSha256(
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
) {
  const sha256 = new IncrementalSha256();
  const chunkSize = 4 * 1024 * 1024;

  for (let offset = 0; offset < file.size; offset += chunkSize) {
    if (signal?.aborted) throw new DOMException("Hashing cancelled", "AbortError");
    const bytes = new Uint8Array(
      await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer(),
    );
    sha256.update(bytes);
    onProgress?.(Math.min((offset + bytes.byteLength) / file.size, 1));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  return sha256.digestHex();
}

function hexToBase64(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return btoa(String.fromCharCode(...bytes));
}

export async function hashFileAndPartsSha256(
  file: File,
  partSize: number,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
) {
  if (!Number.isSafeInteger(partSize) || partSize <= 0) {
    throw new Error("Invalid multipart upload part size");
  }

  const fullHash = new IncrementalSha256();
  let partHash = new IncrementalSha256();
  let partBytes = 0;
  const partChecksumsSha256: string[] = [];
  const readSize = 4 * 1024 * 1024;

  for (let offset = 0; offset < file.size; offset += readSize) {
    if (signal?.aborted) throw new DOMException("Hashing cancelled", "AbortError");
    const bytes = new Uint8Array(
      await file.slice(offset, Math.min(offset + readSize, file.size)).arrayBuffer(),
    );
    fullHash.update(bytes);

    let cursor = 0;
    while (cursor < bytes.byteLength) {
      const length = Math.min(partSize - partBytes, bytes.byteLength - cursor);
      partHash.update(bytes.subarray(cursor, cursor + length));
      partBytes += length;
      cursor += length;

      if (partBytes === partSize) {
        partChecksumsSha256.push(hexToBase64(partHash.digestHex()));
        partHash = new IncrementalSha256();
        partBytes = 0;
      }
    }

    onProgress?.(Math.min((offset + bytes.byteLength) / file.size, 1));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  if (partBytes > 0) {
    partChecksumsSha256.push(hexToBase64(partHash.digestHex()));
  }

  return {
    fileHash: fullHash.digestHex(),
    partChecksumsSha256,
  };
}

export function hashBytesSha256(input: Uint8Array) {
  const sha256 = new IncrementalSha256();
  sha256.update(input);
  return sha256.digestHex();
}
