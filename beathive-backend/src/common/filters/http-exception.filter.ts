/**
 * http-exception.filter.ts
 *
 * Global exception filter yang:
 * 1. Menyembunyikan stack trace & internal detail di production
 * 2. Format response error yang konsisten
 * 3. Mencegah bocornya informasi sensitif (versi lib, path file, dsb)
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message ?? message;
        error = resObj.error ?? error;
      }
    } else if (exception instanceof Error) {
      // Log error internal — jangan tampilkan ke client
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        this.isProd ? undefined : exception.stack,
      );
    }

    // Di production: jangan bocorkan detail error 500
    if (this.isProd && status >= 500) {
      message = 'Terjadi kesalahan pada server. Silakan coba lagi.';
      error = 'Internal Server Error';
    }

    // Log semua error dengan info request (tanpa body untuk keamanan)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        this.isProd ? undefined : (exception instanceof Error ? exception.stack : String(exception)),
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      // Sertakan path tapi JANGAN sertakan stack trace
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
