import { Module } from '@nestjs/common';
import { LineController } from './line.controller';
import { LineService } from './line.service';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [OcrModule],
  controllers: [LineController],
  providers: [LineService]
})
export class LineModule { }
