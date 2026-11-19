import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const inputPath = resolve('./entry.png');
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const outputPath = join(outputDir, 'entry.png');
const maxBytes = 1_048_576;
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message: string): never {
  console.error(`PNG validation failed: ${message}`);
  process.exit(1);
}

function readDimensions(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

try {
  const image = await readFile(inputPath);

  if (image.length > maxBytes) fail(`file is ${image.length} bytes; maximum is ${maxBytes}`);
  if (image.length < 33) fail('file is too short to contain a PNG header and IEND chunk');
  if (!image.subarray(0, 8).equals(signature)) fail('invalid PNG signature');
  if (image.toString('ascii', 12, 16) !== 'IHDR' || image.readUInt32BE(8) !== 13) {
    fail('missing or invalid IHDR chunk');
  }

  const iendOffset = image.length - 12;
  if (image.readUInt32BE(iendOffset) !== 0 || image.toString('ascii', iendOffset + 4, iendOffset + 8) !== 'IEND') {
    fail('IEND chunk is not present at the end of the file');
  }

  const { width, height } = readDimensions(image);
  if (width > 1024 || height > 1024) fail(`dimensions ${width}x${height} exceed 1024x1024`);

  await mkdir(outputDir, { recursive: true });
  await copyFile(inputPath, outputPath);
  console.log(`Wrote ${outputPath} (${image.length} bytes)`);
} catch (error) {
  console.error(`Unable to process entry.png: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
