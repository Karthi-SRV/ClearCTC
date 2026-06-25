import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { FamilyType } from '../../../shared/schemas/city-expense.schema.js';

export class SalaryAskRequestDto {
  @IsString()
  @IsNotEmpty()
  currentCity: string;

  @IsNumber()
  @Min(1)
  @Max(1000)
  currentCtcLpa: number;

  @IsInt()
  @Min(0)
  @Max(200)
  expectedIncrementPct: number;

  /** individual = just you; family = 2–6 members. Defaults to family. */
  @IsOptional()
  @IsEnum(['individual', 'family'])
  familyType?: FamilyType = 'family';

  /** Number of family members (2–6). Only relevant when familyType = family. Defaults to 4. */
  @ValidateIf((o: SalaryAskRequestDto) => o.familyType === 'family')
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  memberCount?: number = 4;
}
