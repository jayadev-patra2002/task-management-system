import {
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateProjectDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  name?: string;

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