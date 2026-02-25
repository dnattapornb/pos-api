import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi, WebhookEvent } from '@line/bot-sdk';
import { OcrService } from '../ocr/ocr.service';
import { buildReceiptFlexMessage } from './flex.builder';

const { MessagingApiClient, MessagingApiBlobClient } = messagingApi;

@Injectable()
export class LineService {
    private readonly logger = new Logger(LineService.name);
    private readonly lineClient: messagingApi.MessagingApiClient;
    private readonly lineBlobClient: messagingApi.MessagingApiBlobClient;

    constructor(
        private readonly configService: ConfigService,
        private readonly ocrService: OcrService,
    ) {
        const channelAccessToken =
            this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN')?.trim() ?? '';
        this.lineClient = new MessagingApiClient({ channelAccessToken });
        this.lineBlobClient = new MessagingApiBlobClient({ channelAccessToken });
    }

    async handleWebhook(events: WebhookEvent[]): Promise<void> {
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'image') {
                await this.handleImageMessage(event);
            } else if (event.type === 'postback') {
                await this.handlePostback(event);
            } else {
                this.logger.debug(
                    `Ignored event type: ${event.type} / message type: ${(event as any).message?.type}`,
                );
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Handle incoming image: OCR → Gemini → Flex Message reply
    // ─────────────────────────────────────────────────────────
    private async handleImageMessage(event: any): Promise<void> {
        const userId: string = event.source?.userId ?? 'unknown';
        this.logger.log(`Processing image. msgId: ${event.message.id}, userId: ${userId}`);

        // 0. Filter by allowed userId
        const allowedUserId = 'Uf327dc13da3f951e3a0ef8176d0bf7ba';
        if (userId !== allowedUserId) {
            this.logger.warn(`Unauthorized user: ${userId}`);
            await this.safeReplyText(event.replyToken, 'ขออภัย คุณไม่มีสิทธิ์ใช้งานบอทนี้');
            return;
        }

        try {
            // 1. Download image
            const stream = (await this.lineBlobClient.getMessageContent(event.message.id)) as any;
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk as Buffer);
            }
            const imageBuffer = Buffer.concat(chunks);
            this.logger.log(`Image downloaded: ${imageBuffer.length} bytes`);

            // 2. OCR → Gemini structured parse
            this.logger.log('Starting processReceipt pipeline...');
            const receiptData = await this.ocrService.processReceipt(imageBuffer);

            // 3. Generate unique receipt ID (timestamp + random suffix)
            const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.logger.log(`Generated receiptId: ${receiptId}`);

            // 4. Build Flex Message and reply
            const flexMessage = buildReceiptFlexMessage(receiptData, receiptId);

            if (event.replyToken) {
                await this.lineClient.replyMessage({
                    replyToken: event.replyToken,
                    messages: [flexMessage],
                });
                this.logger.log(`Flex message sent to userId: ${userId}, receiptId: ${receiptId}`);
            }
        } catch (error: any) {
            this.logger.error(`Error processing image: ${error.message}`, error.stack);
            await this.safeReplyText(
                event.replyToken,
                'ขออภัย เกิดข้อผิดพลาดในการประมวลผลใบเสร็จ กรุณาลองใหม่อีกครั้ง',
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Handle Postback: action=approve&id=<receiptId>
    // ─────────────────────────────────────────────────────────
    private async handlePostback(event: any): Promise<void> {
        const data: string = event.postback?.data ?? '';
        const params = new URLSearchParams(data);
        const action = params.get('action');
        const receiptId = params.get('id');

        this.logger.log(`Postback received: action=${action}, receiptId=${receiptId}`);

        if (action === 'approve') {
            await this.safeReplyText(
                event.replyToken,
                `✅ บันทึกใบเสร็จสำเร็จแล้ว!\nรหัสใบเสร็จ: ${receiptId ?? 'N/A'}`,
            );
        } else {
            this.logger.warn(`Unknown postback action: ${action}`);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Utility: send a plain text reply without crashing the bot
    // ─────────────────────────────────────────────────────────
    private async safeReplyText(replyToken: string | undefined, text: string): Promise<void> {
        if (!replyToken) return;
        try {
            await this.lineClient.replyMessage({
                replyToken,
                messages: [{ type: 'text', text }],
            });
        } catch (e: any) {
            this.logger.error(`Failed to send text reply: ${e.message}`);
        }
    }
}
