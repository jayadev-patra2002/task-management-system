import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateSubtaskDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
