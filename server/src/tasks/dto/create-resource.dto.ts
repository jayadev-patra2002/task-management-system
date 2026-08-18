import {
  IsNotEmpty,
  IsString,
} from "class-validator";

export class CreateResourceDto {
  @IsString()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;
}
