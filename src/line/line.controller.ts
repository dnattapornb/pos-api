import { Controller, Post, Body, Headers, Logger, Req, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { LineService } from './line.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('webhook')
export class LineController {
    private readonly logger = new Logger(LineController.name);

    constructor(
        private readonly lineService: LineService,
        private configService: ConfigService,
    ) { }

    @Post()
    async handleWebhook(
        @Req() req: any,
        @Body() body: any,
        @Headers('x-line-signature') signature: string,
    ) {
        const channelSecret = this.configService.get<string>('LINE_CHANNEL_SECRET')?.trim();
        if (channelSecret && signature && req.rawBody) {
            const hash = crypto.createHmac('SHA256', channelSecret).update(req.rawBody).digest('base64');
            if (hash !== signature) {
                this.logger.warn('Invalid LINE signature. Check LINE_CHANNEL_SECRET or request source.');
            } else {
                this.logger.debug('LINE signature validated successfully.');
            }
        } else {
            this.logger.warn('Missing channelSecret, signature, or rawBody for validation.');
        }

        try {
            const events = body.events || [];
            await this.lineService.handleWebhook(events);
            return { status: 'success' };
        } catch (error) {
            this.logger.error('Error handling webhook', error);
            return { status: 'error' };
        }
    }
}
