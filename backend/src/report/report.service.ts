import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { ObjectId } from 'mongodb';

@Injectable()
export class ReportService {
  constructor(private db: DatabaseService) {}

  async generate(userId: string, res: Response) {
    const angleData = await this.db.getDb().collection('angleData').find({ userId: new ObjectId(userId) }).toArray();
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);
    doc.text('Posture Report');
    angleData.forEach(d => {
      doc.text(`${d.timestamp.toISOString()}: roll ${d.roll}, pitch ${d.pitch}, yaw ${d.yaw}`);
    });
    doc.end();
  }
}