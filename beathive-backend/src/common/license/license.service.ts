// src/common/license/license.service.ts
import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { StorageService } from '../storage/storage.service';

interface LicenseData {
  buyerName: string;
  buyerEmail: string;
  soundTitle: string;
  soundId: string;
  licenseType: string;
  orderId: string;
  invoiceNumber: string;
  purchaseDate: Date;
}

@Injectable()
export class LicenseService {
  constructor(private storage: StorageService) {}

  async generateLicensePdf(data: LicenseData): Promise<string> {
    const pdfBuffer = await this.buildPdf(data);
    const key = await this.storage.uploadAudioFile(
      pdfBuffer,
      `license-${data.invoiceNumber}.pdf`,
      'application/pdf',
    );
    return key;
  }

  async generateLicenseBuffer(data: LicenseData): Promise<Buffer> {
    return this.buildPdf(data);
  }

  private buildPdf(data: LicenseData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const isCommercial = data.licenseType === 'commercial';
      const W = 595.28;
      const accentColor = '#6d28d9'; // violet-700
      const accentLight = '#ede9fe'; // violet-100
      const textDark = '#111827';
      const textMid = '#374151';
      const textLight = '#6b7280';

      // ── Top color bar ────────────────────────────────────
      doc.rect(0, 0, W, 8).fill(accentColor);

      // ── Header area ─────────────────────────────────────
      const hTop = 28;
      doc
        .fontSize(22).font('Helvetica-Bold').fillColor(accentColor)
        .text('Arsonus', 48, hTop);
      doc
        .fontSize(9).font('Helvetica').fillColor(textLight)
        .text('Sound Effect Marketplace  ·  Arsonus.com', 48, hTop + 26);

      // License type badge (top right)
      const badgeLabel = isCommercial ? 'COMMERCIAL LICENSE' : 'PERSONAL LICENSE';
      const badgeX = W - 48 - 130;
      doc.rect(badgeX, hTop, 130, 22).fill(isCommercial ? '#d97706' : accentColor);
      doc
        .fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
        .text(badgeLabel, badgeX, hTop + 7, { width: 130, align: 'center' });

      // Document title
      doc
        .fontSize(18).font('Helvetica-Bold').fillColor(textDark)
        .text('LICENSE CERTIFICATE', 48, hTop + 52);
      doc
        .fontSize(10).font('Helvetica').fillColor(textLight)
        .text(
          isCommercial
            ? 'This document certifies a Commercial License for the sound effect listed below.'
            : 'This document certifies a Personal License for the sound effect listed below.',
          48, hTop + 76, { width: W - 96 },
        );

      // Divider
      doc.rect(48, hTop + 104, W - 96, 1).fill('#e5e7eb');

      // ── License Info grid ────────────────────────────────
      const gridTop = hTop + 118;
      const col1x = 48;
      const col2x = W / 2 + 8;
      const colW = W / 2 - 64;

      const fields: [string, string][] = [
        ['Sound Effect', data.soundTitle],
        ['Sound ID', data.soundId],
        ['Licensee', data.buyerName],
        ['Email', data.buyerEmail],
        ['License Type', isCommercial ? 'Commercial' : 'Personal'],
        ['Invoice No.', data.invoiceNumber],
        ['Purchase Date', data.purchaseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Valid Until', 'Perpetual (Lifetime)'],
      ];

      fields.forEach(([label, value], i) => {
        const col = i % 2 === 0 ? col1x : col2x;
        const row = Math.floor(i / 2);
        const y = gridTop + row * 52;

        doc.fontSize(8).font('Helvetica').fillColor(textLight).text(label.toUpperCase(), col, y);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(textDark).text(value, col, y + 13, { width: colW, ellipsis: true });

        // bottom rule per row (only left col triggers it)
        if (i % 2 === 0 && i < fields.length - 2) {
          doc.rect(col1x, y + 44, W - 96, 0.5).fill('#f3f4f6');
        }
      });

      // ── Terms section ────────────────────────────────────
      const termsTop = gridTop + Math.ceil(fields.length / 2) * 52 + 20;

      // Section header bar
      doc.rect(48, termsTop, W - 96, 28).fill(accentLight);
      doc
        .fontSize(10).font('Helvetica-Bold').fillColor(accentColor)
        .text('USAGE TERMS & CONDITIONS', 56, termsTop + 9);

      const termsY = termsTop + 38;
      const termLineH = 19;

      if (isCommercial) {
        const allowed = [
          'Use in commercial projects (ads, films, games, paid content)',
          'Use in YouTube / social media (monetized or non-monetized)',
          'Modify and adapt the sound to fit your project needs',
          'Perpetual worldwide license — no expiry, no renewal required',
        ];
        const notAllowed = [
          'Resell, redistribute, or sublicense this audio file',
          'Claim the original sound as your own creative work',
          'Include in sample packs, libraries, or sound collections',
        ];

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#059669').text('YOU MAY:', 56, termsY);
        allowed.forEach((t, i) => {
          doc.circle(63, termsY + 18 + i * termLineH + 4, 3).fill('#059669');
          doc.fontSize(9).font('Helvetica').fillColor(textMid)
            .text(t, 74, termsY + 14 + i * termLineH);
        });

        const noY = termsY + 18 + allowed.length * termLineH + 10;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626').text('YOU MAY NOT:', 56, noY);
        notAllowed.forEach((t, i) => {
          doc.circle(63, noY + 18 + i * termLineH + 4, 3).fill('#dc2626');
          doc.fontSize(9).font('Helvetica').fillColor(textMid)
            .text(t, 74, noY + 14 + i * termLineH);
        });
      } else {
        const allowed = [
          'Use in personal, non-commercial creative projects',
          'Use in YouTube / social media (non-monetized channels)',
          'Use in school, portfolio, or passion projects',
          'Perpetual license — valid for lifetime of the project',
        ];
        const notAllowed = [
          'Use in commercial or revenue-generating projects',
          'Use in paid advertising, films, or client work',
          'Resell, redistribute, or sublicense this audio file',
          'Claim the original sound as your own creative work',
        ];

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#059669').text('YOU MAY:', 56, termsY);
        allowed.forEach((t, i) => {
          doc.circle(63, termsY + 18 + i * termLineH + 4, 3).fill('#059669');
          doc.fontSize(9).font('Helvetica').fillColor(textMid)
            .text(t, 74, termsY + 14 + i * termLineH);
        });

        const noY = termsY + 18 + allowed.length * termLineH + 10;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626').text('YOU MAY NOT:', 56, noY);
        notAllowed.forEach((t, i) => {
          doc.circle(63, noY + 18 + i * termLineH + 4, 3).fill('#dc2626');
          doc.fontSize(9).font('Helvetica').fillColor(textMid)
            .text(t, 74, noY + 14 + i * termLineH);
        });
      }

      // ── Footer ───────────────────────────────────────────
      doc.rect(0, 812, W, 8).fill(accentColor);
      doc
        .fontSize(8).font('Helvetica').fillColor(textLight)
        .text(
          `Verification ID: ${data.orderId}  ·  Generated by Arsonus  ·  This certificate is legally binding upon purchase.`,
          48, 790, { width: W - 96, align: 'center' },
        );

      doc.end();
    });
  }
}
