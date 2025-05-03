// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: '비밀번호는 최소 6자 이상이어야 합니다.' }) // 예시: 최소 길이 제한
  @IsNotEmpty()
  password: string;

  // uniqueKey 필드가 필요하다면 여기에 추가
  // @IsString()
  // @IsOptional() // 선택적 필드인 경우
  // uniqueKey?: string;
}