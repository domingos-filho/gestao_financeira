import { SetMetadata } from "@nestjs/common";
import { WalletRole } from "@gf/shared";

export const WALLET_ROLES_KEY = "wallet_roles";

export const WalletRoles = (...roles: WalletRole[]) => SetMetadata(WALLET_ROLES_KEY, roles);
