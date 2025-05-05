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
  
    /** 전체 사용자 목록 조회 */
    @Get()
    findAll() {
      return this.usersService.findAll();
    }
  
    /** ID로 사용자 조회 */
    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.usersService.findOne(id);
    }
  
    /** 회원가입 또는 관리자용 사용자 생성 */
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    create(@Body() dto: CreateUserDto) {
      return this.usersService.create(dto);
    }
  
    /** 사용자 정보 업데이트 */
    @Patch(':id')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
      return this.usersService.update(id, dto);
    }
  
    /** 사용자 삭제 */
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.usersService.remove(id);
    }
  }