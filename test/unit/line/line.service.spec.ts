import { Test, TestingModule } from '@nestjs/testing';
import { messagingApi, WebhookEvent } from '@line/bot-sdk';
import { LineService } from '../../../src/line/line.service';
import { OcrService } from '../../../src/ocr/ocr.service';
import { ReceiptService } from '../../../src/receipt/receipt.service';
import { ConfigService } from '@nestjs/config';
import * as FlexBuilder from '../../../src/line/flex.builder';

jest.mock('@line/bot-sdk', () => ({
  messagingApi: {
    MessagingApiClient: jest.fn().mockImplementation(() => ({
      replyMessage: jest.fn(),
      pushMessage: jest.fn(),
    })),
    MessagingApiBlobClient: jest.fn().mockImplementation(() => ({
      getMessageContent: jest.fn(),
    })),
  },
}));

interface MockLineClient {
  replyMessage: jest.Mock;
  pushMessage: jest.Mock;
}

interface MockBlobClient {
  getMessageContent: jest.Mock;
}

interface MockOcrService {
  processReceipt: jest.Mock;
}

interface MockReceiptService {
  createReceipt: jest.Mock;
  getReceiptById: jest.Mock;
  approveReceipt: jest.Mock;
  cancelReceipt: jest.Mock;
}

// Exposes the private members/methods of LineService used by the tests.
type LineServiceInternal = {
  lineClient: MockLineClient;
  lineBlobClient: MockBlobClient;
  handleImageMessage: (event: unknown) => Promise<void>;
  handlePostback: (event: unknown) => Promise<void>;
  safeReplyText: (
    replyToken: string | undefined,
    text: string,
  ) => Promise<void>;
};

describe('LineService', () => {
  let service: LineService;
  let internal: LineServiceInternal;
  let mockOcrService: MockOcrService;
  let mockReceiptService: MockReceiptService;
  let mockLineClient: MockLineClient;
  let mockBlobClient: MockBlobClient;

  beforeEach(async () => {
    mockOcrService = {
      processReceipt: jest.fn(),
    };

    mockReceiptService = {
      createReceipt: jest.fn(),
      getReceiptById: jest.fn(),
      approveReceipt: jest.fn(),
      cancelReceipt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineService,
        { provide: OcrService, useValue: mockOcrService },
        { provide: ReceiptService, useValue: mockReceiptService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('dummy-token'),
          },
        },
      ],
    }).compile();

    service = module.get<LineService>(LineService);
    internal = service as unknown as LineServiceInternal;
    mockLineClient = internal.lineClient;
    mockBlobClient = internal.lineBlobClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should route image messages to handleImageMessage', async () => {
      const spy = jest
        .spyOn(internal, 'handleImageMessage')
        .mockResolvedValue(undefined);
      const events = [
        { type: 'message', message: { type: 'image' } },
      ] as unknown as WebhookEvent[];
      await service.handleWebhook(events);
      expect(spy).toHaveBeenCalledWith(events[0]);
    });

    it('should route postback to handlePostback', async () => {
      const spy = jest
        .spyOn(internal, 'handlePostback')
        .mockResolvedValue(undefined);
      const events = [{ type: 'postback' }] as unknown as WebhookEvent[];
      await service.handleWebhook(events);
      expect(spy).toHaveBeenCalledWith(events[0]);
    });
  });

  describe('handleImageMessage', () => {
    it('should reject unauthorized users', async () => {
      const spy = jest
        .spyOn(internal, 'safeReplyText')
        .mockResolvedValue(undefined);
      const event = {
        source: { userId: 'unauthorized-user' },
        message: { id: 'msg1' },
        replyToken: 'rt1',
      };
      await internal.handleImageMessage(event);
      expect(spy).toHaveBeenCalledWith(
        'rt1',
        'ขออภัย คุณไม่มีสิทธิ์ใช้งานบอทนี้',
      );
      expect(mockBlobClient.getMessageContent).not.toHaveBeenCalled();
    });

    it('should process authorized user image, run OCR, save DB, and reply Flex', async () => {
      const event = {
        source: { userId: 'Uf327dc13da3f951e3a0ef8176d0bf7ba' },
        message: { id: 'msg1' },
        replyToken: 'rt1',
      };
      const mockStream = [Buffer.from('chunk1')];
      mockBlobClient.getMessageContent.mockResolvedValue(mockStream);

      mockOcrService.processReceipt.mockResolvedValue({ storeName: 'Test' });
      mockReceiptService.createReceipt.mockResolvedValue({
        id: 'rcpt_123',
      });

      jest.spyOn(FlexBuilder, 'buildReceiptFlexMessage').mockReturnValue({
        type: 'flex',
        altText: 'Test',
      } as unknown as messagingApi.FlexMessage);

      await internal.handleImageMessage(event);

      expect(mockOcrService.processReceipt).toHaveBeenCalledWith(
        Buffer.from('chunk1'),
      );
      expect(mockReceiptService.createReceipt).toHaveBeenCalledWith(
        'Uf327dc13da3f951e3a0ef8176d0bf7ba',
        { storeName: 'Test' },
      );
      expect(mockLineClient.replyMessage).toHaveBeenCalled();
    });
  });

  describe('handlePostback', () => {
    it('should reply error if receipt not pending', async () => {
      const spy = jest
        .spyOn(internal, 'safeReplyText')
        .mockResolvedValue(undefined);
      mockReceiptService.getReceiptById.mockResolvedValue({
        status: 'approved',
      });

      const event = {
        postback: { data: 'action=approve&id=rcpt_123' },
        replyToken: 'rt1',
      };
      await internal.handlePostback(event);

      expect(spy).toHaveBeenCalledWith(
        'rt1',
        expect.stringContaining('อนุมัติไปแล้ว'),
      );
    });

    it('should approve receipt and send final flex message', async () => {
      mockReceiptService.getReceiptById.mockResolvedValue({
        status: 'pending',
      });
      mockReceiptService.approveReceipt.mockResolvedValue({
        status: 'approved',
      });
      jest.spyOn(FlexBuilder, 'buildFinalReceiptFlexMessage').mockReturnValue({
        type: 'flex',
        altText: 'Approved',
      } as unknown as messagingApi.FlexMessage);

      const event = {
        postback: { data: 'action=approve&id=rcpt_123' },
        replyToken: 'rt1',
      };
      await internal.handlePostback(event);

      expect(mockReceiptService.approveReceipt).toHaveBeenCalledWith(
        'rcpt_123',
      );
      expect(mockLineClient.replyMessage).toHaveBeenCalled();
    });

    it('should cancel receipt and send final flex message', async () => {
      mockReceiptService.getReceiptById.mockResolvedValue({
        status: 'pending',
      });
      mockReceiptService.cancelReceipt.mockResolvedValue({
        status: 'cancelled',
      });
      jest.spyOn(FlexBuilder, 'buildFinalReceiptFlexMessage').mockReturnValue({
        type: 'flex',
        altText: 'Cancelled',
      } as unknown as messagingApi.FlexMessage);

      const event = {
        postback: { data: 'action=cancel&id=rcpt_123' },
        replyToken: 'rt1',
      };
      await internal.handlePostback(event);

      expect(mockReceiptService.cancelReceipt).toHaveBeenCalledWith('rcpt_123');
      expect(mockLineClient.replyMessage).toHaveBeenCalled();
    });
  });

  describe('safeReplyText', () => {
    it('should send text and handle error gracefully', async () => {
      mockLineClient.replyMessage.mockRejectedValue(new Error('Network error'));
      await expect(internal.safeReplyText('rt1', 'msg')).resolves.not.toThrow();
    });
  });
});
