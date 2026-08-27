export type ErrorType = 
  | 'XUNG_HO'
  | 'DICH_SAI'
  | 'CAU_TOI_NGHIA'
  | 'NGU_PHAP'
  | 'TYPO'
  | 'DAU_CAU'
  | 'TEN_RIENG'
  | 'VAN_PHONG'
  | 'CONSISTENCY'
  | 'FORMATTING'
  | 'OTHER';

export const ERROR_TYPE_OPTIONS: { id: ErrorType; label: string; desc: string }[] = [
  { id: 'XUNG_HO', label: 'Xưng hô', desc: 'Sai đại từ, ngôi xưng, thứ bậc nhân vật' },
  { id: 'DICH_SAI', label: 'Dịch sai', desc: 'Dịch sai nghĩa gốc, hiểu nhầm ngữ cảnh' },
  { id: 'CAU_TOI_NGHIA', label: 'Câu tối nghĩa', desc: 'Câu lủng củng, khó hiểu, ngữ pháp gượng' },
  { id: 'NGU_PHAP', label: 'Ngữ pháp', desc: 'Lỗi cấu trúc câu tiếng Việt' },
  { id: 'TYPO', label: 'Lỗi chính tả', desc: 'Gõ sai từ, nhầm chữ, thiếu dấu' },
  { id: 'DAU_CAU', label: 'Dấu câu', desc: 'Thừa/thiếu/sai dấu chấm, phẩy, ngoặc kép' },
  { id: 'TEN_RIENG', label: 'Tên riêng', desc: 'Sai tên nhân vật, địa danh, môn phái' },
  { id: 'VAN_PHONG', label: 'Văn phong', desc: 'Chưa mượt, lặp từ, văn phong chưa chuẩn' },
  { id: 'CONSISTENCY', label: 'Không nhất quán', desc: 'Trước sau bất nhất về thuật ngữ' },
  { id: 'FORMATTING', label: 'Định dạng', desc: 'Lỗi khoảng trắng, xuống dòng, thụt lề' },
  { id: 'OTHER', label: 'Khác', desc: 'Các vấn đề biên tập khác' },
];

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  XUNG_HO: 'Xưng hô',
  DICH_SAI: 'Dịch sai',
  CAU_TOI_NGHIA: 'Câu tối nghĩa',
  NGU_PHAP: 'Ngữ pháp',
  TYPO: 'Lỗi chính tả',
  DAU_CAU: 'Dấu câu',
  TEN_RIENG: 'Tên riêng',
  VAN_PHONG: 'Văn phong',
  CONSISTENCY: 'Không nhất quán',
  FORMATTING: 'Định dạng',
  OTHER: 'Khác',
};

export interface BetaEdit {
  id: string;
  assignmentId: string;
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  betaUserId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  originalText: string;
  currentText: string;
  prefixContext?: string;
  suffixContext?: string;
  errorType: ErrorType;
  reason?: string;
  status: 'ACTIVE' | 'DELETED';
  version: number;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userDisplayName?: string;
  reviewStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CHANGES_REQUESTED';
  reviewComment?: string | null;
  reviewerDisplayName?: string | null;
  isStaleReview?: boolean;
  reviewedRevisionNumber?: number | null;
}

export interface EditRevision {
  id: string;
  editId: string;
  revisionNumber: number;
  beforeText: string;
  afterText: string;
  errorTypeBefore?: ErrorType;
  errorTypeAfter: ErrorType;
  reasonBefore?: string;
  reasonAfter?: string;
  changedBy: string;
  changedByName?: string;
  createdAt: string;
}

export interface BetaNote {
  id: string;
  assignmentId: string;
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  betaUserId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  selectedText?: string;
  note: string;
  status?: 'OPEN' | 'RESOLVED';
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenderSegment {
  text: string;
  isEdited: boolean;
  edit?: BetaEdit;
}
