import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OcrService } from '../../../src/ocr/ocr.service';

// Mock dependencies
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    textDetection: jest.fn(),
  })),
}));

jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    mockGenerateContent, // Expose for testing
  };
});

// Exposes the private members of OcrService used by the tests.
interface OcrServiceInternal {
  visionClient: { textDetection: jest.Mock };
  geminiModel: unknown;
}

describe('OcrService', () => {
  let service: OcrService;
  let mockVisionClient: { textDetection: jest.Mock };
  const { mockGenerateContent } = jest.requireMock<{
    mockGenerateContent: jest.Mock;
  }>('@google/generative-ai');

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'fake-api-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);

    // Retrieve mocked clients
    mockVisionClient = (service as unknown as OcrServiceInternal).visionClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractTextFromImage', () => {
    it('should extract text successfully', async () => {
      const buffer = Buffer.from('test image');
      mockVisionClient.textDetection.mockResolvedValue([
        { textAnnotations: [{ description: 'Mocked OCR Text' }] },
      ]);

      const result = await service.extractTextFromImage(buffer);
      expect(mockVisionClient.textDetection).toHaveBeenCalledWith(buffer);
      expect(result).toBe('Mocked OCR Text');
    });

    it('should return empty string if no text found', async () => {
      const buffer = Buffer.from('test image');
      mockVisionClient.textDetection.mockResolvedValue([
        { textAnnotations: [] },
      ]);

      const result = await service.extractTextFromImage(buffer);
      expect(result).toBe('');
    });
  });

  describe('parseReceiptWithGemini', () => {
    it('should parse JSON successfully and strip markdown', async () => {
      const rawText = 'Mocked OCR Text';
      const mockedJson = `\`\`\`json
{
  "storeName": "Test Store",
  "date": "01/01/2026",
  "totalAmount": 100,
  "items": [
    { "name": "Item 1", "quantity": 1, "price": 100 }
  ]
}
\`\`\``;
      mockGenerateContent.mockResolvedValue({
        response: { text: () => mockedJson },
      });

      const result = await service.parseReceiptWithGemini(rawText);

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(result.storeName).toBe('Test Store');
      expect(result.totalAmount).toBe(100);
      expect(result.items.length).toBe(1);
    });

    it('should throw an error if JSON is invalid', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Invalid JSON' },
      });

      await expect(service.parseReceiptWithGemini('text')).rejects.toThrow(
        /Gemini returned invalid JSON/,
      );
    });
  });

  describe('processReceipt', () => {
    it('should return empty data if OCR text is empty', async () => {
      jest.spyOn(service, 'extractTextFromImage').mockResolvedValue('');

      const result = await service.processReceipt(Buffer.from('img'));

      expect(result.storeName).toBe('ไม่สามารถอ่านได้');
      expect(result.totalAmount).toBe(0);
    });

    it('should call Gemini if OCR text is valid', async () => {
      jest.spyOn(service, 'extractTextFromImage').mockResolvedValue('text');
      const mockParsedData = {
        storeName: 'Store',
        date: null,
        totalAmount: 10,
        items: [],
      };
      jest
        .spyOn(service, 'parseReceiptWithGemini')
        .mockResolvedValue(mockParsedData);

      const result = await service.processReceipt(Buffer.from('img'));

      expect(result).toEqual(mockParsedData);
    });
  });

  describe('Missing API Key gracefully', () => {
    it('should set geminiModel to null if API key is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OcrService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined), // No key
            },
          },
        ],
      }).compile();

      const serviceWithoutKey = module.get<OcrService>(OcrService);
      expect(
        (serviceWithoutKey as unknown as OcrServiceInternal).geminiModel,
      ).toBeNull();
    });
  });
});
