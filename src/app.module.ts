import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LineModule } from './line/line.module';
import { OcrModule } from './ocr/ocr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LineModule,
    OcrModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
