import type { CsvValue } from '../common/csv';
import { formatVnDateTime } from '../common/dates';
import { formatLeadCode } from './lead-code';
import type { LeadWithRelations } from './lead.include';
import { toMoney } from './lead.mapper';

/** Column headers are Vietnamese: the file is opened by people, in Excel. */
export const LEAD_CSV_HEADERS = [
  'Mã lead',
  'Ngày tạo',
  'Trạng thái',
  'Cộng tác viên',
  'Mã giới thiệu',
  'Sản phẩm',
  'Đối tác',
  'Khách hàng',
  'Số điện thoại',
  'CCCD',
  'Số tiền đề nghị (VND)',
  'Số tiền giải ngân (VND)',
  'Nhân viên phụ trách',
];

/** Full, unmasked row: the export is ADMIN-only. */
export function leadCsvRow(lead: LeadWithRelations): CsvValue[] {
  return [
    formatLeadCode(lead.number),
    formatVnDateTime(lead.createdAt),
    lead.status,
    lead.affiliate.fullName,
    lead.affiliate.affiliateProfile?.referralCode ?? '',
    lead.product.name,
    lead.product.partnerName,
    lead.customerName,
    lead.customerPhone,
    lead.customerNationalId,
    toMoney(lead.requestedAmount),
    toMoney(lead.disbursedAmount),
    lead.assignedStaff?.fullName ?? '',
  ];
}
