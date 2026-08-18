import {
  IsOptional,
  IsString,
} from "class-validator";

export class CreateProjectDto {
  @IsString()
  userId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  lead?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string;
}