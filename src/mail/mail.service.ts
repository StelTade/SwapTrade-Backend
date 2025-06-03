import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  async sendVerificationEmail(to: string, token: string) {
    const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    await this.transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: 'Verify Your Email',
      html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`
    });
  }
}