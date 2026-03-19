// ============================================================
// IMAGE UPLOAD MODULE — S3 / Cloudflare R2
// Install: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
//          npm install multer @types/multer sharp
// ============================================================

// ── upload.service.ts ─────────────────────────────────────────
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client, PutObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as sharp from 'sharp';
import { randomUUID } from 'crypto';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const COVER_SIZES = [
  { suffix: 'sm',   width: 150, height: 225 },  // card thumbnail
  { suffix: 'md',   width: 300, height: 450 },  // detail page
  { suffix: 'lg',   width: 600, height: 900 },  // hero / og
] as const;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3: S3Client;
  private bucket: string;
  private cdnUrl: string;

  constructor(private config: ConfigService) {
    // Works with AWS S3 and Cloudflare R2 (R2 exposes S3-compatible API)
    this.s3 = new S3Client({
      region: config.get('S3_REGION', 'auto'),
      endpoint: config.get<string>('S3_ENDPOINT'), // R2: https://<account>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId:     config.getOrThrow('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
      },
    });
    this.bucket = config.getOrThrow('S3_BUCKET');
    this.cdnUrl = config.getOrThrow('CDN_URL'); // e.g. https://cdn.anirate.app
  }

  // ── Upload anime cover art ─────────────────────────────────
  async uploadCover(file: Express.Multer.File): Promise<{
    sm: string; md: string; lg: string; original: string;
  }> {
    this.validateFile(file);

    const id = randomUUID();
    const uploads: Promise<void>[] = [];
    const urls: Record<string, string> = {};

    // Process and upload each size in parallel
    for (const { suffix, width, height } of COVER_SIZES) {
      const key = `covers/${id}/${suffix}.webp`;
      const buffer = await sharp(file.buffer)
        .resize(width, height, { fit: 'cover', position: 'attention' })
        .webp({ quality: 85 })
        .toBuffer();

      uploads.push(
        this.putObject(key, buffer, 'image/webp').then(() => {
          urls[suffix] = `${this.cdnUrl}/${key}`;
        }),
      );
    }

    // Also keep a clean original (just converted to webp, not resized)
    const origKey = `covers/${id}/orig.webp`;
    const origBuf = await sharp(file.buffer).webp({ quality: 90 }).toBuffer();
    uploads.push(
      this.putObject(origKey, origBuf, 'image/webp').then(() => {
        urls['original'] = `${this.cdnUrl}/${origKey}`;
      }),
    );

    await Promise.all(uploads);
    this.logger.log(`Uploaded cover ${id} (4 variants)`);

    return urls as { sm: string; md: string; lg: string; original: string };
  }

  // ── Delete a cover (all variants) ─────────────────────────
  async deleteCover(coverUrl: string): Promise<void> {
    // Extract id from URL: .../covers/{id}/{suffix}.webp
    const match = coverUrl.match(/covers\/([^/]+)\//);
    if (!match) return;
    const id = match[1];
    const variants = ['sm', 'md', 'lg', 'orig'];
    await Promise.allSettled(
      variants.map((v) => this.deleteObject(`covers/${id}/${v}.webp`)),
    );
  }

  // ── Internal helpers ───────────────────────────────────────
  private async putObject(key: string, body: Buffer, contentType: string) {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: { 'uploaded-at': new Date().toISOString() },
    }));
  }

  private async deleteObject(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_BYTES / 1024 / 1024}MB)`);
    }
    if (!ALLOWED_MIME.includes(file.mimetype as any)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }
  }
}

// ── upload.controller.ts ──────────────────────────────────────
import {
  Controller, Post, Delete, Param, UseGuards, UseInterceptors,
  UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/strategies/jwt.strategy';
import { RolesGuard, Roles } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private prisma: PrismaService,
  ) {}

  @Post('cover/:animeId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // keep in memory for sharp processing
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadCover(
    @Param('animeId') animeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const urls = await this.uploadService.uploadCover(file);

    // Update the anime record with the md URL (used in catalog)
    await this.prisma.anime.update({
      where: { id: animeId },
      data: { coverImageUrl: urls.md },
    });

    return { urls };
  }

  @Delete('cover/:animeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCover(@Param('animeId') animeId: string) {
    const anime = await this.prisma.anime.findUnique({ where: { id: animeId } });
    if (anime?.coverImageUrl) {
      await this.uploadService.deleteCover(anime.coverImageUrl);
    }
    await this.prisma.anime.update({
      where: { id: animeId },
      data: { coverImageUrl: null },
    });
  }
}

// ── upload.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({ controllers: [UploadController], providers: [UploadService] })
export class UploadModule {}

// ── Environment variables to add ─────────────────────────────
/*
S3_REGION=auto
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com   # R2 endpoint (or omit for AWS)
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=anirate-media
CDN_URL=https://cdn.anirate.app                              # Cloudflare R2 custom domain or CloudFront
*/

// ── Cloudflare R2 setup (free tier: 10GB storage, 1M writes/month) ─
/*
1. Cloudflare Dashboard → R2 → Create bucket (name: anirate-media)
2. Manage R2 API Tokens → Create token (Object Read & Write)
3. Copy Account ID, Access Key ID, Secret Access Key
4. Set a custom domain for public access: R2 → bucket → Settings → Custom Domain
5. Use that domain as CDN_URL
*/

// ── AWS S3 setup (if preferred over R2) ──────────────────────
/*
1. Create S3 bucket with public read via bucket policy
2. Create IAM user with s3:PutObject, s3:DeleteObject permissions
3. Set S3_REGION to your bucket region (e.g. us-east-1)
4. Leave S3_ENDPOINT unset (SDK uses default AWS endpoint)
5. Set CDN_URL to CloudFront distribution or s3.amazonaws.com/bucket
*/
