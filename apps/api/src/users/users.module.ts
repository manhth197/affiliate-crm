import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { StaffController } from './staff.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, StaffController],
  providers: [UsersService, PasswordService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
