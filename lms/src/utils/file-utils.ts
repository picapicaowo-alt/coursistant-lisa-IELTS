import {formatNumber} from '@/i18n/formatting';

export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = bytes === 0 ? 0 : Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1));
  return `${formatNumber(bytes / 1024 ** index, {maximumFractionDigits: 2})}\u00a0${units[index]}`;
};

export const getFileIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  switch (lowerType) {
    case "pdf":
      return "/icons/add-content/pdf.png";
    case "doc":
    case "docx":
      return "/icons/add-content/doc.png";
    case "ppt":
    case "pptx":
      return "/icons/add-content/ppt.png";
    default:
      // noinspection SpellCheckingInspection
      return "/icons/add-content/directbox-send.png";
  }
}