export class CreateCommentDto {
  content_text!: string;
  is_spoiler?: boolean;
}

export class UpdateCommentDto {
  content_text!: string;
  /** Si no se envía, se mantiene el valor actual. */
  is_spoiler?: boolean;
}
