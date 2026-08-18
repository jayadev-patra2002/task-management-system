import {
  IsOptional,
  IsString,
} from "class-validator";

export class CreateSubtaskDto {
  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}
