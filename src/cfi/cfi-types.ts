export interface CfiStep {
  index: number;
  id?: string;
}

export interface CfiLocalPath {
  steps: CfiStep[];
  charOffset?: number;
}

export interface CfiExpression {
  spineStep: CfiStep;
  localPath: CfiLocalPath;
}
