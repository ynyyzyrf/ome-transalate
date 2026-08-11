import type { CourseCreateForm } from "./types";
import { SUPPORTED_LANGUAGES } from "@/lib/utils";

export { SUPPORTED_LANGUAGES };

export const COURSE_PAGE_SIZE = 15;

// File dropzone setup — currently only DOCX is enabled; other formats under construction
export const ALLOWED_EXTENSIONS = [
  ".docx",
  ".doc",
  ".pdf",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".vsdx",
  ".xmind",
  ".png",
  ".jpg",
  ".jpeg",
];

export const EMPTY_CREATE_FORM: CourseCreateForm = {
  title: "",
  originalContent: "",
  category: "",
  instructor: "",
  description: "",
  sortOrder: 0,
};
