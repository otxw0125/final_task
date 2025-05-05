import { IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  // TODO: 추가 필드가 필요할 경우 여기에 선언 및 검증 데코레이터 추가
}