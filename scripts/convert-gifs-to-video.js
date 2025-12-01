#!/usr/bin/env node
/**
 * Converts GIF cover art to MP4/WebM video format for better performance
 * GIFs are 40MB+, videos will be 1-3MB
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const OUTPUT_DIR = path.join(__dirname, '../public/videos/covers');
const MAPPING_FILE = path.join(__dirname, '../public/data/gif-video-mapping.json');

// GIF URLs to convert (from albums-with-colors.json)
const GIF_URLS = [
  'https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/polarembrace/art/Polar-Embrace-Feed-art-hires.gif',
  'https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/autumnrust/art/Autumn-Rust-Feed-Art.gif',
  'https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/art/the%20satellite%20skirmish%20mku.gif',
  // Additional GIFs used in tracks
  'https://behindthesch3m3s.com/wp-content/uploads/2025/01/polar-embrace-boost-recap.gif',
  'https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/autumnrust/art/autumn-rust-boost-recap.gif',
  'https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/sat-skirmish-boost-recap-2.gif',
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getFilename(url) {
  const urlPath = decodeURIComponent(new URL(url).pathname);
  const basename = path.basename(urlPath, '.gif');
  // Create a safe filename
  return basename.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    console.log(`  Downloading: ${url}`);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = totalSize ? Math.round((downloaded / totalSize) * 100) : '?';
        process.stdout.write(`\r  Progress: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(' - Done');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function convertToVideo(inputPath, outputPath, format) {
  return new Promise((resolve, reject) => {
    console.log(`  Converting to ${format}...`);

    let command = ffmpeg(inputPath)
      .inputOptions(['-i', inputPath]);

    if (format === 'webm') {
      command
        .outputOptions([
          '-c:v', 'libvpx-vp9',  // VP9 codec for WebM
          '-crf', '30',          // Quality (lower = better, 30 is good for web)
          '-b:v', '0',           // Variable bitrate
          '-vf', 'scale=640:-1:flags=lanczos', // Scale to 640px width
          '-an',                 // No audio
          '-loop', '0',          // Loop forever
        ]);
    } else {
      command
        .outputOptions([
          '-c:v', 'libx264',     // H.264 codec for MP4
          '-crf', '23',          // Quality (lower = better)
          '-preset', 'slow',     // Better compression
          '-vf', 'scale=640:-1:flags=lanczos', // Scale to 640px width
          '-an',                 // No audio
          '-movflags', '+faststart', // Enable streaming
          '-pix_fmt', 'yuv420p', // Compatibility
        ]);
    }

    command
      .output(outputPath)
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r  Converting: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(' - Done');
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

async function processGif(url) {
  const filename = getFilename(url);
  const tempGifPath = path.join(OUTPUT_DIR, `${filename}.gif`);
  const webmPath = path.join(OUTPUT_DIR, `${filename}.webm`);
  const mp4Path = path.join(OUTPUT_DIR, `${filename}.mp4`);

  console.log(`\nProcessing: ${filename}`);

  try {
    // Download GIF
    await downloadFile(url, tempGifPath);

    const gifSize = fs.statSync(tempGifPath).size;
    console.log(`  GIF size: ${(gifSize / 1024 / 1024).toFixed(1)}MB`);

    // Convert to WebM (best compression)
    await convertToVideo(tempGifPath, webmPath, 'webm');
    const webmSize = fs.statSync(webmPath).size;
    console.log(`  WebM size: ${(webmSize / 1024 / 1024).toFixed(2)}MB (${Math.round((1 - webmSize/gifSize) * 100)}% smaller)`);

    // Convert to MP4 (best compatibility)
    await convertToVideo(tempGifPath, mp4Path, 'mp4');
    const mp4Size = fs.statSync(mp4Path).size;
    console.log(`  MP4 size: ${(mp4Size / 1024 / 1024).toFixed(2)}MB (${Math.round((1 - mp4Size/gifSize) * 100)}% smaller)`);

    // Remove temp GIF
    fs.unlinkSync(tempGifPath);

    return {
      original: url,
      webm: `/videos/covers/${filename}.webm`,
      mp4: `/videos/covers/${filename}.mp4`,
      savings: {
        webm: Math.round((1 - webmSize/gifSize) * 100),
        mp4: Math.round((1 - mp4Size/gifSize) * 100),
      }
    };
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    // Clean up temp files
    if (fs.existsSync(tempGifPath)) fs.unlinkSync(tempGifPath);
    return null;
  }
}

async function main() {
  console.log('=== GIF to Video Converter ===\n');
  console.log(`Converting ${GIF_URLS.length} GIFs to video format...`);

  const mapping = {};

  for (const url of GIF_URLS) {
    const result = await processGif(url);
    if (result) {
      mapping[result.original] = {
        webm: result.webm,
        mp4: result.mp4,
      };
    }
  }

  // Save mapping file
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  console.log(`\nMapping saved to: ${MAPPING_FILE}`);

  console.log('\n=== Conversion Complete ===');
  console.log(`Converted ${Object.keys(mapping).length}/${GIF_URLS.length} GIFs`);
}

main().catch(console.error);
