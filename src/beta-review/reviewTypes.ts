import { ErrorType } from '../beta-edit/editTypes';

export type ReviewDecision = 'ACCEPTED' | 'REJECTED' | 'CHANGES_REQUESTED';

export type DerivedReviewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CHANGES_REQUESTED';

export type ChapterReviewStatus = 
  | 'NOT_READY'          // Chapter not yet marked complete by Beta Reader
  | 'NEEDS_REVIEW'       // Chapter has pending edits needing review
  | 'CHANGES_REQUESTED'  // Chapter has edits where changes were requested
  | 'REVIEWED'           // All edits have been reviewed (accepted or rejected)
  | 'APPROVED'           // Admin officially sealed and approved the chapter
  | 'REOPENED';          // Previously approved, but modified post-approval

export interface BetaEditReview {
  id: string;
  editId: string;
  assignmentId?: string;
  chapterId?: string;
  reviewerId: string;
  reviewerName?: string;
  reviewerDisplayName?: string;
  decision: ReviewDecision;
  comment?: string;
  reviewedRevisionNumber: number;
  reviewedEditVersion: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AcceptedRevisionItem {
  editId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  revisionNumber: number;
  afterText: string;
  errorType?: ErrorType;
}

export interface ApprovedParagraphSegment {
  text: string;
  isApprovedEdit: boolean;
  editId?: string;
  revisionNumber?: number;
  errorType?: ErrorType;
}

export interface ApprovedParagraphResult {
  paragraphIndex: number;
  text: string;
  segments: ApprovedParagraphSegment[];
}

export interface ChapterReviewSnapshot {
  id: string;
  assignmentId: string;
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  reviewerId: string;
  reviewerDisplayName?: string;
  status: 'IN_REVIEW' | 'APPROVED' | 'REOPENED';
  approvedAt?: string;
  reviewSnapshotVersion: number;
  approvedEditsSnapshot?: AcceptedRevisionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChapterReviewOverviewItem {
  chapterIndex: number;
  chapterTitle: string;
  wordCount: number;
  isBetaCompleted: boolean;
  totalEdits: number;
  pendingEdits: number;
  acceptedEdits: number;
  rejectedEdits: number;
  changesRequestedEdits: number;
  reviewStatus: ChapterReviewStatus;
  approvedAt?: string;
}

export interface BookReviewStats {
  bookId: string;
  bookTitle: string;
  assignmentId: string;
  betaUserId: string;
  betaUserName: string;
  betaDisplayName: string;
  completedChapters: number;
  totalChapters: number;
  totalEdits: number;
  acceptedEdits: number;
  pendingEdits: number;
  rejectedEdits: number;
  changesRequestedEdits: number;
}
