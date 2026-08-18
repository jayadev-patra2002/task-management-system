import { Module } from "@nestjs/common";

import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
  ],

  controllers: [
    TasksController,
  ],

  providers: [
    TasksService,
  ],
})
export class TasksModule {}