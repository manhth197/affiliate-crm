import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import type { Product } from '../generated/prisma/client';
import { CommissionType, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { commissionRuleError } from './commission-rule';
import type {
  CreateProductDto,
  UpdateProductDto,
} from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { ProductDto } from './dto/product.dto';
import { toProductDto } from './product.mapper';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListProductsQueryDto,
    viewer: AuthUser,
  ): Promise<ProductDto[]> {
    const active = viewer.role === Role.AFFILIATE ? true : query.active;
    const products = await this.prisma.product.findMany({
      where: { active, category: query.category },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return products.map(toProductDto);
  }

  async create(dto: CreateProductDto, actorId: string): Promise<ProductDto> {
    assertValidCommission(dto.commissionType, dto.commissionValue);
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...dto } });
      await this.audit.record(
        {
          actorId,
          action: 'PRODUCT_CREATED',
          entityType: 'Product',
          entityId: created.id,
          after: snapshot(created),
        },
        tx,
      );
      return created;
    });
    return toProductDto(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorId: string,
  ): Promise<ProductDto> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    assertValidCommission(
      dto.commissionType ?? existing.commissionType,
      dto.commissionValue ?? existing.commissionValue,
    );
    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { ...dto },
      });
      await this.audit.record(
        {
          actorId,
          action: 'PRODUCT_UPDATED',
          entityType: 'Product',
          entityId: id,
          before: snapshot(existing),
          after: snapshot(updated),
        },
        tx,
      );
      return updated;
    });
    return toProductDto(product);
  }
}

function assertValidCommission(type: CommissionType, value: number): void {
  const message = commissionRuleError(type, value);
  if (message) {
    throw new BadRequestException({
      message: 'Validation failed',
      details: [{ field: 'commissionValue', message }],
    });
  }
}

function snapshot(product: Product) {
  return {
    name: product.name,
    partnerName: product.partnerName,
    category: product.category,
    commissionType: product.commissionType,
    commissionValue: product.commissionValue,
    active: product.active,
  };
}
