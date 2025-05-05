// src/users/users.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Patch,
    Delete,
    UsePipes,
    ValidationPipe,
  } from '@nestjs/common';
  import { UsersService } from './users.service';
  import { CreateUserDto } from './dto/create-user.dto';
  import { UpdateUserDto } from './dto/update-user.dto';
  
  @Controller('users')
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    /** 전체 사용자 조회 */
    @Get()
    async findAll() {
      return this.usersService.findAll();
    }
  
    /** 단일 사용자 조회 */
    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.usersService.findOne(id);
    }
  
    /** 회원가입(또는 관리자용 사용자 생성) */
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async create(@Body() dto: CreateUserDto) {
      return this.usersService.create(dto);
    }
  
    /** 사용자 정보 업데이트 */
    @Patch(':id')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
      return this.usersService.update(id, dto);
    }
  
    /** 사용자 삭제 */
    @Delete(':id')
    async remove(@Param('id') id: string) {
      await this.usersService.remove(id);
      return { status: 'deleted', id };
    }
  
    // TODO: 비밀번호 변경, 이메일 활성화, 프로필 사진 업로드 등 Endpoints 추가
  }
  