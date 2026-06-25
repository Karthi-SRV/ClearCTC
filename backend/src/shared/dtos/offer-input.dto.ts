import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { FamilyType } from '../../shared/schemas/city-expense.schema.js';

export class OfferInputDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName: string;

  @IsNumber()
  @Min(1)
  @Max(500)
  totalCtcLpa: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  variablePct: number;

  @IsBoolean()
  variableGuaranteed: boolean;

  @IsNumber()
  @Min(0)
  joiningBonusLpa: number;

  @IsIn(['statutory', 'none'])
  employerPf: 'statutory' | 'none';

  @IsString()
  @IsNotEmpty()
  targetCity: string;

  @IsBoolean()
  isWfh: boolean;
}

export class CreateOfferComparisonDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => OfferInputDto)
  offers: OfferInputDto[];

  @IsOptional()
  @IsEnum(['individual', 'family'])
  familyType?: FamilyType = 'family';

  @ValidateIf((o: CreateOfferComparisonDto) => o.familyType === 'family')
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  memberCount?: number = 4;
}
