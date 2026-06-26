import { Body, Controller, Get, Post } from '@nestjs/common';
import { PositionService } from './position.service.js';
import { AddPositionDto } from './dtos/add-position.dto.js';

@Controller('api/v1/positions')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  @Get()
  async getPositions() {
    return this.positionService.findAll();
  }

  @Post()
  async addPosition(@Body() dto: AddPositionDto) {
    return this.positionService.findOrCreate(dto.name);
  }
}
