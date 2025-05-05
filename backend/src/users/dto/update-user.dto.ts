import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // 모든 CreateUserDto 필드를 optional로 상속
  // TODO: role, emailVerified 등 추가할 필드가 있으면 선언
}