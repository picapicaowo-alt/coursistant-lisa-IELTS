export interface FileTypeOption {
  extension: string;
  labelKey: string;
  groupKey: string;
}

export const ASSIGNMENT_FILE_TYPE_OPTIONS: FileTypeOption[] = [
  {
    extension: "pdf",
    labelKey: "assessment:files.pdf",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "doc",
    labelKey: "assessment:files.word",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "docx",
    labelKey: "assessment:files.word",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "odt",
    labelKey: "assessment:files.odt",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "rtf",
    labelKey: "assessment:files.rtf",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "txt",
    labelKey: "assessment:files.text",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "md",
    labelKey: "assessment:files.markdown",
    groupKey: "assessment:files.groups.documents",
  },
  {
    extension: "xls",
    labelKey: "assessment:files.excel",
    groupKey: "assessment:files.groups.spreadsheets",
  },
  {
    extension: "xlsx",
    labelKey: "assessment:files.excel",
    groupKey: "assessment:files.groups.spreadsheets",
  },
  {
    extension: "csv",
    labelKey: "assessment:files.csv",
    groupKey: "assessment:files.groups.spreadsheets",
  },
  {
    extension: "ppt",
    labelKey: "assessment:files.powerpoint",
    groupKey: "assessment:files.groups.presentations",
  },
  {
    extension: "pptx",
    labelKey: "assessment:files.powerpoint",
    groupKey: "assessment:files.groups.presentations",
  },
  {
    extension: "png",
    labelKey: "assessment:files.png",
    groupKey: "assessment:files.groups.images",
  },
  {
    extension: "jpg",
    labelKey: "assessment:files.jpeg",
    groupKey: "assessment:files.groups.images",
  },
  {
    extension: "jpeg",
    labelKey: "assessment:files.jpeg",
    groupKey: "assessment:files.groups.images",
  },
  {
    extension: "gif",
    labelKey: "assessment:files.gif",
    groupKey: "assessment:files.groups.images",
  },
  {
    extension: "webp",
    labelKey: "assessment:files.webp",
    groupKey: "assessment:files.groups.images",
  },
  {
    extension: "zip",
    labelKey: "assessment:files.zip",
    groupKey: "assessment:files.groups.archives",
  },
  {
    extension: "json",
    labelKey: "assessment:files.json",
    groupKey: "assessment:files.groups.data",
  },
  {
    extension: "xml",
    labelKey: "assessment:files.xml",
    groupKey: "assessment:files.groups.data",
  },
];
