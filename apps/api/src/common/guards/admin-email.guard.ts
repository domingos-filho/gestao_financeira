import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminEmailGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const adminEmail = (this.config.get<string>("ADMIN_EMAIL") ?? "fadomingosf@gmail.com").toLowerCase();

    if (!user?.email || user.email.toLowerCase() !== adminEmail) {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
